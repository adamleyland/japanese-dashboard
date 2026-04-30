import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import {
  buildAudioUploadPayload,
  buildStorageUploadPath,
  parseApkgShadowingDeck,
} from "@/lib/shadowingImport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const SHADOWING_MEDIA_BUCKET = "shadowing-audio";
const SHADOWING_DECK_SELECT_COLUMNS = [
  "id",
  "user_id",
  "name",
  "total_cards",
  "created_at",
].join(", ");
const SHADOWING_CARD_BASE_SELECT_COLUMNS = [
  "id",
  "deck_id",
  "user_id",
  "original_order",
  "expression",
  "reading",
  "sentence_kana",
  "sentence_english",
  "sentence_audio_url",
  "vocab_kanji",
  "vocab_furigana",
  "vocab_kana",
  "vocab_english",
  "vocab_audio_url",
  "vocab_pos",
  "sentence_clozed",
  "core_index",
  "optimized_vocab_index",
  "optimized_sent_index",
  "tags",
  "notes",
  "is_audio_available",
  "created_at",
].join(", ");
const SHADOWING_CARD_OPTIONAL_ID_COLUMNS = ["original_card_id", "original_note_id"];

function summarizeSupabaseError(error) {
  return {
    message: error?.message || "",
    code: error?.code || "",
    details: error?.details || "",
    hint: error?.hint || "",
  };
}

function formatSupabaseErrorMessage(prefix, error) {
  const summary = summarizeSupabaseError(error);
  const detailParts = [summary.code, summary.details, summary.hint].filter(Boolean);
  return detailParts.length
    ? `${prefix} ${summary.message || "Unknown Supabase error."} (${detailParts.join(" | ")})`
    : `${prefix} ${summary.message || "Unknown Supabase error."}`;
}

function logShadowingImportDebug(eventName, payload = {}) {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  console.debug(`[Shadowing Import] ${eventName}`, payload);
}

function isMissingColumnError(error, columnName, tableName = "") {
  const haystack = [
    error?.message,
    error?.details,
    error?.hint,
    error?.code,
    columnName,
    tableName,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (!haystack) {
    return false;
  }

  const normalizedColumnName = String(columnName || "").toLowerCase();
  const normalizedTableName = String(tableName || "").toLowerCase();

  return (
    haystack.includes("column") &&
    haystack.includes(normalizedColumnName) &&
    (haystack.includes("does not exist") ||
      haystack.includes("not found") ||
      haystack.includes("schema cache")) &&
    (!normalizedTableName || haystack.includes(normalizedTableName))
  );
}

function buildShadowingCardSelectColumns(baseColumns, optionalColumns = []) {
  return [baseColumns, ...optionalColumns].filter(Boolean).join(", ");
}

function findMissingShadowingIdColumn(error) {
  return SHADOWING_CARD_OPTIONAL_ID_COLUMNS.find((columnName) =>
    isMissingColumnError(error, columnName, "shadowing_cards"),
  );
}

function omitPayloadKeys(payloads, omittedKeys) {
  if (!omittedKeys.size) {
    return payloads;
  }

  return payloads.map((payload) => {
    const nextPayload = { ...payload };
    for (const omittedKey of omittedKeys) {
      delete nextPayload[omittedKey];
    }
    return nextPayload;
  });
}

function normalizeShadowingIdentifier(value) {
  return String(value || "").trim();
}

function normalizeShadowingOrder(value) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? String(Math.max(0, Math.floor(parsedValue))) : "";
}

function createShadowingDuplicateTracker(rows = []) {
  const tracker = {
    cardIds: new Set(),
    noteIds: new Set(),
    originalOrders: new Set(),
  };

  for (const row of rows) {
    const originalCardId = normalizeShadowingIdentifier(row?.original_card_id);
    const originalNoteId = normalizeShadowingIdentifier(row?.original_note_id);
    const originalOrder = normalizeShadowingOrder(row?.original_order);

    if (originalCardId) {
      tracker.cardIds.add(originalCardId);
    }

    if (originalNoteId) {
      tracker.noteIds.add(originalNoteId);
    }

    if (!originalCardId && !originalNoteId && originalOrder) {
      tracker.originalOrders.add(originalOrder);
    }
  }

  return tracker;
}

