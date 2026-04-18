const GOOGLE_BOOKS_ENDPOINT = "https://www.googleapis.com/books/v1/volumes";
const OPEN_LIBRARY_SEARCH_ENDPOINT = "https://openlibrary.org/search.json";
const IMAGE_PRIORITY = ["extraLarge", "large", "medium", "small", "thumbnail"];

export function normalizeMetadataValue(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

export function scoreTextMatch(candidate, expected) {
  const normalizedCandidate = normalizeMetadataValue(candidate);
  const normalizedExpected = normalizeMetadataValue(expected);

  if (!normalizedCandidate || !normalizedExpected) {
    return 0;
  }

  if (normalizedCandidate === normalizedExpected) {
    return 120;
  }

  if (
    normalizedCandidate.includes(normalizedExpected) ||
    normalizedExpected.includes(normalizedCandidate)
  ) {
    return 80;
  }

  let sharedCharacters = 0;
  for (const character of normalizedExpected) {
    if (normalizedCandidate.includes(character)) {
      sharedCharacters += 1;
    }
  }

  return Math.round((sharedCharacters / normalizedExpected.length) * 40);
}

export function selectPreferredGoogleBooksImage(imageLinks = {}) {
  for (const key of IMAGE_PRIORITY) {
    if (imageLinks[key]) {
      return imageLinks[key].replace(/^http:\/\//i, "https://");
    }
  }

  return "";
}

export function scoreGoogleBooksVolume(volume, { title, author }) {
  const volumeInfo = volume?.volumeInfo || {};
  const volumeLanguage = String(volumeInfo.language || "").toLowerCase();
  const volumeTitle = volumeInfo.title || "";
  const volumeSubtitle = volumeInfo.subtitle || "";
  const volumeAuthors = Array.isArray(volumeInfo.authors) ? volumeInfo.authors.join(" ") : "";
  const coverUrl = selectPreferredGoogleBooksImage(volumeInfo.imageLinks);

  let score = 0;

  if (volumeLanguage === "ja") {
    score += 300;
  } else if (volumeLanguage.startsWith("ja")) {
    score += 220;
  } else if (volumeLanguage) {
    score -= 160;
  }

  score += scoreTextMatch(volumeTitle, title) * 2;
  score += scoreTextMatch(`${volumeTitle} ${volumeSubtitle}`.trim(), title);
  score += scoreTextMatch(volumeAuthors, author) * 1.5;

  if (coverUrl) {
    score += 30;
  }

  return score;
}

export async function fetchPreferredGoogleBooksMetadata(
  { title, author },
  { fetchImpl = fetch } = {},
) {
  const query = new URLSearchParams({
    q: `intitle:"${title}" inauthor:"${author}"`,
    langRestrict: "ja",
    printType: "books",
    maxResults: "10",
  });

  const response = await fetchImpl(`${GOOGLE_BOOKS_ENDPOINT}?${query.toString()}`);
  if (!response.ok) {
    throw new Error(`Google Books lookup failed: ${response.status}`);
  }

  const payload = await response.json();
  const items = Array.isArray(payload?.items) ? payload.items : [];
  if (!items.length) {
    return null;
  }

  const scoredItems = items
    .map((item) => ({
      item,
      score: scoreGoogleBooksVolume(item, { title, author }),
    }))
    .sort((left, right) => right.score - left.score);

  const bestMatch = scoredItems[0];
  if (!bestMatch || bestMatch.score < 180) {
    return null;
  }

  const volumeInfo = bestMatch.item.volumeInfo || {};
  const coverUrl = selectPreferredGoogleBooksImage(volumeInfo.imageLinks);
  if (!coverUrl) {
    return null;
  }

  return {
    coverUrl,
    coverSource: "google_books_ja",
    description: String(volumeInfo.description || "").trim() || "",
    language: volumeInfo.language || "",
    score: bestMatch.score,
  };
}

export function resolveEmbeddedCoverUrl(audiobook) {
  const embeddedCandidates = [
    audiobook?.embedded_cover_url,
    audiobook?.embedded_artwork_url,
    audiobook?.artwork_url,
  ];

  for (const candidate of embeddedCandidates) {
    if (candidate) {
      return candidate;
    }
  }

  if (audiobook?.cover_source === "embedded" && audiobook?.cover_url) {
    return audiobook.cover_url;
  }

  return "";
}

export async function fetchOpenLibraryMetadata(
  { title, author },
  { fetchImpl = fetch } = {},
) {
  const query = new URLSearchParams({
    title,
    author,
    limit: "5",
  });

  const response = await fetchImpl(`${OPEN_LIBRARY_SEARCH_ENDPOINT}?${query.toString()}`);
  if (!response.ok) {
    throw new Error(`Open Library lookup failed: ${response.status}`);
  }

  const payload = await response.json();
  const docs = Array.isArray(payload?.docs) ? payload.docs : [];
  if (!docs.length) {
    return null;
  }

  const scoredDocs = docs
    .map((doc) => ({
      doc,
      score:
        scoreTextMatch(doc?.title, title) * 2 +
        scoreTextMatch((doc?.author_name || []).join(" "), author),
    }))
    .sort((left, right) => right.score - left.score);

  const bestMatch = scoredDocs[0];
  if (!bestMatch?.doc?.cover_i || bestMatch.score < 100) {
    return null;
  }

  return {
    coverUrl: `https://covers.openlibrary.org/b/id/${bestMatch.doc.cover_i}-L.jpg`,
    coverSource: "open_library",
    description: "",
    score: bestMatch.score,
  };
}

export function shouldReplaceExistingMetadata(existingSource, incomingSource) {
  if (!incomingSource) {
    return false;
  }

  if (existingSource === "google_books_ja" && incomingSource !== "google_books_ja") {
    return false;
  }

  return true;
}

export async function resolveAudiobookMetadata(
  audiobook,
  { fetchImpl = fetch } = {},
) {
  const googleBooksMatch = await fetchPreferredGoogleBooksMetadata(
    {
      title: audiobook?.title || "",
      author: audiobook?.author || "",
    },
    { fetchImpl },
  ).catch(() => null);

  if (googleBooksMatch) {
    return googleBooksMatch;
  }

  const embeddedCoverUrl = resolveEmbeddedCoverUrl(audiobook);
  if (embeddedCoverUrl) {
    return {
      coverUrl: embeddedCoverUrl,
      coverSource: "embedded",
      description: "",
      score: 0,
    };
  }

  const openLibraryMatch = await fetchOpenLibraryMetadata(
    {
      title: audiobook?.title || "",
      author: audiobook?.author || "",
    },
    { fetchImpl },
  ).catch(() => null);

  if (openLibraryMatch) {
    return openLibraryMatch;
  }

  return null;
}
