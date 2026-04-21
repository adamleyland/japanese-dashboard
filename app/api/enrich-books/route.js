/**
 * Deploy as a standard Next.js App Router Route Handler.
 *
 * Trigger by visiting:
 *   /api/enrich-books?secret=YOUR_ENRICH_SECRET
 *
 * Each request processes one batch only.
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const RAKUTEN_BOOKS_ENDPOINT =
  "https://openapi.rakuten.co.jp/services/api/BooksBook/Search/20170404";
const RAKUTEN_ORIGIN = "https://jpdashboard.app";
const BATCH_SIZE = 10;
const REQUEST_DELAY_MS = 1200;
const RATE_LIMIT_RETRY_DELAY_MS = 2000;
const STRONG_MATCH_THRESHOLD = 90;
const REVIEW_MATCH_THRESHOLD = 60;
const BOOK_SELECT_COLUMNS = [
  "id",
  "title",
  "status",
  "title_normalized",
  "author",
  "isbn",
  "caption",
  "image_url",
  "rakuten_url",
  "sales_date",
  "match_status",
  "match_confidence",
  "created_at",
  "updated_at",
].join(",");

const TRAILING_VOLUME_MARKER_PATTERNS = [
  /\s*[\uFF08(\u3010[]\s*\d+\s*[\u3011)\]]\s*$/u,
  /\s*\u7B2C?\s*\d+\s*\u5DFB\s*$/u,
  /\s*(?:vol(?:ume)?\.?\s*\d+)\s*$/iu,
  /\s*[\u4E0A\u4E0B\u4E2D]\s*$/u,
  /\s*[\u524D\u5F8C]\u7DE8\s*$/u,
  /\s*#\s*\d+\s*$/u,
  /\s*book\s*\d+\s*$/iu,
];

const BRACKETED_SUBTITLE_PATTERNS = [
  /\s*[\u3008<][^<>\u3008\u3009]*[\u3009>]\s*/gu,
  /\s*[(][^()]*[)]\s*/g,
  /\s*[\uFF08][^\uFF08\uFF09]*[\uFF09]\s*/gu,
  /\s*[\u3014][^\u3014\u3015]*[\u3015]\s*/gu,
];

class RakutenRateLimitError extends Error {
  constructor(message = "Rakuten rate limited the request.") {
    super(message);
    this.name = "RakutenRateLimitError";
  }
}

function getRequiredEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const rakutenAppId = process.env.RAKUTEN_APP_ID;
  const rakutenAccessKey = process.env.RAKUTEN_ACCESS_KEY;
  const enrichSecret = process.env.ENRICH_SECRET;

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }

  if (!rakutenAppId) {
    throw new Error("Missing RAKUTEN_APP_ID");
  }

  if (!rakutenAccessKey) {
    throw new Error("Missing RAKUTEN_ACCESS_KEY");
  }

  if (!enrichSecret) {
    throw new Error("Missing ENRICH_SECRET");
  }

  return {
    supabaseUrl,
    serviceRoleKey,
    rakutenAppId,
    rakutenAccessKey,
    enrichSecret,
  };
}

