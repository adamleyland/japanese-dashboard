"use client";

export const MOCK_AUDIOBOOKS = [
  {
    id: "convenience-store-woman",
    title: "Convenience Store Woman",
    author: "Sayaka Murata",
    narrator: "Misaki Tanaka",
    durationSeconds: 26400,
    progressSeconds: 7320,
    description:
      "A quiet, observant character study with everyday language and a steady, intimate rhythm.",
    coverGradient: "linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)",
    accentColor: "#fbbf24",
    chapters: [
      { id: "csw-1", title: "Shift Start", startSeconds: 0 },
      { id: "csw-2", title: "Routine", startSeconds: 4800 },
      { id: "csw-3", title: "The Proposal", startSeconds: 13200 },
    ],
  },
  {
    id: "before-the-coffee-gets-cold",
    title: "Before the Coffee Gets Cold",
    author: "Toshikazu Kawaguchi",
    narrator: "Aoi Nakamura",
    durationSeconds: 22800,
    progressSeconds: 0,
    description:
      "Warm, dialogue-heavy storytelling that works well for repeated listening and shadowing.",
    coverGradient: "linear-gradient(135deg, #0ea5e9 0%, #4f46e5 100%)",
    accentColor: "#38bdf8",
    chapters: [
      { id: "btcgc-1", title: "The Cafe", startSeconds: 0 },
      { id: "btcgc-2", title: "The Lovers", startSeconds: 5100 },
      { id: "btcgc-3", title: "The Sisters", startSeconds: 12600 },
    ],
  },
  {
    id: "kikis-delivery-service",
    title: "Kiki's Delivery Service",
    author: "Eiko Kadono",
    narrator: "Rina Ogawa",
    durationSeconds: 24900,
    progressSeconds: 3900,
    description:
      "Light fantasy with clear scene transitions, ideal for relaxed extensive listening sessions.",
    coverGradient: "linear-gradient(135deg, #10b981 0%, #14b8a6 100%)",
    accentColor: "#34d399",
    chapters: [
      { id: "kiki-1", title: "Leaving Home", startSeconds: 0 },
      { id: "kiki-2", title: "A New City", startSeconds: 6600 },
      { id: "kiki-3", title: "Growing Confidence", startSeconds: 14400 },
    ],
  },
  {
    id: "the-miracles-of-the-namiya-general-store",
    title: "The Miracles of the Namiya General Store",
    author: "Keigo Higashino",
    narrator: "Daichi Mori",
    durationSeconds: 38100,
    progressSeconds: 0,
    description:
      "Long-form narrative with multiple threads, useful for building stamina and context retention.",
    coverGradient: "linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)",
    accentColor: "#c084fc",
    chapters: [
      { id: "namiya-1", title: "The Letter Box", startSeconds: 0 },
      { id: "namiya-2", title: "The Rabbit", startSeconds: 10800 },
      { id: "namiya-3", title: "Echoes", startSeconds: 24600 },
    ],
  },
  {
    id: "sweet-bean-paste",
    title: "Sweet Bean Paste",
    author: "Durian Sukegawa",
    narrator: "Mao Fujita",
    durationSeconds: 21000,
    progressSeconds: 1200,
    description:
      "Gentle pacing and emotional dialogue make it a strong fit for comprehension-focused listening.",
    coverGradient: "linear-gradient(135deg, #f97316 0%, #fb7185 100%)",
    accentColor: "#fb923c",
    chapters: [
      { id: "sbp-1", title: "Dorayaki Stand", startSeconds: 0 },
      { id: "sbp-2", title: "Tokue", startSeconds: 5700 },
      { id: "sbp-3", title: "Spring Returns", startSeconds: 13800 },
    ],
  },
  {
    id: "lonely-castle-in-the-mirror",
    title: "Lonely Castle in the Mirror",
    author: "Mizuki Tsujimura",
    narrator: "Haru Saito",
    durationSeconds: 43200,
    progressSeconds: 0,
    description:
      "A longer immersive listen with plenty of room for future chapter and bookmark features.",
    coverGradient: "linear-gradient(135deg, #22c55e 0%, #06b6d4 100%)",
    accentColor: "#5eead4",
    chapters: [
      { id: "castle-1", title: "The Mirror", startSeconds: 0 },
      { id: "castle-2", title: "Seven Keys", startSeconds: 12600 },
      { id: "castle-3", title: "The Deadline", startSeconds: 28500 },
    ],
  },
];
