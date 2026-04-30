import { DEFAULT_SHADOWING_SETTINGS } from "@/lib/shadowing/constants";

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizedComparableIndex(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

function shuffleCards(cards) {
  const nextCards = [...cards];

  for (let index = nextCards.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [nextCards[index], nextCards[randomIndex]] = [nextCards[randomIndex], nextCards[index]];
  }

  return nextCards;
}

export function normalizeShadowingSettings(settings = {}) {
  return {
    sentenceCount: Math.max(1, Math.floor(toNumber(settings.sentenceCount, DEFAULT_SHADOWING_SETTINGS.sentenceCount))),
    repetitions: Math.max(1, Math.floor(toNumber(settings.repetitions, DEFAULT_SHADOWING_SETTINGS.repetitions))),
    repeatGapSeconds: Math.max(0, toNumber(settings.repeatGapSeconds, DEFAULT_SHADOWING_SETTINGS.repeatGapSeconds)),
    sentenceGapSeconds: Math.max(0, toNumber(settings.sentenceGapSeconds, DEFAULT_SHADOWING_SETTINGS.sentenceGapSeconds)),
    shuffle: Boolean(settings.shuffle),
    showEnglish:
      typeof settings.showEnglish === "boolean"
        ? settings.showEnglish
        : DEFAULT_SHADOWING_SETTINGS.showEnglish,
    showReading:
      typeof settings.showReading === "boolean"
        ? settings.showReading
        : DEFAULT_SHADOWING_SETTINGS.showReading,
    sortMode:
      typeof settings.sortMode === "string" && settings.sortMode
        ? settings.sortMode
        : DEFAULT_SHADOWING_SETTINGS.sortMode,
  };
}

export function getPlayableShadowingCards(cards) {
  return (Array.isArray(cards) ? cards : []).filter((card) => card?.isAudioAvailable);
}

export function buildShadowingQueue(cards, settings = {}) {
  const normalizedSettings = normalizeShadowingSettings(settings);
  const playableCards = getPlayableShadowingCards(cards);
  let orderedCards = [...playableCards];

  if (normalizedSettings.sortMode === "core-index") {
    orderedCards.sort((left, right) => {
      const leftIndex = normalizedComparableIndex(left?.coreIndex);
      const rightIndex = normalizedComparableIndex(right?.coreIndex);
      if (leftIndex !== rightIndex) {
        return leftIndex - rightIndex;
      }

      return toNumber(left?.originalOrder) - toNumber(right?.originalOrder);
    });
  } else if (normalizedSettings.sortMode === "optimized-sent-index") {
    orderedCards.sort((left, right) => {
      const leftIndex = normalizedComparableIndex(left?.optimizedSentIndex);
      const rightIndex = normalizedComparableIndex(right?.optimizedSentIndex);
      if (leftIndex !== rightIndex) {
        return leftIndex - rightIndex;
      }

      return toNumber(left?.originalOrder) - toNumber(right?.originalOrder);
    });
  } else if (normalizedSettings.sortMode === "random") {
    orderedCards = shuffleCards(orderedCards);
  } else {
    orderedCards.sort((left, right) => toNumber(left?.originalOrder) - toNumber(right?.originalOrder));
  }

  if (normalizedSettings.shuffle && normalizedSettings.sortMode !== "random") {
    orderedCards = shuffleCards(orderedCards);
  }

  return orderedCards.slice(0, normalizedSettings.sentenceCount);
}

export function calculateShadowingProgress(currentIndex, currentRepetition, totalCards, totalRepetitions) {
  if (!totalCards || !totalRepetitions) {
    return 0;
  }

  const boundedIndex = Math.max(0, Math.min(totalCards - 1, Number(currentIndex) || 0));
  const boundedRepetition = Math.max(1, Math.min(totalRepetitions, Number(currentRepetition) || 1));
  const completedSteps = boundedIndex * totalRepetitions + (boundedRepetition - 1);
  const totalSteps = totalCards * totalRepetitions;

  return Math.max(0, Math.min(100, (completedSteps / totalSteps) * 100));
}

export function formatShadowingHours(hours) {
  const normalizedHours = Math.max(0, Number(hours) || 0);
  const wholeHours = Math.floor(normalizedHours);
  const minutes = Math.round((normalizedHours - wholeHours) * 60);

  if (!wholeHours) {
    return `${minutes}m`;
  }

  return `${wholeHours}h ${minutes}m`;
}