function sleep(delayMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

function cleanValue(value) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || "";
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return "";
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p\s*>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function normalizeText(value) {
  return cleanValue(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function cleanTitleForFallback(title) {
  let cleanedTitle = cleanValue(title).normalize("NFKC");

  for (const pattern of BRACKETED_SUBTITLE_PATTERNS) {
    cleanedTitle = cleanedTitle.replace(pattern, " ");
  }

  for (const pattern of TRAILING_VOLUME_MARKER_PATTERNS) {
    cleanedTitle = cleanedTitle.replace(pattern, "");
  }

  return cleanedTitle.replace(/\s+/g, " ").trim();
}

function scoreTextOverlap(candidate, expected) {
  const normalizedCandidate = normalizeText(candidate);
  const normalizedExpected = normalizeText(expected);

  if (!normalizedCandidate || !normalizedExpected) {
    return 0;
  }

  if (normalizedCandidate === normalizedExpected) {
    return 100;
  }

  if (
    normalizedCandidate.includes(normalizedExpected) ||
    normalizedExpected.includes(normalizedCandidate)
  ) {
    return 84;
  }

  let sharedCharacters = 0;
  for (const character of normalizedExpected) {
    if (normalizedCandidate.includes(character)) {
      sharedCharacters += 1;
    }
  }

  return Math.round((sharedCharacters / normalizedExpected.length) * 40);
}

function buildSearchQueries(book) {
  const originalTitle = cleanValue(book.title);
  const cleanedTitle = cleanTitleForFallback(originalTitle);
  const normalizedTitle = cleanValue(book.title_normalized);
  const author = cleanValue(book.author);
  const seen = new Set();

  return [
    { title: originalTitle, author, label: "original title + author" },
    { title: cleanedTitle, author, label: "cleaned title + author" },
    { title: originalTitle, author: "", label: "original title" },
    { title: cleanedTitle, author: "", label: "cleaned title" },
    { title: normalizedTitle, author: "", label: "normalized title" },
  ].filter((query) => {
    const title = cleanValue(query.title);
    if (title.length < 2) {
      return false;
    }

    const key = `${title}::${cleanValue(query.author)}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

async function searchRakutenBooks({
  rakutenAppId,
  rakutenAccessKey,
  title,
  author,
  delayMs,
}) {
  const params = new URLSearchParams({
    applicationId: rakutenAppId,
    accessKey: rakutenAccessKey,
    format: "json",
    formatVersion: "2",
    title,
    hits: "10",
    outOfStockFlag: "1",
  });

  if (author) {
    params.set("author", author);
  }

  const requestUrl = `${RAKUTEN_BOOKS_ENDPOINT}?${params.toString()}`;
  const requestHeaders = {
    "Content-Type": "application/json",
    Origin: RAKUTEN_ORIGIN,
    Referer: `${RAKUTEN_ORIGIN}/`,
  };

  console.log("Rakuten headers:", {
    origin: RAKUTEN_ORIGIN,
    referer: `${RAKUTEN_ORIGIN}/`,
  });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(requestUrl, {
      headers: requestHeaders,
      cache: "no-store",
    });

    if (delayMs > 0) {
      await sleep(delayMs);
    }

    if (response.status === 429) {
      if (attempt === 0) {
        console.log("Rakuten returned 429. Waiting before one retry.");
        await sleep(RATE_LIMIT_RETRY_DELAY_MS);
        continue;
      }

      throw new RakutenRateLimitError(
        "Rakuten request failed with 429 after one retry.",
      );
    }

    if (response.status === 404) {
      return [];
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Rakuten request failed with ${response.status}: ${errorText || "unknown error"}`,
      );
    }

    const payload = await response.json();
    if (Array.isArray(payload?.items)) {
      return payload.items;
    }

    if (Array.isArray(payload?.Items)) {
      return payload.Items;
    }

    return [];
  }

  return [];
}

function scoreRakutenCandidate(item, book, query) {
  const originalTitle = cleanValue(book.title);
  const cleanedTitle = cleanTitleForFallback(originalTitle);
  const candidateTitle = cleanValue(item.title);
  const candidateAuthor = cleanValue(item.author);
  const candidateIsbn = cleanValue(item.isbn);
  const originalAuthor = cleanValue(book.author);
  const originalIsbn = cleanValue(book.isbn);
  const normalizedBookTitle = normalizeText(originalTitle);
  const normalizedCleanedTitle = normalizeText(cleanedTitle);
  const normalizedCandidateTitle = normalizeText(candidateTitle);

  let score = 0;

  if (normalizedCandidateTitle && normalizedCandidateTitle === normalizedBookTitle) {
    score += 100;
  } else if (
    normalizedCandidateTitle &&
    normalizedCleanedTitle &&
    normalizedCandidateTitle === normalizedCleanedTitle
  ) {
    score += 92;
  } else {
    score += scoreTextOverlap(candidateTitle, originalTitle);
    score += Math.round(scoreTextOverlap(candidateTitle, cleanedTitle) * 0.8);
  }

  if (
    normalizedCandidateTitle &&
    normalizedBookTitle &&
    normalizedCandidateTitle.includes(normalizedBookTitle)
  ) {
    score += 22;
  }

  if (
    normalizedCandidateTitle &&
    normalizedCleanedTitle &&
    normalizedCandidateTitle.includes(normalizedCleanedTitle)
  ) {
    score += 16;
  }

  if (originalAuthor) {
    score += Math.round(scoreTextOverlap(candidateAuthor, originalAuthor) * 0.35);
  }

  if (originalIsbn && candidateIsbn && originalIsbn === candidateIsbn) {
    score += 120;
  }

  if (item.largeImageUrl) {
    score += 10;
  }

  if (item.itemUrl) {
    score += 4;
  }

  if (query.label.includes("cleaned")) {
    score -= 6;
  }

  if (!originalAuthor && candidateAuthor) {
    score += 2;
  }

  return score;
}

function chooseBestRakutenMatch(book, searchResults) {
  const scoredCandidates = searchResults
    .map(({ item, query }) => ({
      item,
      query,
      score: scoreRakutenCandidate(item, book, query),
    }))
    .sort((left, right) => right.score - left.score);

  const bestMatch = scoredCandidates[0] || null;

  return {
    bestMatch,
    scoredCandidates,
  };
}

function buildMatchPayload(match) {
  const item = match.item;

  return {
    image_url: cleanValue(item.largeImageUrl) || null,
    caption: stripHtml(item.itemCaption) || null,
    author: cleanValue(item.author) || null,
    isbn: cleanValue(item.isbn) || null,
    rakuten_url: cleanValue(item.itemUrl) || null,
    sales_date: cleanValue(item.salesDate) || null,
    match_status:
      match.score >= STRONG_MATCH_THRESHOLD ? "matched" : "review_needed",
    match_confidence: Number(match.score.toFixed(2)),
  };
}

async function enrichBookRow({
  supabase,
  book,
  rakutenAppId,
  rakutenAccessKey,
  delayMs,
}) {
  const searchQueries = buildSearchQueries(book);
  const collectedResults = [];

  for (const query of searchQueries) {
    const items = await searchRakutenBooks({
      rakutenAppId,
      rakutenAccessKey,
      title: query.title,
      author: query.author,
      delayMs,
    });

    if (!items.length) {
      continue;
    }

    items.forEach((item) => {
      collectedResults.push({ item, query });
    });
  }

  const { bestMatch } = chooseBestRakutenMatch(book, collectedResults);

  if (!bestMatch || bestMatch.score < REVIEW_MATCH_THRESHOLD) {
    const unmatchedPayload = {
      match_status: "unmatched",
      match_confidence: 0,
    };

    const { error: updateError } = await supabase
      .from("books")
      .update(unmatchedPayload)
      .eq("id", book.id);

    if (updateError) {
      throw new Error(`Failed to mark row as unmatched: ${updateError.message}`);
    }

    return {
      outcome: "unmatched",
      confidence: 0,
    };
  }

  const updatePayload = buildMatchPayload(bestMatch);
  const { error: updateError } = await supabase
    .from("books")
    .update(updatePayload)
    .eq("id", book.id);

  if (updateError) {
    throw new Error(`Failed updating "${book.title}": ${updateError.message}`);
  }

  return {
    outcome: updatePayload.match_status,
    confidence: updatePayload.match_confidence,
  };
}

export async function GET(request) {
  let env;

  try {
    env = getRequiredEnv();
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Missing server configuration.",
      },
      { status: 500 },
    );
  }

  const secret = request.nextUrl.searchParams.get("secret");
  if (!secret || secret !== env.enrichSecret) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unauthorized",
      },
      { status: 401 },
    );
  }

  const supabase = createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  try {
    const { data: books, error } = await supabase
      .from("books")
      .select(BOOK_SELECT_COLUMNS)
      .is("match_status", null)
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message || "Failed to load books batch.",
        },
        { status: 500 },
      );
    }

    if (!books?.length) {
      return NextResponse.json({
        ok: true,
        fetched: 0,
        processed: 0,
        matched: 0,
        reviewNeeded: 0,
        unmatched: 0,
        errors: 0,
        rateLimited: 0,
        message: "No books with null match_status found.",
      });
    }

    const summary = {
      ok: true,
      fetched: books.length,
      processed: 0,
      matched: 0,
      reviewNeeded: 0,
      unmatched: 0,
      errors: 0,
      rateLimited: 0,
      results: [],
    };

    for (const book of books) {
      if (!cleanValue(book.title)) {
        try {
          const { error: updateError } = await supabase
            .from("books")
            .update({
              match_status: "unmatched",
              match_confidence: 0,
            })
            .eq("id", book.id);

          if (updateError) {
            throw new Error(updateError.message);
          }

          summary.processed += 1;
          summary.unmatched += 1;
          summary.results.push({
            id: book.id,
            title: book.title,
            outcome: "unmatched",
            note: "Missing title.",
          });
        } catch (error) {
          summary.errors += 1;
          summary.results.push({
            id: book.id,
            title: book.title,
            outcome: "error",
            error: error instanceof Error ? error.message : "Failed to process untitled book.",
          });
        }

        continue;
      }

      try {
        const result = await enrichBookRow({
          supabase,
          book,
          rakutenAppId: env.rakutenAppId,
          rakutenAccessKey: env.rakutenAccessKey,
          delayMs: REQUEST_DELAY_MS,
        });

        summary.processed += 1;
        if (result.outcome === "matched") {
          summary.matched += 1;
        } else if (result.outcome === "review_needed") {
          summary.reviewNeeded += 1;
        } else {
          summary.unmatched += 1;
        }

        summary.results.push({
          id: book.id,
          title: book.title,
          outcome: result.outcome,
          confidence: result.confidence,
        });
      } catch (error) {
        if (error instanceof RakutenRateLimitError) {
          summary.rateLimited += 1;
          summary.results.push({
            id: book.id,
            title: book.title,
            outcome: "rate_limited",
            error: error.message,
          });
          continue;
        }

        summary.errors += 1;
        summary.results.push({
          id: book.id,
          title: book.title,
          outcome: "error",
          error: error instanceof Error ? error.message : "Enrichment failed.",
        });
      }
    }

    return NextResponse.json(summary);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to enrich books.",
      },
      { status: 500 },
    );
  }
}
