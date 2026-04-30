import "server-only";

import { createHash } from "node:crypto";
import { inflateRawSync } from "node:zlib";
import { Buffer } from "node:buffer";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { SHADOWING_DECK_FIELD_NAMES } from "@/lib/shadowing/constants";

const MEDIA_BUCKET = "shadowing-audio";
const ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const ZIP_CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const ZIP_LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const AUDIO_MIME_TYPES = {
  ".aac": "audio/aac",
  ".flac": "audio/flac",
  ".m4a": "audio/mp4",
  ".mp3": "audio/mpeg",
  ".oga": "audio/ogg",
  ".ogg": "audio/ogg",
  ".opus": "audio/ogg",
  ".wav": "audio/wav",
  ".weba": "audio/webm",
  ".webm": "audio/webm",
};
const FIELD_KEYS = SHADOWING_DECK_FIELD_NAMES.reduce((result, fieldName) => {
  result[normalizeFieldLookupKey(fieldName)] = fieldName;
  return result;
}, {});

function normalizeFieldLookupKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function cleanFieldText(value) {
  if (value == null) {
    return null;
  }

  const normalizedValue = decodeHtmlEntities(String(value))
    .replace(/\[sound:[^\]]+\]/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/div>\s*<div>/gi, "\n")
    .replace(/<\/p>\s*<p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .trim();

  return normalizedValue || null;
}

function parseIntegerField(value) {
  const normalizedValue = cleanFieldText(value);
  if (!normalizedValue) {
    return null;
  }

  const parsed = Number(normalizedValue);
  return Number.isInteger(parsed) ? parsed : null;
}

function sanitizeStorageSegment(value, fallback = "shadowing-deck") {
  const normalizedValue = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);

  return normalizedValue || fallback;
}

function detectAudioMimeType(filename) {
  const extension = path.extname(String(filename || "")).toLowerCase();
  return AUDIO_MIME_TYPES[extension] || "application/octet-stream";
}

function extractSoundReference(value) {
  const match = String(value || "").match(/\[sound:([^\]]+)\]/i);
  return match?.[1] ? match[1].trim() : "";
}

function buildChecksum(buffer) {
  return createHash("sha1").update(buffer).digest("hex");
}

function parseZipEntries(fileBuffer) {
  const zipBuffer = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer);
  const endRecordOffset = findEndOfCentralDirectoryOffset(zipBuffer);
  if (endRecordOffset < 0) {
    throw new Error("Invalid .apkg file: could not find ZIP central directory.");
  }

  const totalEntries = zipBuffer.readUInt16LE(endRecordOffset + 10);
  const centralDirectoryOffset = zipBuffer.readUInt32LE(endRecordOffset + 16);
  const entries = new Map();
  let cursor = centralDirectoryOffset;

  for (let index = 0; index < totalEntries; index += 1) {
    const signature = zipBuffer.readUInt32LE(cursor);
    if (signature !== ZIP_CENTRAL_DIRECTORY_SIGNATURE) {
      throw new Error("Invalid .apkg file: malformed ZIP central directory entry.");
    }

    const compressionMethod = zipBuffer.readUInt16LE(cursor + 10);
    const compressedSize = zipBuffer.readUInt32LE(cursor + 20);
    const fileNameLength = zipBuffer.readUInt16LE(cursor + 28);
    const extraFieldLength = zipBuffer.readUInt16LE(cursor + 30);
    const fileCommentLength = zipBuffer.readUInt16LE(cursor + 32);
    const localHeaderOffset = zipBuffer.readUInt32LE(cursor + 42);
    const fileName = zipBuffer
      .subarray(cursor + 46, cursor + 46 + fileNameLength)
      .toString("utf8");

    const localHeaderSignature = zipBuffer.readUInt32LE(localHeaderOffset);
    if (localHeaderSignature !== ZIP_LOCAL_FILE_HEADER_SIGNATURE) {
      throw new Error("Invalid .apkg file: malformed ZIP local header.");
    }

    const localFileNameLength = zipBuffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraFieldLength = zipBuffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localFileNameLength + localExtraFieldLength;
    const compressedData = zipBuffer.subarray(dataStart, dataStart + compressedSize);

    let fileData;
    if (compressionMethod === 0) {
      fileData = compressedData;
    } else if (compressionMethod === 8) {
      fileData = inflateRawSync(compressedData);
    } else {
      throw new Error(`Unsupported ZIP compression method: ${compressionMethod}.`);
    }

    entries.set(fileName, {
      name: fileName,
      data: fileData,
    });

    cursor += 46 + fileNameLength + extraFieldLength + fileCommentLength;
  }

  return entries;
}

