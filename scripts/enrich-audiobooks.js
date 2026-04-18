const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const { createClient } = require("@supabase/supabase-js");

const GOOGLE_BOOKS_ENDPOINT = "https://www.googleapis.com/books/v1/volumes";
const IMAGE_PRIORITY = ["extraLarge", "large", "medium", "small", "thumbnail"];
const DEFAULT_COVER_BUCKET = "audiobook-covers";
const DEFAULT_FFPROBE_PATH = "C:\\ffmpeg\\ffmpeg-8.1-essentials_build\\bin\\ffprobe.exe";
const VOLUME_MARKER_PATTERNS = [
  /[（(【\[]?\s*(上|下|中|前編|後編)\s*[】)\]]?/gu,
  /第\s*[0-9０-９一二三四五六七八九十]+\s*巻/gu,
  /\bvolume\s*[0-9]+\b/giu,
  /\bvol\.?\s*[0-9]+\b/giu,
  /\bpart\s*[0-9]+\b/giu,
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
  const ffprobePath = process.env.FFPROBE_PATH || DEFAULT_FFPROBE_PATH;
  const audiobookLibraryRoot =
    process.env.AUDIOBOOK_LIBRARY_ROOT || "C:\\Users\\Adam\\Libation\\Books\\All Audiobooks";

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }

  return {
    supabaseUrl,
    serviceRoleKey,
    ffprobePath,
    audiobookLibraryRoot,
  };
}

function getCliArgValue(flagName) {
  const prefix = `${flagName}=`;
  const matchedArg = process.argv.find((arg) => arg.startsWith(prefix));
  if (!matchedArg) {
    return "";
  }

  return matchedArg.slice(prefix.length).trim();
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || ""));
}

