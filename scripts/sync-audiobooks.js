const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const crypto = require("node:crypto");
const { createClient } = require("@supabase/supabase-js");
const { Storage } = require("@google-cloud/storage");

const DEFAULT_AUDIOBOOK_ROOT = "C:\\Users\\Adam\\Libation\\Books\\All Audiobooks";
const DEFAULT_FFPROBE_PATH = "C:\\ffmpeg\\ffmpeg-8.1-essentials_build\\bin\\ffprobe.exe";
const DEFAULT_FFMPEG_PATH = "C:\\ffmpeg\\ffmpeg-8.1-essentials_build\\bin\\ffmpeg.exe";
const ARTWORK_BUCKET_NAME = "jpdashboard_media";
const ARTWORK_FOLDER = "book_artwork";

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
  const gcsBucketName = process.env.GCS_BUCKET_NAME || process.env.GOOGLE_CLOUD_STORAGE_BUCKET;
  const audiobookRoot = process.env.AUDIOBOOK_LIBRARY_ROOT || DEFAULT_AUDIOBOOK_ROOT;
  const ffprobePath = process.env.FFPROBE_PATH || DEFAULT_FFPROBE_PATH;
  const ffmpegPath = process.env.FFMPEG_PATH || DEFAULT_FFMPEG_PATH;
  const keyFilename =
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    process.env.GCS_KEY_FILE ||
    process.env.GOOGLE_CLOUD_KEY_FILE ||
    "";

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }

  if (!gcsBucketName) {
    throw new Error("Missing GCS_BUCKET_NAME or GOOGLE_CLOUD_STORAGE_BUCKET");
  }

  return {
    supabaseUrl,
    serviceRoleKey,
    gcsBucketName,
    audiobookRoot,
    ffprobePath,
    ffmpegPath,
    keyFilename,
  };
}

function cleanValue(value) {
  const cleaned = String(value || "").trim();
  return cleaned || "";
}

function normalizeTagMap(tags = {}) {
  return Object.entries(tags).reduce((accumulator, [key, value]) => {
    accumulator[String(key).toLowerCase()] = value;
    return accumulator;
  }, {});
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

function normalizeLanguage(value) {
  const normalized = cleanValue(value).toLowerCase();
  if (!normalized) {
    return "ja";
  }

  if (
    normalized === "japanese" ||
    normalized === "ja" ||
    normalized.startsWith("ja-") ||
    normalized.includes("jpn")
  ) {
    return "ja";
  }

  return normalized;
}

function slugifyFilename(filename) {
  const baseName = path.basename(filename, path.extname(filename));
  const slug = baseName
    .normalize("NFKC")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/[^\p{L}\p{N}-]+/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return slug || `audiobook-${crypto.createHash("md5").update(baseName).digest("hex").slice(0, 10)}`;
}

function scanForAudiobooks(rootDir) {
  if (!fs.existsSync(rootDir)) {
    throw new Error(`Audiobook root does not exist: ${rootDir}`);
  }

  const results = [];
  const queue = [rootDir];

  while (queue.length) {
    const currentDir = queue.pop();
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
        continue;
      }

      if (entry.isFile() && path.extname(entry.name).toLowerCase() === ".m4b") {
        results.push(fullPath);
      }
    }
  }

  return results.sort((left, right) => left.localeCompare(right));
}

function commandExists(command) {
  if (fs.existsSync(command)) {
    const result = spawnSync(command, ["-version"], { encoding: "utf8", windowsHide: true });
    return result.status === 0;
  }

  const result = spawnSync(command, ["-version"], { encoding: "utf8", windowsHide: true });
  return result.status === 0;
}

function probeAudiobook(filePath, ffprobePath) {
  const command = [
    ffprobePath,
    "-v",
    "error",
    "-print_format",
    "json",
    "-show_format",
    "-show_streams",
    filePath,
  ];

  console.log(`ffprobe command: ${JSON.stringify(command)}`);

  const result = spawnSync(
    ffprobePath,
    ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", filePath],
    {
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
      windowsHide: true,
    },
  );

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "ffprobe metadata extraction failed");
  }

  return JSON.parse(result.stdout || "{}");
}

