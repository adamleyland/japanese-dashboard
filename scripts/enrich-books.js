/**
 * Enrich books in the local Supabase `books` table using the Rakuten Books API.
 *
 * Required env vars:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   RAKUTEN_APP_ID
 *   RAKUTEN_ACCESS_KEY
 *
 * Run:
 *   npm run enrich:books
 *
 * Optional:
 *   npm run enrich:books -- --batch=20 --delay=500
 */
require("dotenv/config");
const fs = require("node:fs");
const path = require("node:path");
const { createClient } = require("@supabase/supabase-js");

const RAKUTEN_BOOKS_ENDPOINT =
  "https://openapi.rakuten.co.jp/services/api/BooksBook/Search/20170404";
const APP_REQUEST_ORIGIN = "https://www.jpdashboard.app";
const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_DELAY_MS = 500;
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
];

function loadLocalEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) {
    return;
  }

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function getRequiredEnv() {
  loadLocalEnv();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const rakutenAppId = process.env.RAKUTEN_APP_ID;
  const rakutenAccessKey = process.env.RAKUTEN_ACCESS_KEY;

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

  return {
    supabaseUrl,
    serviceRoleKey,
    rakutenAppId,
    rakutenAccessKey,
  };
}

function getCliNumber(flagName, defaultValue) {
  const prefix = `${flagName}=`;
  const matchedArg = process.argv.find((arg) => arg.startsWith(prefix));
  if (!matchedArg) {
    return defaultValue;
  }

  const parsedValue = Number(matchedArg.slice(prefix.length).trim());
  return Number.isFinite(parsedValue) && parsedValue > 0 ? Math.floor(parsedValue) : defaultValue;
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

  for (const pattern of TRAILING_VOLUME_MARKER_PATTERNS) {
    cleanedTitle = cleanedTitle.replace(pattern, "");
  }

  return cleanedTitle.trim();
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
    Origin: APP_REQUEST_ORIGIN,
    Referer: `${APP_REQUEST_ORIGIN}/`,
  };
  console.log("Rakuten request config:", {
    endpoint: RAKUTEN_BOOKS_ENDPOINT,
    title,
    hasApplicationId: Boolean(process.env.RAKUTEN_APP_ID),
    hasAccessKey: Boolean(process.env.RAKUTEN_ACCESS_KEY),
    hasReferer: Boolean(requestHeaders.Referer),
    hasOrigin: Boolean(requestHeaders.Origin),
  });
  const response = await fetch(requestUrl, {
    headers: requestHeaders,
  });

  if (delayMs > 0) {
    await sleep(delayMs);
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

function logTopCandidates(book, scoredCandidates) {
  const topCandidates = scoredCandidates.slice(0, 5);

  if (!topCandidates.length) {
    console.log(`  No Rakuten candidates found for "${book.title}".`);
    return;
  }

  console.log(`  Top Rakuten candidates for "${book.title}":`);
  topCandidates.forEach((candidate, index) => {
    console.log(
      `    ${index + 1}. "${cleanValue(candidate.item.title) || "Untitled"}" | author: ${
        cleanValue(candidate.item.author) || "Unknown"
      } | score: ${candidate.score} | query: ${candidate.query.label}`,
    );
  });
}

async function enrichBookRow({
  supabase,
  book,
  rakutenAppId,
  rakutenAccessKey,
  delayMs,
}) {
  console.log(`\nProcessing "${book.title}" (${book.id})`);

  const searchQueries = buildSearchQueries(book);
  const collectedResults = [];

  for (const query of searchQueries) {
    console.log(`  Searching Rakuten with ${query.label}: "${query.title}"`);

    try {
      const items = await searchRakutenBooks({
        rakutenAppId,
        rakutenAccessKey,
        title: query.title,
        author: query.author,
        delayMs,
      });

      if (!items.length) {
        console.log("  No results for this query.");
        continue;
      }

      items.forEach((item) => {
        collectedResults.push({ item, query });
      });
    } catch (error) {
      console.error(`  Rakuten lookup failed: ${error.message}`);
      return;
    }
  }

  const { bestMatch, scoredCandidates } = chooseBestRakutenMatch(book, collectedResults);
  logTopCandidates(book, scoredCandidates);

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
      console.error(`  Failed to mark row as unmatched: ${updateError.message}`);
      return;
    }

    console.log('  No suitable Rakuten match found. Row marked as "unmatched".');
    return;
  }

  const updatePayload = buildMatchPayload(bestMatch);

  const { error: updateError } = await supabase
    .from("books")
    .update(updatePayload)
    .eq("id", book.id);

  if (updateError) {
    console.error(`  Failed updating "${book.title}": ${updateError.message}`);
    return;
  }

  console.log(
    `  Updated row with ${updatePayload.match_status} match (confidence ${updatePayload.match_confidence}).`,
  );
}

async function enrichBooks() {
  const { supabaseUrl, serviceRoleKey, rakutenAppId, rakutenAccessKey } = getRequiredEnv();
  const batchSize = getCliNumber("--batch", DEFAULT_BATCH_SIZE);
  const delayMs = getCliNumber("--delay", DEFAULT_DELAY_MS);

  console.log("Starting books enrichment.");
  console.log("Run with: npm run enrich:books");
  console.log("Required env: RAKUTEN_APP_ID and RAKUTEN_ACCESS_KEY");
  console.log("Optional flags: npm run enrich:books -- --batch=20 --delay=500");
  console.log(`Batch size: ${batchSize}`);
  console.log(`Delay between Rakuten requests: ${delayMs}ms`);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data: books, error } = await supabase
    .from("books")
    .select(BOOK_SELECT_COLUMNS)
    .is("image_url", null)
    .order("created_at", { ascending: true })
    .limit(batchSize);

  if (error) {
    throw error;
  }

  if (!books?.length) {
    console.log("No books with null image_url found in this batch.");
    return;
  }

  console.log(`Fetched ${books.length} books with null image_url.`);

  let processedCount = 0;
  for (const book of books) {
    processedCount += 1;
    console.log(`\n[${processedCount}/${books.length}]`);

    if (!cleanValue(book.title)) {
      console.log('  Skipping row with missing title. Marking as "unmatched".');

      const { error: updateError } = await supabase
        .from("books")
        .update({
          match_status: "unmatched",
          match_confidence: 0,
        })
        .eq("id", book.id);

      if (updateError) {
        console.error(`  Failed updating missing-title row: ${updateError.message}`);
      }

      continue;
    }

    await enrichBookRow({
      supabase,
      book,
      rakutenAppId,
      rakutenAccessKey,
      delayMs,
    });
  }

  console.log("\nBooks enrichment finished.");
  console.log("Re-run the script to process the next batch if more rows remain.");
}

enrichBooks().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