function shouldSkipShadowingCard(tracker, card) {
  const originalCardId = normalizeShadowingIdentifier(card?.original_card_id);
  if (originalCardId && tracker.cardIds.has(originalCardId)) {
    return true;
  }

  const originalNoteId = normalizeShadowingIdentifier(card?.original_note_id);
  if (originalNoteId && tracker.noteIds.has(originalNoteId)) {
    return true;
  }

  if (!originalCardId && !originalNoteId) {
    const originalOrder = normalizeShadowingOrder(card?.original_order);
    if (originalOrder && tracker.originalOrders.has(originalOrder)) {
      return true;
    }
  }

  return false;
}

function rememberShadowingCard(tracker, card) {
  const originalCardId = normalizeShadowingIdentifier(card?.original_card_id);
  const originalNoteId = normalizeShadowingIdentifier(card?.original_note_id);
  const originalOrder = normalizeShadowingOrder(card?.original_order);

  if (originalCardId) {
    tracker.cardIds.add(originalCardId);
  }

  if (originalNoteId) {
    tracker.noteIds.add(originalNoteId);
  }

  if (!originalCardId && !originalNoteId && originalOrder) {
    tracker.originalOrders.add(originalOrder);
  }
}

async function runShadowingCardSelectQuery({
  adminClient,
  baseColumns,
  queryBuilder,
  warningContext = {},
}) {
  const omittedColumns = new Set();
  let data = [];
  let error = null;

  while (true) {
    const selectColumns = buildShadowingCardSelectColumns(
      baseColumns,
      SHADOWING_CARD_OPTIONAL_ID_COLUMNS.filter((columnName) => !omittedColumns.has(columnName)),
    );

    ({ data, error } = await queryBuilder(
      adminClient.from("shadowing_cards").select(selectColumns),
    ));

    if (!error) {
      break;
    }

    const missingColumn = findMissingShadowingIdColumn(error);
    if (!missingColumn || omittedColumns.has(missingColumn)) {
      break;
    }

    omittedColumns.add(missingColumn);
    console.warn(
      `[Shadowing] shadowing_cards.${missingColumn} is missing in this database. Falling back to the reduced card schema. Run the latest Supabase migrations to restore the full import metadata.`,
      {
        missingColumn,
        omittedColumns: [...omittedColumns],
        ...warningContext,
        ...summarizeSupabaseError(error),
      },
    );
  }

  return {
    data: data || [],
    error: error || null,
    omittedColumns,
  };
}

function jsonError(status, error) {
  return NextResponse.json(
    {
      ok: false,
      error: error instanceof Error ? error.message : String(error || "Unknown error"),
    },
    { status },
  );
}

async function getAuthenticatedUser() {
  const cookieStore = await cookies();
  const { client } = createSupabaseServerClient(cookieStore);
  const { data, error } = await client.auth.getUser();

  if (error) {
    return {
      user: null,
      error,
    };
  }

  return {
    user: data.user ?? null,
    error: null,
  };
}

function normalizeCardRow(row) {
  return {
    id: String(row?.id || ""),
    deckId: String(row?.deck_id || ""),
    originalNoteId: row?.original_note_id ? String(row.original_note_id) : "",
    originalCardId: row?.original_card_id ? String(row.original_card_id) : "",
    originalOrder: Number(row?.original_order || 0),
    expression: row?.expression || "",
    reading: row?.reading || "",
    sentenceKana: row?.sentence_kana || "",
    sentenceEnglish: row?.sentence_english || "",
    hasSentenceAudio: Boolean(row?.sentence_audio_url),
    vocabKanji: row?.vocab_kanji || "",
    vocabFurigana: row?.vocab_furigana || "",
    vocabKana: row?.vocab_kana || "",
    vocabEnglish: row?.vocab_english || "",
    hasVocabAudio: Boolean(row?.vocab_audio_url),
    vocabPos: row?.vocab_pos || "",
    sentenceClozed: row?.sentence_clozed || "",
    coreIndex: row?.core_index,
    optimizedVocabIndex: row?.optimized_vocab_index,
    optimizedSentIndex: row?.optimized_sent_index,
    tags: row?.tags || "",
    notes: row?.notes || "",
    isAudioAvailable:
      typeof row?.is_audio_available === "boolean"
        ? row.is_audio_available
        : Boolean(row?.sentence_audio_url),
    createdAt: row?.created_at || null,
  };
}