function probeAudiobookChapters(filePath, ffprobePath) {
  const command = [
    ffprobePath,
    "-v",
    "quiet",
    "-print_format",
    "json",
    "-show_chapters",
    filePath,
  ];

  console.log(`ffprobe chapter command: ${JSON.stringify(command)}`);

  const result = spawnSync(
    ffprobePath,
    ["-v", "quiet", "-print_format", "json", "-show_chapters", filePath],
    {
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
      windowsHide: true,
    },
  );

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "ffprobe chapter extraction failed");
  }

  return JSON.parse(result.stdout || "{}");
}

function extractAudiobookMetadata(filePath, probeData) {
  const formatTags = normalizeTagMap(probeData?.format?.tags || {});
  const audioStreamTags = normalizeTagMap(
    probeData?.streams?.find((stream) => stream?.codec_type === "audio")?.tags || {},
  );
  const tags = {
    ...audioStreamTags,
    ...formatTags,
  };

  const title =
    cleanValue(tags.title) || cleanValue(path.basename(filePath, path.extname(filePath)));
  const author = cleanValue(tags.artist) || cleanValue(tags.album_artist);
  const narrator = cleanValue(tags.composer);
  const description = stripHtml(tags.comment);
  const durationSeconds = Math.max(0, Math.round(Number.parseFloat(probeData?.format?.duration || "0")));

  const metadata = {
    title,
    author,
    narrator,
    description,
    duration_seconds: durationSeconds,
    language: normalizeLanguage(tags.language),
  };

  console.log(`Raw parsed metadata: ${JSON.stringify(probeData, null, 2)}`);
  console.log(`Normalized metadata: ${JSON.stringify(metadata, null, 2)}`);

  return metadata;
}

function normalizeChapters(chapterProbeData) {
  const rawChapters = Array.isArray(chapterProbeData?.chapters) ? chapterProbeData.chapters : [];

  return rawChapters
    .map((chapter, index) => {
      const title = cleanValue(chapter?.tags?.title) || `Chapter ${index + 1}`;
      const startSeconds = Number.parseFloat(chapter?.start_time || "0");
      const endSeconds = Number.parseFloat(chapter?.end_time || "0");
      const normalizedEndSeconds =
        Number.isFinite(endSeconds) && endSeconds > startSeconds ? endSeconds : null;

      return {
        chapter_index: index,
        title,
        start_seconds: Number.isFinite(startSeconds) ? startSeconds : 0,
        end_seconds: normalizedEndSeconds,
      };
    })
    .filter((chapter) => Number.isFinite(chapter.start_seconds));
}

function getAttachedPicStream(probeData) {
  return (probeData?.streams || []).find((stream) => Number(stream?.disposition?.attached_pic) === 1);
}

function buildTempArtworkPath(slug) {
  const tempDir = path.resolve("/tmp");
  fs.mkdirSync(tempDir, { recursive: true });
  return path.join(tempDir, `${slug}.jpg`);
}

function extractAttachedArtwork(localFilePath, ffmpegPath, slug, attachedPicStream) {
  if (!attachedPicStream) {
    console.log("No attached artwork stream found in audiobook metadata.");
    return "";
  }

  const tempArtworkPath = buildTempArtworkPath(slug);
  const mapSpecifier =
    typeof attachedPicStream.index === "number"
      ? `0:${attachedPicStream.index}`
      : "0:v:0";

  const command = [
    ffmpegPath,
    "-y",
    "-i",
    localFilePath,
    "-map",
    mapSpecifier,
    "-frames:v",
    "1",
    tempArtworkPath,
  ];

  console.log(`ffmpeg artwork command: ${JSON.stringify(command)}`);

  const result = spawnSync(
    ffmpegPath,
    ["-y", "-i", localFilePath, "-map", mapSpecifier, "-frames:v", "1", tempArtworkPath],
    {
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 10 * 1024 * 1024,
    },
  );

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "ffmpeg artwork extraction failed");
  }

  if (!fs.existsSync(tempArtworkPath)) {
    throw new Error(`Artwork extraction output not found: ${tempArtworkPath}`);
  }

  return tempArtworkPath;
}