function resolveLocalPath(value) {
  if (!value || isHttpUrl(value)) {
    return "";
  }

  return path.isAbsolute(value) ? value : path.resolve(process.cwd(), value);
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function stripVolumeMarkers(value) {
  return VOLUME_MARKER_PATTERNS.reduce(
    (currentValue, pattern) => currentValue.replace(pattern, ""),
    String(value || ""),
  );
}

function normalizeForComparison(value) {
  return normalizeText(stripVolumeMarkers(value));
}

function scoreTextMatch(candidate, expected, { treatAsTitle = false } = {}) {
  const normalizedCandidate = normalizeText(candidate);
  const normalizedExpected = normalizeText(expected);
  const comparisonCandidate = treatAsTitle
    ? normalizeForComparison(candidate)
    : normalizedCandidate;
  const comparisonExpected = treatAsTitle
    ? normalizeForComparison(expected)
    : normalizedExpected;

  if (!comparisonCandidate || !comparisonExpected) {
    return 0;
  }

  if (comparisonCandidate === comparisonExpected) {
    return 120;
  }

  if (normalizedCandidate === normalizedExpected) {
    return 110;
  }

  if (
    comparisonCandidate.includes(comparisonExpected) ||
    comparisonExpected.includes(comparisonCandidate)
  ) {
    return 95;
  }

  if (
    normalizedCandidate.includes(normalizedExpected) ||
    normalizedExpected.includes(normalizedCandidate)
  ) {
    return 80;
  }

  let sharedCharacters = 0;
  for (const character of comparisonExpected) {
    if (comparisonCandidate.includes(character)) {
      sharedCharacters += 1;
    }
  }

  return Math.round((sharedCharacters / comparisonExpected.length) * 45);
}

function selectBestImage(imageLinks = {}) {
  for (const size of IMAGE_PRIORITY) {
    if (imageLinks[size]) {
      return imageLinks[size].replace(/^http:\/\//i, "https://");
    }
  }

  return "";
}

function resolveEmbeddedCover(book) {
  return null;
}

function resolveAudiobookSourcePath(book) {
  return null;
}

function commandExists(command) {
  const result = spawnSync(command, ["-version"], { stdio: "ignore" });
  return result.status === 0;
}

function resolveLocalAudiobookFilePath(book, audiobookLibraryRoot) {
  const normalizedTitle = cleanMetadataValue(book?.title);
  if (!normalizedTitle) {
    return "";
  }

  if (normalizedTitle === "ノルウェイの森 上") {
    return "C:\\Users\\Adam\\Libation\\Books\\All Audiobooks\\ノルウェイの森 上.m4b";
  }

  return path.join(audiobookLibraryRoot, `${normalizedTitle}.m4b`);
}

function cleanMetadataValue(value) {
  const normalizedValue = String(value || "").trim();
  return normalizedValue || "";
}

function normalizeAuthorName(value) {
  return cleanMetadataValue(value).replace(/\s+/g, " ");
}

function normalizeLanguageCode(value) {
  const normalizedValue = cleanMetadataValue(value).toLowerCase();
  if (!normalizedValue) {
    return "";
  }

  if (
    normalizedValue === "japanese" ||
    normalizedValue === "ja" ||
    normalizedValue.startsWith("ja-") ||
    normalizedValue.includes("jpn")
  ) {
    return "ja";
  }

  if (
    normalizedValue === "english" ||
    normalizedValue === "en" ||
    normalizedValue.startsWith("en-") ||
    normalizedValue.includes("eng")
  ) {
    return "en";
  }

  return normalizedValue;
}

function normalizeTagMap(tags = {}) {
  return Object.entries(tags).reduce((accumulator, [key, value]) => {
    accumulator[String(key).toLowerCase()] = value;
    return accumulator;
  }, {});
}

function pickFirstMetadataValue(...values) {
  for (const value of values) {
    const cleanedValue = cleanMetadataValue(value);
    if (cleanedValue) {
      return cleanedValue;
    }
  }

  return "";
}

function normalizeDateCandidate(value) {
  const cleanedValue = cleanMetadataValue(value);
  if (!cleanedValue) {
    return "";
  }

  const fullDateMatch = cleanedValue.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (fullDateMatch) {
    const [, year, month, day] = fullDateMatch;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const monthDateMatch = cleanedValue.match(/(\d{4})[-/](\d{1,2})/);
  if (monthDateMatch) {
    const [, year, month] = monthDateMatch;
    return `${year}-${String(month).padStart(2, "0")}-01`;
  }

  const yearMatch = cleanedValue.match(/\b(\d{4})\b/);
  if (yearMatch) {
    return `${yearMatch[1]}-01-01`;
  }

  return "";
}

function extractFileMetadataFromProbeData(probeData) {
  const formatTags = normalizeTagMap(probeData?.format?.tags || {});
  const streamTags = normalizeTagMap(
    probeData?.streams?.find((stream) => stream?.codec_type === "audio")?.tags || {},
  );
  const commonTags = {
    ...streamTags,
    ...formatTags,
  };

  return {
    rawTags: commonTags,
    narrator: pickFirstMetadataValue(
      commonTags.composer,
      commonTags.artist,
      commonTags.album_artist,
      commonTags.performer,
      commonTags["©art"],
      commonTags.narrator,
      commonTags.reader,
      commonTags["----:com.apple.itunes:narrator"],
    ),
    publisher: pickFirstMetadataValue(
      commonTags.publisher,
      commonTags.label,
      commonTags.organization,
      commonTags["----:com.apple.itunes:publisher"],
    ),
    series: pickFirstMetadataValue(
      commonTags.series,
      commonTags["----:com.apple.itunes:series"],
      commonTags.grouping,
      commonTags.album,
    ),
    part: pickFirstMetadataValue(
      commonTags.part,
      commonTags["----:com.apple.itunes:part"],
      commonTags.disc,
      commonTags.track,
      commonTags.volume,
    ),
    publishedDate: normalizeDateCandidate(
      pickFirstMetadataValue(
        commonTags.date,
        commonTags.year,
        commonTags.creation_time,
        commonTags["©day"],
        commonTags["----:com.apple.itunes:release_date"],
        commonTags.releasedate,
      ),
    ),
  };
}

function extractRichFileMetadataFromProbeData(probeData) {
  const baseMetadata = extractFileMetadataFromProbeData(probeData);
  const formatTags = normalizeTagMap(probeData?.format?.tags || {});
  const streamTags = normalizeTagMap(
    probeData?.streams?.find((stream) => stream?.codec_type === "audio")?.tags || {},
  );
  const commonTags = {
    ...streamTags,
    ...formatTags,
  };
  const durationSeconds = Number.parseFloat(probeData?.format?.duration || "0");

  return {
    ...baseMetadata,
    rawMetadata: probeData || {},
    title: pickFirstMetadataValue(commonTags.title, commonTags["©nam"], commonTags.album),
    author: normalizeAuthorName(
      pickFirstMetadataValue(
        commonTags.artist,
        commonTags.album_artist,
        commonTags["©art"],
        commonTags.author,
      ),
    ),
    narrator: pickFirstMetadataValue(
      commonTags.composer,
      commonTags.performer,
      commonTags["©art"],
      commonTags.narrator,
      commonTags.reader,
      commonTags["----:com.apple.itunes:narrator"],
    ),
    description: pickFirstMetadataValue(
      commonTags.comment,
      commonTags.description,
      commonTags.synopsis,
      commonTags["©cmt"],
      commonTags["----:com.apple.itunes:description"],
    ),
    durationSeconds:
      Number.isFinite(durationSeconds) && durationSeconds > 0 ? Math.round(durationSeconds) : 0,
    language: normalizeLanguageCode(
      pickFirstMetadataValue(
        commonTags.language,
        commonTags["----:com.apple.itunes:language"],
      ),
    ),
  };
}

function extractCurrentSchemaMetadataFromProbeData(probeData) {
  const formatTags = normalizeTagMap(probeData?.format?.tags || {});
  const streamTags = normalizeTagMap(
    probeData?.streams?.find((stream) => stream?.codec_type === "audio")?.tags || {},
  );
  const metadata = {
    ...streamTags,
    ...formatTags,
  };
  const durationSeconds = Number.parseFloat(probeData?.format?.duration || "0");

  return {
    rawMetadata: probeData || {},
    rawTags: metadata,
    title: cleanMetadataValue(metadata.title),
    author: normalizeAuthorName(pickFirstMetadataValue(metadata.artist, metadata.album_artist)),
    narrator: cleanMetadataValue(metadata.composer),
    description: cleanMetadataValue(metadata.comment),
    durationSeconds:
      Number.isFinite(durationSeconds) && durationSeconds > 0 ? Math.round(durationSeconds) : 0,
    language: normalizeLanguageCode(cleanMetadataValue(metadata.language)),
    publisher: cleanMetadataValue(metadata.publisher),
    series: cleanMetadataValue(metadata.series),
    part: cleanMetadataValue(metadata.part),
    publishedDate: normalizeDateCandidate(cleanMetadataValue(metadata.date)),
  };
}

function probeAudiobookMetadata({ ffprobePath, sourcePath }) {
  console.log(
    `ffprobe command being executed: ${JSON.stringify([
      ffprobePath,
      "-v",
      "error",
      "-print_format",
      "json",
      "-show_format",
      "-show_streams",
      sourcePath,
    ])}`,
  );
  const probeResult = spawnSync(
    ffprobePath,
    [
      "-v",
      "error",
      "-print_format",
      "json",
      "-show_format",
      "-show_streams",
      sourcePath,
    ],
    { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
  );

  if (probeResult.status !== 0) {
    throw new Error(probeResult.stderr || probeResult.stdout || "ffprobe metadata extraction failed");
  }

  const probeData = JSON.parse(probeResult.stdout || "{}");
  return extractCurrentSchemaMetadataFromProbeData(probeData);
}

async function writeResponseToFile(response, targetPath) {
  const arrayBuffer = await response.arrayBuffer();
  fs.writeFileSync(targetPath, Buffer.from(arrayBuffer));
}

async function downloadRemoteFile(url, fileExtension = ".bin") {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed with ${response.status}`);
  }

  const targetPath = path.join(
    os.tmpdir(),
    `jp-audiobook-${crypto.randomUUID()}${fileExtension}`,
  );

  await writeResponseToFile(response, targetPath);
  return targetPath;
}

function detectContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".png") {
    return "image/png";
  }
  if (extension === ".webp") {
    return "image/webp";
  }

  return "image/jpeg";
}

function extractEmbeddedCoverWithFfmpeg({ ffmpegPath, sourcePath, outputPath }) {
  const result = spawnSync(
    ffmpegPath,
    ["-y", "-i", sourcePath, "-an", "-map", "0:v:0", "-c:v", "png", outputPath],
    { encoding: "utf8" },
  );

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "ffmpeg extraction failed");
  }

  if (!fs.existsSync(outputPath)) {
    throw new Error("ffmpeg did not produce an output image");
  }

  return outputPath;
}

async function uploadCoverToSupabase({ supabase, bucketName, bookId, localFilePath }) {
  const fileBuffer = fs.readFileSync(localFilePath);
  const extension = path.extname(localFilePath).toLowerCase() || ".png";
  const storagePath = `audiobooks/${bookId}/cover-${Date.now()}${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(bucketName)
    .upload(storagePath, fileBuffer, {
      upsert: true,
      contentType: detectContentType(localFilePath),
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage.from(bucketName).getPublicUrl(storagePath);
  return data?.publicUrl || "";
}

async function resolveUploadedEmbeddedCover({
  supabase,
  bucketName,
  book,
  ffmpegPath,
}) {
  const manualEmbeddedCover = resolveEmbeddedCover(book);
  if (manualEmbeddedCover?.type === "remote") {
    console.log(`Embedded cover already available as URL: ${manualEmbeddedCover.value}`);
    return {
      coverUrl: manualEmbeddedCover.value,
      coverSource: "embedded",
      extractedCoverPath: "",
      uploadedPublicUrl: manualEmbeddedCover.value,
    };
  }

  if (manualEmbeddedCover?.type === "local" && fs.existsSync(manualEmbeddedCover.value)) {
    console.log(`Using manually supplied extracted cover path: ${manualEmbeddedCover.value}`);
    const publicUrl = await uploadCoverToSupabase({
      supabase,
      bucketName,
      bookId: book.id,
      localFilePath: manualEmbeddedCover.value,
    });

    return {
      coverUrl: publicUrl,
      coverSource: "embedded",
      extractedCoverPath: manualEmbeddedCover.value,
      uploadedPublicUrl: publicUrl,
    };
  }

  const audiobookSource = resolveAudiobookSourcePath(book);
  if (!audiobookSource) {
    return null;
  }

  console.log(`Audiobook source file path: ${audiobookSource.value}`);

  if (!commandExists(ffmpegPath)) {
    console.log("ffmpeg unavailable; cannot auto-extract embedded cover from audiobook file.");
    return null;
  }

  let localSourcePath = "";
  let downloadedSourcePath = "";
  try {
    if (audiobookSource.type === "remote") {
      downloadedSourcePath = await downloadRemoteFile(audiobookSource.value, ".m4b");
      localSourcePath = downloadedSourcePath;
    } else if (fs.existsSync(audiobookSource.value)) {
      localSourcePath = audiobookSource.value;
    }

    if (!localSourcePath) {
      return null;
    }

    const extractedCoverPath = path.join(
      os.tmpdir(),
      `jp-audiobook-cover-${book.id}-${Date.now()}.png`,
    );

    extractEmbeddedCoverWithFfmpeg({
      ffmpegPath,
      sourcePath: localSourcePath,
      outputPath: extractedCoverPath,
    });

    console.log(`Extracted cover path: ${extractedCoverPath}`);

    const publicUrl = await uploadCoverToSupabase({
      supabase,
      bucketName,
      bookId: book.id,
      localFilePath: extractedCoverPath,
    });

    return {
      coverUrl: publicUrl,
      coverSource: "embedded",
      extractedCoverPath,
      uploadedPublicUrl: publicUrl,
    };
  } finally {
    if (downloadedSourcePath && fs.existsSync(downloadedSourcePath)) {
      fs.unlinkSync(downloadedSourcePath);
    }
  }
}

async function resolveAudiobookFileMetadata({ book, ffprobePath, audiobookLibraryRoot }) {
  const localSourcePath = resolveLocalAudiobookFilePath(book, audiobookLibraryRoot);
  if (!localSourcePath) {
    console.log(`No local audiobook file path available for metadata extraction: "${book.title}"`);
    return null;
  }

  console.log(`Audiobook metadata source path: ${localSourcePath}`);
  console.log(`Exact local file path used: ${localSourcePath}`);
  console.log(`Local file exists: ${fs.existsSync(localSourcePath) ? "yes" : "no"}`);

  if (!commandExists(ffprobePath)) {
    console.log(`Resolved ffprobe path: ${ffprobePath}`);
    console.log(`ffprobe executable exists: ${fs.existsSync(ffprobePath) ? "yes" : "no"}`);
    console.log("ffprobe callable: no");
    console.log(`ffprobe not found at attempted command/path: ${ffprobePath}`);
    return null;
  }

  try {
    if (!fs.existsSync(localSourcePath)) {
      console.log(`Resolved audiobook source was not readable: ${localSourcePath}`);
      return null;
    }

    const fileMetadata = probeAudiobookMetadata({
      ffprobePath,
      sourcePath: localSourcePath,
    });

    console.log(
      `Raw parsed metadata object: ${JSON.stringify(fileMetadata.rawMetadata || {}, null, 2)}`,
    );
    console.log(
      `Normalized mapped metadata object: ${JSON.stringify(
        {
          title: fileMetadata.title,
          author: fileMetadata.author,
          narrator: fileMetadata.narrator,
          description: fileMetadata.description,
          duration_seconds: fileMetadata.durationSeconds,
          language: fileMetadata.language,
          publisher: fileMetadata.publisher,
          series: fileMetadata.series,
          part: fileMetadata.part,
          published_date: fileMetadata.publishedDate,
        },
        null,
        2,
      )}`,
    );

    return fileMetadata;
  } catch (error) {
    console.error(`Failed to extract audiobook file metadata: ${error.message}`);
    return null;
  }
}

function scoreGoogleBooksResult(item, book) {
  const volumeInfo = item?.volumeInfo || {};
  const language = String(volumeInfo.language || "").toLowerCase();
  const title = volumeInfo.title || "";
  const subtitle = volumeInfo.subtitle || "";
  const authors = Array.isArray(volumeInfo.authors) ? volumeInfo.authors.join(" ") : "";
  const titleWithSubtitle = `${title} ${subtitle}`.trim();
  const hasImage = Boolean(selectBestImage(volumeInfo.imageLinks));

  let score = 0;

  if (language === "ja") {
    score += 300;
  } else if (language.startsWith("ja")) {
    score += 220;
  } else if (language) {
    score -= 160;
  }

  score += scoreTextMatch(title, book.title, { treatAsTitle: true }) * 2.3;
  score += scoreTextMatch(titleWithSubtitle, book.title, { treatAsTitle: true }) * 1.4;
  score += Math.round(scoreTextMatch(authors, book.author) * 1.8);

  if (normalizeForComparison(title).includes(normalizeForComparison(book.title))) {
    score += 50;
  }

  if (normalizeForComparison(book.title).includes(normalizeForComparison(title))) {
    score += 30;
  }

  if (normalizeForComparison(authors) === normalizeForComparison(book.author)) {
    score += 40;
  }

  if (hasImage) {
    score += 35;
  }

  return score;
}

function logTopCandidates(book, scoredItems) {
  const topCandidates = scoredItems.slice(0, 5);
  if (!topCandidates.length) {
    console.log(`No Google Books candidates returned for "${book.title}".`);
    return;
  }

  console.log(`Top Google Books candidates for "${book.title}":`);
  topCandidates.forEach(({ item, score }, index) => {
    const volumeInfo = item?.volumeInfo || {};
    const authors = Array.isArray(volumeInfo.authors) ? volumeInfo.authors.join(", ") : "Unknown";
    const hasImage = Boolean(selectBestImage(volumeInfo.imageLinks));
    console.log(
      `  ${index + 1}. "${volumeInfo.title || "Untitled"}" | authors: ${authors} | language: ${volumeInfo.language || "unknown"} | image: ${hasImage ? "yes" : "no"} | score: ${score}`,
    );
  });
}

async function fetchGoogleBooksMatch(book, apiKey) {
  const params = new URLSearchParams({
    q: `intitle:${book.title} inauthor:${book.author}`,
    langRestrict: "ja",
    maxResults: "10",
    key: apiKey,
  });

  const requestUrl = `${GOOGLE_BOOKS_ENDPOINT}?${params.toString()}`;
  const response = await fetch(requestUrl);

  if (!response.ok) {
    throw new Error(`Google Books request failed with ${response.status}`);
  }

  const payload = await response.json();
  const items = Array.isArray(payload?.items) ? payload.items : [];

  if (!items.length) {
    return null;
  }

  const scoredItems = items
    .map((item) => ({
      item,
      score: scoreGoogleBooksResult(item, book),
    }))
    .sort((left, right) => right.score - left.score);

  logTopCandidates(book, scoredItems);

  const bestMatch = scoredItems[0];
  if (!bestMatch || bestMatch.score < 135) {
    return null;
  }

  const volumeInfo = bestMatch.item.volumeInfo || {};
  const coverUrl = selectBestImage(volumeInfo.imageLinks);

  return {
    score: bestMatch.score,
    language: volumeInfo.language || "",
    coverUrl,
    hasImage: Boolean(coverUrl),
    description: String(volumeInfo.description || "").trim(),
    title: volumeInfo.title || "",
    authors: Array.isArray(volumeInfo.authors) ? volumeInfo.authors.join(", ") : "",
  };
}

async function enrichAudiobooks() {
  const {
    supabaseUrl,
    serviceRoleKey,
    ffprobePath,
    audiobookLibraryRoot,
  } = getRequiredEnv();
  const force = process.argv.includes("--force");
  const bookFilter = getCliArgValue("--book");
  const forceSingleBookUpdate = Boolean(bookFilter);
  const ffprobeCallable = commandExists(ffprobePath);
  const ffprobeExists = fs.existsSync(ffprobePath);

  console.log(`Resolved ffprobe path: ${ffprobePath}`);
  console.log(`ffprobe executable exists: ${ffprobeExists ? "yes" : "no"}`);
  console.log(`ffprobe callable: ${ffprobeCallable ? "yes" : "no"}`);
  console.log(`Resolved audiobook library root: ${audiobookLibraryRoot}`);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data: audiobooks, error } = await supabase
    .from("audiobooks")
    .select(
      "id, slug, title, author, narrator, description, cover_url, audio_url, duration_seconds, language, source, created_at, updated_at, publisher, series, part, published_date",
    );

  if (error) {
    throw error;
  }

  for (const book of audiobooks || []) {
    if (bookFilter) {
      const normalizedFilter = normalizeText(bookFilter);
      const normalizedTitle = normalizeText(book?.title);
      const normalizedId = normalizeText(book?.id);

      if (
        normalizedFilter !== normalizedTitle &&
        normalizedFilter !== normalizedId &&
        !normalizedTitle.includes(normalizedFilter)
      ) {
        continue;
      }
    }

    if (!book?.title || !book?.author) {
      console.log(`Skipping row ${book?.id || "unknown"}: missing title or author.`);
      continue;
    }

    if (
      !force &&
      !forceSingleBookUpdate &&
      book.description &&
      book.language &&
      book.duration_seconds &&
      book.narrator &&
      book.publisher &&
      book.series &&
      book.part &&
      book.published_date
    ) {
      console.log(`Skipping "${book.title}": metadata already enriched.`);
      continue;
    }

    console.log(`Processing "${book.title}" by ${book.author}...`);

    const fileMetadata = await resolveAudiobookFileMetadata({
      book,
      ffprobePath,
      audiobookLibraryRoot,
    });

    const updatePayload = {};

    if (fileMetadata?.title) {
      updatePayload.title = fileMetadata.title;
    }

    if (fileMetadata?.author) {
      updatePayload.author = fileMetadata.author;
    }

    if (fileMetadata?.narrator) {
      updatePayload.narrator = fileMetadata.narrator;
    }

    if (fileMetadata?.description) {
      updatePayload.description = fileMetadata.description;
    }

    if (fileMetadata?.durationSeconds) {
      updatePayload.duration_seconds = fileMetadata.durationSeconds;
    }

    if (fileMetadata?.language) {
      updatePayload.language = fileMetadata.language;
    }

    if (fileMetadata?.publisher) {
      updatePayload.publisher = fileMetadata.publisher;
    }

    if (fileMetadata?.series) {
      updatePayload.series = fileMetadata.series;
    }

    if (fileMetadata?.part) {
      updatePayload.part = fileMetadata.part;
    }

    if (fileMetadata?.publishedDate) {
      updatePayload.published_date = fileMetadata.publishedDate;
    }

    console.log(
      `Final Supabase payload before update for "${book.title}": ${JSON.stringify(
        updatePayload,
        null,
        2,
      )}`,
    );

    if (!Object.keys(updatePayload).length) {
      console.log(`No database fields needed updating for "${book.title}".`);
      continue;
    }

    const updateQuery = supabase.from("audiobooks").update(updatePayload);
    let matchDescription = `id = ${book.id}`;
    if (book.slug) {
      updateQuery.eq("slug", book.slug);
      matchDescription = `slug = "${book.slug}"`;
    } else {
      updateQuery.eq("id", book.id);
    }

    console.log(`Exact row match condition used for update: ${matchDescription}`);

    const { data: updatedRows, error: updateError } = await updateQuery.select(
      "id, slug, title, author, narrator, description, cover_url, audio_url, duration_seconds, language, source, created_at, updated_at, publisher, series, part, published_date",
    );

    if (updateError) {
      console.error(`Failed updating "${book.title}": ${updateError.message}`);
      console.error(`Supabase response / error: ${JSON.stringify(updateError, null, 2)}`);
      continue;
    }

    console.log(`Supabase response / error: ${JSON.stringify(updatedRows ?? null, null, 2)}`);
    console.log(`Updated "${book.title}" successfully.`);
  }
}

enrichAudiobooks().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