function findEndOfCentralDirectoryOffset(zipBuffer) {
  const minimumOffset = Math.max(0, zipBuffer.length - 0xffff - 22);

  for (let offset = zipBuffer.length - 22; offset >= minimumOffset; offset -= 1) {
    if (zipBuffer.readUInt32LE(offset) === ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE) {
      return offset;
    }
  }

  return -1;
}

function resolveCollectionFileName(entries) {
  return [
    "collection.anki21",
    "collection.anki21b",
    "collection.anki2",
  ].find((fileName) => entries.has(fileName));
}

function resolveMediaMap(entries) {
  const mediaEntry = entries.get("media");
  if (!mediaEntry) {
    return {};
  }

  try {
    return JSON.parse(mediaEntry.data.toString("utf8"));
  } catch {
    return {};
  }
}

async function withTemporaryDatabase(collectionBuffer, callback) {
  const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "shadowing-apkg-"));
  const databasePath = path.join(tempDirectory, "collection.sqlite");

  try {
    await fs.writeFile(databasePath, collectionBuffer);
    const database = new DatabaseSync(databasePath, { readOnly: true });
    try {
      return callback(database);
    } finally {
      database.close();
    }
  } finally {
    await fs.rm(tempDirectory, { recursive: true, force: true });
  }
}

function mapModelFields(modelsJson) {
  let parsedModels = {};

  try {
    parsedModels = JSON.parse(modelsJson || "{}");
  } catch {
    parsedModels = {};
  }

  return Object.values(parsedModels).reduce((result, model) => {
    const modelId = String(model?.id || "");
    result[modelId] = Array.isArray(model?.flds)
      ? model.flds.map((field) => String(field?.name || ""))
      : [];
    return result;
  }, {});
}

function normalizeFieldsForNote(fieldNames, fieldValues) {
  const fieldMap = {};

  fieldNames.forEach((fieldName, index) => {
    if (!fieldName) {
      return;
    }

    fieldMap[fieldName] = fieldValues[index] ?? "";
  });

  const normalizedFields = SHADOWING_DECK_FIELD_NAMES.reduce((result, fieldName) => {
    result[fieldName] = null;
    return result;
  }, {});

  for (const [fieldName, fieldValue] of Object.entries(fieldMap)) {
    const canonicalFieldName = FIELD_KEYS[normalizeFieldLookupKey(fieldName)];
    if (!canonicalFieldName) {
      continue;
    }

    normalizedFields[canonicalFieldName] = fieldValue ?? "";
  }

  return {
    fieldMap,
    normalizedFields,
  };
}

function buildCardRows(noteRows, mediaMap, sourceFilename, checksum) {
  const mediaFileLookup = Object.entries(mediaMap || {}).reduce((result, [archiveKey, targetName]) => {
    result[String(targetName || "")] = String(archiveKey || "");
    return result;
  }, {});
  const safeDeckFolder = sanitizeStorageSegment(path.parse(sourceFilename).name || sourceFilename);

  return noteRows.map((row, index) => {
    const fieldNames = Array.isArray(row.fieldNames) ? row.fieldNames : [];
    const fieldValues = String(row.flds || "").split("\u001f");
    const { normalizedFields } = normalizeFieldsForNote(fieldNames, fieldValues);
    const sentenceAudioName = extractSoundReference(normalizedFields["Sentence-Audio"]);
    const vocabAudioName = extractSoundReference(normalizedFields["Vocabulary-Audio"]);
    const sentenceArchiveKey = sentenceAudioName ? mediaFileLookup[sentenceAudioName] || "" : "";
    const vocabArchiveKey = vocabAudioName ? mediaFileLookup[vocabAudioName] || "" : "";

    return {
      user_id: "",
      deck_id: "",
      original_note_id: String(row.noteId || ""),
      original_card_id: String(row.cardId || ""),
      original_order: index,
      expression: cleanFieldText(normalizedFields.Expression),
      reading: cleanFieldText(normalizedFields.Reading),
      sentence_kana: cleanFieldText(normalizedFields["Sentence-Kana"]),
      sentence_english: cleanFieldText(normalizedFields["Sentence-English"]),
      sentence_audio_source_name: sentenceAudioName || null,
      sentence_audio_archive_key: sentenceArchiveKey || null,
      vocab_kanji: cleanFieldText(normalizedFields["Vocabulary-Kanji"]),
      vocab_furigana: cleanFieldText(normalizedFields["Vocabulary-Furigana"]),
      vocab_kana: cleanFieldText(normalizedFields["Vocabulary-Kana"]),
      vocab_english: cleanFieldText(normalizedFields["Vocabulary-English"]),
      vocab_audio_source_name: vocabAudioName || null,
      vocab_audio_archive_key: vocabArchiveKey || null,
      vocab_pos: cleanFieldText(normalizedFields["Vocabulary-Pos"]),
      sentence_clozed: cleanFieldText(normalizedFields["Sentence-Clozed"]),
      core_index: parseIntegerField(normalizedFields["Core-Index"]),
      optimized_vocab_index: parseIntegerField(normalizedFields["Optimized-Voc-Index"]),
      optimized_sent_index: parseIntegerField(normalizedFields["Optimized-Sent-Index"]),
      tags: cleanFieldText(normalizedFields.Tags) || cleanFieldText(row.tags),
      notes: cleanFieldText(normalizedFields.Notes),
      is_audio_available: Boolean(sentenceAudioName && sentenceArchiveKey),
      storage_prefix: `${sanitizeStorageSegment(checksum, "shadowing")}/${safeDeckFolder}/${index + 1}`,
    };
  });
}