function buildStorageClientOptions(keyFilename) {
  if (keyFilename && fs.existsSync(keyFilename)) {
    return { keyFilename };
  }

  return {};
}

function buildPublicAudioUrl(bucketName, objectName) {
  const encodedPath = objectName.split("/").map(encodeURIComponent).join("/");
  return `https://storage.googleapis.com/${bucketName}/${encodedPath}`;
}

async function ensureUploadedAudio(bucket, bucketName, localFilePath, sourceFilename) {
  const objectName = `audiobooks/${sourceFilename}`;
  const file = bucket.file(objectName);
  const [exists] = await file.exists();

  if (exists) {
    console.log(`GCS object already exists, skipping upload: ${objectName}`);
    return {
      objectName,
      audioUrl: buildPublicAudioUrl(bucketName, objectName),
      uploaded: false,
    };
  }

  console.log(`Uploading to GCS: ${objectName}`);
  await bucket.upload(localFilePath, {
    destination: objectName,
    resumable: false,
    metadata: {
      contentType: "audio/mp4",
    },
  });

  return {
    objectName,
    audioUrl: buildPublicAudioUrl(bucketName, objectName),
    uploaded: true,
  };
}

async function ensureUploadedArtwork(bucket, slug, extractedArtworkPath) {
  const objectName = `${ARTWORK_FOLDER}/${slug}.jpg`;
  const file = bucket.file(objectName);
  const [exists] = await file.exists();

  if (exists) {
    console.log(`Artwork object already exists, skipping upload: ${objectName}`);
    return {
      objectName,
      coverUrl: buildPublicAudioUrl(ARTWORK_BUCKET_NAME, objectName),
      uploaded: false,
      exists: true,
    };
  }

  console.log(`Uploading artwork to GCS: ${objectName}`);
  await bucket.upload(extractedArtworkPath, {
    destination: objectName,
    resumable: false,
    metadata: {
      contentType: "image/jpeg",
    },
  });

  return {
    objectName,
    coverUrl: buildPublicAudioUrl(ARTWORK_BUCKET_NAME, objectName),
    uploaded: true,
    exists: false,
  };
}

async function syncAudiobookChapters(supabase, audiobookId, chapters) {
  const { error: deleteError } = await supabase
    .from("audiobook_chapters")
    .delete()
    .eq("audiobook_id", audiobookId);

  if (deleteError) {
    throw deleteError;
  }

  if (!Array.isArray(chapters) || chapters.length === 0) {
    console.log(`No chapters found for audiobook ${audiobookId}; skipped chapter insert.`);
    return;
  }

  const { error: insertError } = await supabase.from("audiobook_chapters").insert(
    chapters.map((chapter, index) => ({
      audiobook_id: audiobookId,
      chapter_index: index,
      title: chapter.title,
      start_seconds: chapter.start_seconds,
      end_seconds: chapter.end_seconds,
    })),
  );

  if (insertError) {
    throw insertError;
  }

  console.log(`Synced ${chapters.length} chapters for audiobook ${audiobookId}`);
}