function normalizeDeckRow(row, cards) {
  const normalizedCards = cards.map(normalizeCardRow);
  const totalCards = Number(row?.total_cards || normalizedCards.length || 0);
  const playableCount = normalizedCards.filter((card) => card.isAudioAvailable).length;

  return {
    id: String(row?.id || ""),
    name: row?.name || "Imported shadowing deck",
    importedAt: row?.created_at || null,
    createdAt: row?.created_at || null,
    noteCount: totalCards,
    totalCards,
    total_cards: totalCards,
    created_at: row?.created_at || null,
    playableCount,
    textOnlyCount: Math.max(0, totalCards - playableCount),
    cards: normalizedCards,
  };
}

function normalizeDeckListRow(row) {
  const totalCards = Number(row?.total_cards || 0);
  return {
    id: String(row?.id || ""),
    name: row?.name || "Imported shadowing deck",
    totalCards,
    total_cards: totalCards,
    noteCount: totalCards,
    importedAt: row?.created_at || null,
    createdAt: row?.created_at || null,
    created_at: row?.created_at || null,
  };
}

async function loadShadowingDeckList(adminClient, userId) {
  const { data: deckRows, error: decksError } = await adminClient
    .from("shadowing_decks")
    .select(SHADOWING_DECK_SELECT_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (decksError) {
    throw new Error(decksError.message || "Failed to load shadowing decks.");
  }

  return {
    decks: (deckRows || []).map(normalizeDeckListRow),
  };
}

async function loadShadowingDeck(adminClient, userId, deckId) {
  const [{ data: deckRow, error: deckError }, { data: cardRows, error: cardsError }] =
    await Promise.all([
      adminClient
        .from("shadowing_decks")
        .select(SHADOWING_DECK_SELECT_COLUMNS)
        .eq("id", deckId)
        .eq("user_id", userId)
        .maybeSingle(),
      runShadowingCardSelectQuery({
        adminClient,
        baseColumns: SHADOWING_CARD_BASE_SELECT_COLUMNS,
        warningContext: {
          userId,
          deckId,
          stage: "load-shadowing-deck",
        },
        queryBuilder: (query) =>
          query
            .eq("user_id", userId)
            .eq("deck_id", deckId)
            .order("original_order", { ascending: true }),
      }),
    ]);

  if (deckError) {
    throw new Error(deckError.message || "Failed to load the selected shadowing deck.");
  }

  if (!deckRow) {
    throw new Error("The selected shadowing deck could not be found.");
  }

  if (cardsError) {
    throw new Error(cardsError.message || "Failed to load shadowing cards.");
  }

  return {
    deck: normalizeDeckRow(deckRow, cardRows || []),
  };
}

async function uploadCardMedia(adminClient, userId, sourceFilename, checksum, card, zipEntries) {
  const mediaUploads = buildAudioUploadPayload(card, zipEntries);
  const result = {
    sentence_audio_url: null,
    vocab_audio_url: null,
    uploadedPaths: [],
    uploadedCount: 0,
    skippedCount: 0,
  };

  for (const upload of mediaUploads) {
    const uploadPath = buildStorageUploadPath({
      userId,
      sourceChecksum: checksum,
      originalFileName: sourceFilename,
      mediaFileName: upload.originalFileName,
      cardOrder: Number(card.original_order || 0) + 1,
      mediaType: upload.kind,
    });

    const { error } = await adminClient.storage
      .from(SHADOWING_MEDIA_BUCKET)
      .upload(uploadPath, upload.buffer, {
        contentType: upload.contentType,
        upsert: true,
      });

    if (error) {
      throw new Error(formatSupabaseErrorMessage(`Failed to upload ${upload.kind} audio.`, error));
    }

    result.uploadedPaths.push(uploadPath);
    result.uploadedCount += 1;

    if (upload.kind === "sentence") {
      result.sentence_audio_url = uploadPath;
    }

    if (upload.kind === "vocabulary") {
      result.vocab_audio_url = uploadPath;
    }
  }

  const expectedAudioUploads = Number(Boolean(card?.sentence_audio_source_name)) +
    Number(Boolean(card?.vocab_audio_source_name));
  result.skippedCount = Math.max(0, expectedAudioUploads - result.uploadedCount);

  return result;
}

async function cleanupUploadedShadowingMedia(adminClient, uploadedPaths = []) {
  const normalizedPaths = [...new Set((uploadedPaths || []).filter(Boolean))];
  if (!normalizedPaths.length) {
    return;
  }

  const { error } = await adminClient.storage
    .from(SHADOWING_MEDIA_BUCKET)
    .remove(normalizedPaths);

  if (error) {
    console.error("[Shadowing Import] Failed to clean up uploaded audio after import failure", {
      uploadedPathCount: normalizedPaths.length,
      ...summarizeSupabaseError(error),
    });
  }
}

async function ensureShadowingAudioBucket(adminClient) {
  const { data: existingBucket, error: getBucketError } = await adminClient.storage.getBucket(
    SHADOWING_MEDIA_BUCKET,
  );

  if (!getBucketError && existingBucket) {
    return true;
  }

  const bucketMissing =
    getBucketError?.message?.toLowerCase().includes("not found") ||
    getBucketError?.message?.toLowerCase().includes("bucket") ||
    getBucketError?.statusCode === 404;

  if (getBucketError && !bucketMissing) {
    throw new Error(getBucketError.message || "Failed to inspect shadowing audio storage bucket.");
  }

  const { error: createBucketError } = await adminClient.storage.createBucket(
    SHADOWING_MEDIA_BUCKET,
    {
      public: false,
      fileSizeLimit: 52_428_800,
      allowedMimeTypes: [
        "audio/mpeg",
        "audio/mp4",
        "audio/x-m4a",
        "audio/aac",
        "audio/wav",
        "audio/ogg",
        "audio/webm",
        "audio/flac",
      ],
    },
  );

  const alreadyExists =
    createBucketError?.message?.toLowerCase().includes("already exists") ||
    createBucketError?.message?.toLowerCase().includes("duplicate");

  if (createBucketError && !alreadyExists) {
    throw new Error(
      createBucketError.message || "Failed to create the shadowing audio storage bucket.",
    );
  }

  return true;
}

async function loadTargetDeckContext(adminClient, userId, targetDeckId) {
  if (!targetDeckId) {
    return null;
  }

  const { data: deckRow, error: deckError } = await adminClient
    .from("shadowing_decks")
    .select("id, user_id, name, total_cards")
    .eq("id", targetDeckId)
    .eq("user_id", userId)
    .maybeSingle();

  if (deckError) {
    throw new Error(deckError.message || "Failed to load target shadowing deck.");
  }

  if (!deckRow) {
    throw new Error("The selected shadowing deck could not be found.");
  }

  const { data: existingCards, error: cardsError } = await runShadowingCardSelectQuery({
    adminClient,
    baseColumns: "original_order",
    warningContext: {
      userId,
      deckId: targetDeckId,
      stage: "load-target-deck-context",
    },
    queryBuilder: (query) =>
      query
        .eq("deck_id", targetDeckId)
        .eq("user_id", userId)
        .order("original_order", { ascending: false }),
  });

  if (cardsError) {
    throw new Error(cardsError.message || "Failed to load the target deck card order.");
  }

  const duplicateTracker = createShadowingDuplicateTracker(existingCards || []);
  const highestOriginalOrder = (existingCards || []).reduce((highestValue, row) => {
    const parsedOrder = Number(row?.original_order);
    if (!Number.isFinite(parsedOrder)) {
      return highestValue;
    }

    return Math.max(highestValue, parsedOrder);
  }, -1);

  return {
    deckId: String(deckRow.id),
    totalCards: Number(deckRow.total_cards || 0),
    duplicateTracker,
    nextOriginalOrder: highestOriginalOrder >= 0 ? highestOriginalOrder + 1 : 0,
    name: deckRow.name || "",
  };
}

export async function GET(request) {
  try {
    const { user, error } = await getAuthenticatedUser();
    if (error || !user?.id) {
      return jsonError(401, error || new Error("You need to sign in to load shadowing decks."));
    }

    const adminClient = getSupabaseAdminClient();
    const deckId = String(request.nextUrl.searchParams.get("deckId") || "").trim();
    const payload = deckId
      ? await loadShadowingDeck(adminClient, user.id, deckId)
      : await loadShadowingDeckList(adminClient, user.id);

    return NextResponse.json({
      ok: true,
      ...payload,
    });
  } catch (error) {
    return jsonError(500, error);
  }
}

export async function POST(request) {
  try {
    const { user, error } = await getAuthenticatedUser();
    if (error || !user?.id) {
      return jsonError(401, error || new Error("You need to sign in to import shadowing decks."));
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const requestedDeckId = String(formData.get("targetDeckId") || "").trim();
    const requestedDeckName = String(formData.get("deckName") || "").trim();
    const importMode = requestedDeckId ? "existing" : "new";

    if (!(file instanceof File)) {
      return jsonError(400, new Error("Missing .apkg file."));
    }

    if (!String(file.name || "").toLowerCase().endsWith(".apkg")) {
      return jsonError(400, new Error("Only .apkg imports are supported."));
    }

    const parsedDeck = await parseApkgShadowingDeck(file.name, await file.arrayBuffer());
    logShadowingImportDebug("parsed notes count", {
      fileName: file.name,
      parsedNoteCount: parsedDeck.cards.length,
    });
    if (!parsedDeck.cards.length) {
      return jsonError(400, new Error("No notes were found in this .apkg file."));
    }

    const adminClient = getSupabaseAdminClient();
    await ensureShadowingAudioBucket(adminClient);
    const targetDeckContext =
      importMode === "existing"
        ? await loadTargetDeckContext(adminClient, user.id, requestedDeckId)
        : null;
    const deckId = targetDeckContext?.deckId || randomUUID();
    const originalOrderOffset = targetDeckContext?.nextOriginalOrder || 0;
    const deckName =
      requestedDeckName || targetDeckContext?.name || parsedDeck.deckName || "Imported shadowing deck";
    const duplicateTracker =
      targetDeckContext?.duplicateTracker || createShadowingDuplicateTracker();
    const cardsToImport = [];
    const uploadedPaths = [];
    let uploadedAudioCount = 0;
    let skippedAudioCount = 0;
    let deckRowCreated = false;

    for (const parsedCard of parsedDeck.cards) {
      const finalOriginalOrder = originalOrderOffset + Number(parsedCard.original_order || 0);
      const candidateCard = {
        ...parsedCard,
        original_order: finalOriginalOrder,
      };

      if (shouldSkipShadowingCard(duplicateTracker, candidateCard)) {
        continue;
      }

      rememberShadowingCard(duplicateTracker, candidateCard);
      cardsToImport.push(candidateCard);
    }

    const cardPayloads = [];
    const importTimestamp = new Date().toISOString();

    try {
      if (!targetDeckContext) {
        const { error: deckInsertError } = await adminClient.from("shadowing_decks").insert({
          id: deckId,
          user_id: user.id,
          name: deckName,
          total_cards: 0,
          created_at: importTimestamp,
        });

        if (deckInsertError) {
          throw new Error(
            formatSupabaseErrorMessage(
              "Failed to create the shadowing deck before importing cards.",
              deckInsertError,
            ),
          );
        }

        deckRowCreated = true;
      }

      logShadowingImportDebug("created deck id", {
        deckId,
        importMode,
        createdNewDeck: deckRowCreated,
        dedupedCardCount: cardsToImport.length,
      });

      for (const parsedCard of cardsToImport) {
        const uploadedMedia = await uploadCardMedia(
          adminClient,
          user.id,
          file.name,
          parsedDeck.checksum,
          parsedCard,
          parsedDeck.zipEntries,
        );

        uploadedPaths.push(...uploadedMedia.uploadedPaths);
        uploadedAudioCount += uploadedMedia.uploadedCount;
        skippedAudioCount += uploadedMedia.skippedCount;

        cardPayloads.push({
          deck_id: deckId,
          user_id: user.id,
          original_note_id: parsedCard.original_note_id,
          original_card_id: parsedCard.original_card_id,
          original_order: parsedCard.original_order,
          expression: parsedCard.expression,
          reading: parsedCard.reading,
          sentence_kana: parsedCard.sentence_kana,
          sentence_english: parsedCard.sentence_english,
          sentence_audio_url: uploadedMedia.sentence_audio_url,
          vocab_kanji: parsedCard.vocab_kanji,
          vocab_furigana: parsedCard.vocab_furigana,
          vocab_kana: parsedCard.vocab_kana,
          vocab_english: parsedCard.vocab_english,
          vocab_audio_url: uploadedMedia.vocab_audio_url,
          vocab_pos: parsedCard.vocab_pos,
          sentence_clozed: parsedCard.sentence_clozed,
          core_index: parsedCard.core_index,
          optimized_vocab_index: parsedCard.optimized_vocab_index,
          optimized_sent_index: parsedCard.optimized_sent_index,
          tags: parsedCard.tags,
          notes: parsedCard.notes,
          is_audio_available: Boolean(uploadedMedia.sentence_audio_url || parsedCard.is_audio_available),
          created_at: importTimestamp,
        });
      }

      logShadowingImportDebug("uploaded/skipped audio count", {
        deckId,
        uploadedAudioCount,
        skippedAudioCount,
        uploadedPathCount: uploadedPaths.length,
      });

      const noteCount = cardPayloads.length;
      let cardsInsertError = null;
      if (cardPayloads.length) {
        const omittedColumns = new Set();

        while (true) {
          const insertPayloads = omitPayloadKeys(cardPayloads, omittedColumns);
          ({ error: cardsInsertError } = await adminClient.from("shadowing_cards").insert(insertPayloads));

          if (!cardsInsertError) {
            break;
          }

          const missingColumn = findMissingShadowingIdColumn(cardsInsertError);
          if (!missingColumn || omittedColumns.has(missingColumn)) {
            break;
          }

          omittedColumns.add(missingColumn);
          console.warn(
            `[Shadowing] shadowing_cards.${missingColumn} is missing during import. Retrying without that optional column. Run the latest Supabase migrations to preserve original import metadata.`,
            {
              userId: user.id,
              deckId,
              missingColumn,
              omittedColumns: [...omittedColumns],
              ...summarizeSupabaseError(cardsInsertError),
            },
          );
        }
      }

      if (cardsInsertError) {
        logShadowingImportDebug("failed insert error details", {
          deckId,
          insertedCardCount: 0,
          attemptedCardCount: cardPayloads.length,
          ...summarizeSupabaseError(cardsInsertError),
        });
        throw new Error(
          formatSupabaseErrorMessage("Failed to insert shadowing cards.", cardsInsertError),
        );
      }

      logShadowingImportDebug("inserted card count", {
        deckId,
        insertedCardCount: cardPayloads.length,
      });

      if (targetDeckContext) {
        const { error: deckUpdateError } = await adminClient
          .from("shadowing_decks")
          .update({
            total_cards: targetDeckContext.totalCards + noteCount,
            name: deckName,
          })
          .eq("id", deckId)
          .eq("user_id", user.id);

        if (deckUpdateError) {
          throw new Error(
            formatSupabaseErrorMessage(
              "Failed to update the target shadowing deck after card import.",
              deckUpdateError,
            ),
          );
        }
      } else {
        const { error: deckUpdateError } = await adminClient
          .from("shadowing_decks")
          .update({
            total_cards: noteCount,
            name: deckName,
          })
          .eq("id", deckId)
          .eq("user_id", user.id);

        if (deckUpdateError) {
          throw new Error(
            formatSupabaseErrorMessage(
              "Failed to finalize the imported shadowing deck.",
              deckUpdateError,
            ),
          );
        }
      }
    } catch (importError) {
      await cleanupUploadedShadowingMedia(adminClient, uploadedPaths);

      if (targetDeckContext) {
        await adminClient
          .from("shadowing_cards")
          .delete()
          .eq("deck_id", deckId)
          .eq("user_id", user.id)
          .eq("created_at", importTimestamp);
      } else if (deckRowCreated) {
        await adminClient
          .from("shadowing_decks")
          .delete()
          .eq("id", deckId)
          .eq("user_id", user.id);
      }

      throw importError;
    }

    const payload = await loadShadowingDeckList(adminClient, user.id);
    return NextResponse.json({
      ok: true,
      importedDeckId: deckId,
      ...payload,
    });
  } catch (error) {
    return jsonError(500, error);
  }
}

export async function PATCH(request) {
  try {
    const { user, error } = await getAuthenticatedUser();
    if (error || !user?.id) {
      return jsonError(401, error || new Error("You need to sign in to update shadowing decks."));
    }

    const payload = await request.json().catch(() => ({}));
    const deckId = String(payload?.deckId || "").trim();
    const deckName = String(payload?.deckName || "").trim();

    if (!deckId || !deckName) {
      return jsonError(400, new Error("Missing deck id or deck name."));
    }

    const adminClient = getSupabaseAdminClient();
    const { error: updateError } = await adminClient
      .from("shadowing_decks")
      .update({
        name: deckName,
      })
      .eq("id", deckId)
      .eq("user_id", user.id);

    if (updateError) {
      return jsonError(500, updateError);
    }

    const payloadResponse = await loadShadowingDeckList(adminClient, user.id);
    return NextResponse.json({
      ok: true,
      updatedDeckId: deckId,
      ...payloadResponse,
    });
  } catch (error) {
    return jsonError(500, error);
  }
}
