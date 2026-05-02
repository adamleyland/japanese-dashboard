import "server-only";

const SHADOWING_IMPORT_STATUS_STORE_KEY = "__jp_shadowing_import_status_store__";
const STATUS_TTL_MS = 30 * 60 * 1000;

function getStatusStore() {
  if (!globalThis[SHADOWING_IMPORT_STATUS_STORE_KEY]) {
    globalThis[SHADOWING_IMPORT_STATUS_STORE_KEY] = new Map();
  }

  cleanupExpiredStatuses(globalThis[SHADOWING_IMPORT_STATUS_STORE_KEY]);
  return globalThis[SHADOWING_IMPORT_STATUS_STORE_KEY];
}

function cleanupExpiredStatuses(store) {
  const now = Date.now();

  for (const [sessionId, status] of store.entries()) {
    if (!status?.updatedAt || now - status.updatedAt > STATUS_TTL_MS) {
      store.delete(sessionId);
    }
  }
}

function normalizeSessionId(value) {
  return String(value || "").trim();
}

function computeProgressPercent(status) {
  if (Number.isFinite(status?.progressPercent)) {
    return Math.max(0, Math.min(100, Number(status.progressPercent)));
  }

  if (status?.stage === "completed") {
    return 100;
  }

  if (status?.stage === "saving-cards") {
    return 99;
  }

  const totalCards = Number(status?.totalCards || 0);
  const processedCards = Math.max(
    Number(status?.processedCards || 0),
    Number(status?.currentCard || 0),
  );

  if (status?.stage === "parsed") {
    return 8;
  }

  if (status?.stage === "importing" && totalCards > 0) {
    const fraction = Math.max(0, Math.min(1, processedCards / totalCards));
    return Number((10 + fraction * 88).toFixed(2));
  }

  if (totalCards > 0) {
    return Number(Math.max(0, Math.min(99, (processedCards / totalCards) * 100)).toFixed(2));
  }

  return 0;
}

function normalizeStatusSnapshot(status) {
  if (!status) {
    return null;
  }

  return {
    ...status,
    progressPercent: computeProgressPercent(status),
  };
}

export function createShadowingImportStatus({
  sessionId,
  userId,
  fileName = "",
  statusText = "Preparing import...",
} = {}) {
  const normalizedSessionId = normalizeSessionId(sessionId);
  if (!normalizedSessionId) {
    return null;
  }

  const store = getStatusStore();
  const snapshot = {
    sessionId: normalizedSessionId,
    userId: String(userId || "").trim(),
    fileName: String(fileName || ""),
    deckId: "",
    stage: "preparing",
    statusText,
    totalCards: 0,
    processedCards: 0,
    currentCard: 0,
    uploadedAudioCount: 0,
    skippedAudioCount: 0,
    importedDeckId: "",
    error: "",
    isError: false,
    isComplete: false,
    updatedAt: Date.now(),
  };

  store.set(normalizedSessionId, snapshot);
  return normalizeStatusSnapshot(snapshot);
}

export function updateShadowingImportStatus(sessionId, patch = {}) {
  const normalizedSessionId = normalizeSessionId(sessionId);
  if (!normalizedSessionId) {
    return null;
  }

  const store = getStatusStore();
  const existingStatus = store.get(normalizedSessionId);
  if (!existingStatus) {
    return null;
  }

  const nextStatus = {
    ...existingStatus,
    ...patch,
    updatedAt: Date.now(),
  };

  if (!Object.prototype.hasOwnProperty.call(patch, "progressPercent")) {
    delete nextStatus.progressPercent;
  }

  store.set(normalizedSessionId, nextStatus);
  return normalizeStatusSnapshot(nextStatus);
}

export function completeShadowingImportStatus(sessionId, patch = {}) {
  return updateShadowingImportStatus(sessionId, {
    stage: "completed",
    isComplete: true,
    isError: false,
    error: "",
    ...patch,
    progressPercent: 100,
  });
}

export function failShadowingImportStatus(sessionId, patch = {}) {
  return updateShadowingImportStatus(sessionId, {
    stage: "failed",
    isComplete: false,
    isError: true,
    ...patch,
  });
}

export function readShadowingImportStatus(sessionId, userId = "") {
  const normalizedSessionId = normalizeSessionId(sessionId);
  if (!normalizedSessionId) {
    return null;
  }

  const store = getStatusStore();
  const snapshot = store.get(normalizedSessionId);
  if (!snapshot) {
    return null;
  }

  const normalizedUserId = String(userId || "").trim();
  if (normalizedUserId && snapshot.userId && snapshot.userId !== normalizedUserId) {
    return null;
  }

  return normalizeStatusSnapshot(snapshot);
}

export function clearShadowingImportStatus(sessionId, userId = "") {
  const normalizedSessionId = normalizeSessionId(sessionId);
  if (!normalizedSessionId) {
    return false;
  }

  const store = getStatusStore();
  const snapshot = store.get(normalizedSessionId);
  if (!snapshot) {
    return false;
  }

  const normalizedUserId = String(userId || "").trim();
  if (normalizedUserId && snapshot.userId && snapshot.userId !== normalizedUserId) {
    return false;
  }

  store.delete(normalizedSessionId);
  return true;
}