async function syncAudiobooks() {
  const {
    supabaseUrl,
    serviceRoleKey,
    gcsBucketName,
    audiobookRoot,
    ffprobePath,
    ffmpegPath,
    keyFilename,
  } = getRequiredEnv();

  console.log(`Audiobook root: ${audiobookRoot}`);
  console.log(`Resolved ffprobe path: ${ffprobePath}`);
  console.log(`ffprobe exists: ${fs.existsSync(ffprobePath) ? "yes" : "no"}`);
  console.log(`ffprobe callable: ${commandExists(ffprobePath) ? "yes" : "no"}`);
  console.log(`Resolved ffmpeg path: ${ffmpegPath}`);
  console.log(`ffmpeg exists: ${fs.existsSync(ffmpegPath) ? "yes" : "no"}`);
  console.log(`ffmpeg callable: ${commandExists(ffmpegPath) ? "yes" : "no"}`);
  console.log(`GCS bucket: ${gcsBucketName}`);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const storage = new Storage(buildStorageClientOptions(keyFilename));
  const bucket = storage.bucket(gcsBucketName);
  const artworkBucket = storage.bucket(ARTWORK_BUCKET_NAME);

  const { data: existingAudiobooks, error: existingError } = await supabase
    .from("audiobooks")
    .select("id, slug, cover_url");

  if (existingError) {
    throw existingError;
  }

  const existingBySlug = new Map((existingAudiobooks || []).map((row) => [row.slug, row]));

  const audiobookFiles = scanForAudiobooks(audiobookRoot);
  console.log(`Found ${audiobookFiles.length} .m4b files.`);

  for (const localFilePath of audiobookFiles) {
    const sourceFilename = path.basename(localFilePath);
    const slug = slugifyFilename(sourceFilename);

    console.log(`\nProcessing: ${sourceFilename}`);
    console.log(`Local file path: ${localFilePath}`);

    const probeData = probeAudiobook(localFilePath, ffprobePath);
    const chapterProbeData = probeAudiobookChapters(localFilePath, ffprobePath);
    const metadata = extractAudiobookMetadata(localFilePath, probeData);
    const chapters = normalizeChapters(chapterProbeData);
    const uploadResult = await ensureUploadedAudio(bucket, gcsBucketName, localFilePath, sourceFilename);
    const existingRow = existingBySlug.get(slug) || null;
    const artworkObjectName = `${ARTWORK_FOLDER}/${slug}.jpg`;
    const artworkFile = artworkBucket.file(artworkObjectName);
    const [artworkExistsInGcs] = await artworkFile.exists();

    let resolvedCoverUrl = existingRow?.cover_url || "";
    let resolvedCoverSource = "";

    if (!existingRow?.cover_url || !artworkExistsInGcs) {
      const attachedPicStream = getAttachedPicStream(probeData);
      if (attachedPicStream) {
        const tempArtworkPath = extractAttachedArtwork(
          localFilePath,
          ffmpegPath,
          slug,
          attachedPicStream,
        );
        const artworkUpload = await ensureUploadedArtwork(artworkBucket, slug, tempArtworkPath);
        resolvedCoverUrl = artworkUpload.coverUrl;
        resolvedCoverSource = "gcs";
      } else if (artworkExistsInGcs) {
        resolvedCoverUrl = buildPublicAudioUrl(ARTWORK_BUCKET_NAME, artworkObjectName);
        resolvedCoverSource = "gcs";
      }
    } else if (existingRow?.cover_url) {
      resolvedCoverUrl = existingRow.cover_url;
      resolvedCoverSource = "gcs";
    }

    const payload = {
      slug,
      title: metadata.title,
      author: metadata.author,
      narrator: metadata.narrator || null,
      description: metadata.description || null,
      duration_seconds: metadata.duration_seconds || null,
      audio_url: uploadResult.audioUrl,
      source: "gcs",
      language: "ja",
    };

    if (resolvedCoverUrl) {
      payload.cover_url = resolvedCoverUrl;
      payload.cover_source = resolvedCoverSource || "gcs";
    }

    console.log(`Supabase upsert payload: ${JSON.stringify(payload, null, 2)}`);

    const { data, error } = await supabase
      .from("audiobooks")
      .upsert(payload, {
        onConflict: "slug",
        ignoreDuplicates: false,
      })
      .select("id, slug, audio_url");

    if (error) {
      console.error(`Failed syncing ${sourceFilename}: ${error.message}`);
      console.error(JSON.stringify(error, null, 2));
      continue;
    }

    console.log(`Synced ${sourceFilename} (${uploadResult.uploaded ? "uploaded" : "reused"})`);
    console.log(`Supabase response: ${JSON.stringify(data ?? null, null, 2)}`);
    const audiobookId = data?.[0]?.id || existingRow?.id || null;

    if (audiobookId) {
      try {
        await syncAudiobookChapters(supabase, audiobookId, chapters);
      } catch (chapterError) {
        console.error(`Failed syncing chapters for ${sourceFilename}: ${chapterError.message}`);
        console.error(JSON.stringify(chapterError, null, 2));
      }
    }

    existingBySlug.set(slug, {
      ...(existingRow || {}),
      id: audiobookId || existingRow?.id || null,
      slug,
      cover_url: resolvedCoverUrl || existingRow?.cover_url || "",
    });
  }
}

syncAudiobooks().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
