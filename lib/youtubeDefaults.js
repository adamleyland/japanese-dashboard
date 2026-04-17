export const DEFAULT_VIDEO_ID = "M7lc1UVf-VE";
export const DEFAULT_DISCOVER_FILTER = "\u30b2\u30fc\u30e0";
export const DISCOVER_FILTERS = {
  [DEFAULT_DISCOVER_FILTER]: "\u65e5\u672c \u30b2\u30fc\u30e0 \u5b9f\u6cc1",
  "\u65c5\u884c": "\u65e5\u672c \u65c5\u884c vlog",
  "\u65e5\u672c\u8a9e": "\u65e5\u672c\u8a9e \u52c9\u5f37",
};
export const DISCOVER_FILTER_OPTIONS = Object.keys(DISCOVER_FILTERS);
export const MINIMUM_VIDEO_LENGTH_SECONDS = 90;

export const SEEDED_CHANNELS = [
  { id: "c1", name: "Nihongo no Mori", category: "JLPT" },
  { id: "c2", name: "Comprehensible Japanese", category: "Immersion" },
  { id: "c3", name: "Japanese Ammo with Misa", category: "Grammar" },
  { id: "c4", name: "YUYU\u306e\u65e5\u672c\u8a9ePodcast", category: "Podcast" },
];

export const SEEDED_VIDEOS = [
  {
    id: "nBJ5dhjR3mY",
    title: "Learn Japanese with Real Conversations",
    channel: "Comprehensible Japanese",
    duration: "18:43",
    level: "N4-N3",
    published: "2 weeks ago",
  },
  {
    id: "B4fI6UC6W8A",
    title: "Shadowing Japanese: Daily Routine",
    channel: "Nihongo no Mori",
    duration: "12:08",
    level: "N3",
    published: "1 month ago",
  },
  {
    id: "M4g8QHkM4mY",
    title: "Japanese Listening Practice for Beginners",
    channel: "Japanese Ammo with Misa",
    duration: "22:31",
    level: "N5-N4",
    published: "3 days ago",
  },
  {
    id: "YfS0xvAcf3Q",
    title: "Slow Japanese Podcast - Tokyo Life",
    channel: "YUYU\u306e\u65e5\u672c\u8a9ePodcast",
    duration: "16:19",
    level: "N4",
    published: "6 days ago",
  },
];

export function normalizeSeededChannels() {
  return SEEDED_CHANNELS.map((channel) => ({
    ...channel,
    channelId: channel.id,
    thumbnail: channel.thumbnail || "",
    enabled: channel.enabled ?? true,
  }));
}