async function extractNoteRows(collectionBuffer) {
  return withTemporaryDatabase(collectionBuffer, (database) => {
    const modelRow = database.prepare("select models from col limit 1").get();
    const fieldMapByModelId = mapModelFields(modelRow?.models);
    const statement = database.prepare(`
      select
        n.id as note_id,
        n.mid as model_id,
        n.flds as flds,
        n.tags as tags,
        min(c.id) as first_card_id
      from notes n
      join cards c on c.nid = n.id
      group by n.id, n.mid, n.flds, n.tags
      order by first_card_id asc, n.id asc
    `);

    return statement.all().map((row) => ({
      noteId: row.note_id,
      cardId: row.first_card_id,
      tags: row.tags,
      flds: row.flds,
      fieldNames: fieldMapByModelId[String(row.model_id || "")] || [],
    }));
  });
}

export async function parseApkgShadowingDeck(fileName, arrayBuffer) {
  const fileBuffer = Buffer.from(arrayBuffer);
  const checksum = buildChecksum(fileBuffer);
  const zipEntries = parseZipEntries(fileBuffer);
  const collectionFileName = resolveCollectionFileName(zipEntries);

  if (!collectionFileName) {
    throw new Error("Invalid .apkg file: missing Anki collection database.");
  }

  const noteRows = await extractNoteRows(zipEntries.get(collectionFileName).data);
  const mediaMap = resolveMediaMap(zipEntries);
  const cards = buildCardRows(noteRows, mediaMap, fileName, checksum);
  const deckName = path.parse(fileName).name || "Imported shadowing deck";

  return {
    checksum,
    mediaBucket: MEDIA_BUCKET,
    fileName,
    deckName,
    cards,
    zipEntries,
    mediaMap,
    metadata: {
      importedFieldNames: SHADOWING_DECK_FIELD_NAMES,
      sourceDeckName: deckName,
    },
  };
}

export function buildStorageUploadPath({ userId, sourceChecksum, originalFileName, mediaFileName, cardOrder, mediaType }) {
  const safeChecksum = sanitizeStorageSegment(sourceChecksum, "shadowing");
  const safeOriginalName = sanitizeStorageSegment(path.parse(originalFileName).name || originalFileName);
  const safeMediaType = sanitizeStorageSegment(mediaType, "audio");
  const safeMediaName = sanitizeStorageSegment(path.basename(mediaFileName || "audio"));

  return `${sanitizeStorageSegment(userId, "user")}/${safeChecksum}/${safeOriginalName}/${String(cardOrder).padStart(4, "0")}-${safeMediaType}-${safeMediaName}`;
}

export function buildAudioUploadPayload(card, zipEntries) {
  const uploads = [];

  if (card?.sentence_audio_archive_key && zipEntries.has(card.sentence_audio_archive_key)) {
    const originalFileName = card.sentence_audio_source_name || `sentence-${card.original_order + 1}.audio`;
    uploads.push({
      kind: "sentence",
      archiveKey: card.sentence_audio_archive_key,
      originalFileName,
      contentType: detectAudioMimeType(originalFileName),
      buffer: zipEntries.get(card.sentence_audio_archive_key).data,
    });
  }

  if (card?.vocab_audio_archive_key && zipEntries.has(card.vocab_audio_archive_key)) {
    const originalFileName =
      card.vocab_audio_source_name || `vocab-${card.original_order + 1}.audio`;
    uploads.push({
      kind: "vocabulary",
      archiveKey: card.vocab_audio_archive_key,
      originalFileName,
      contentType: detectAudioMimeType(originalFileName),
      buffer: zipEntries.get(card.vocab_audio_archive_key).data,
    });
  }

  return uploads;
}
