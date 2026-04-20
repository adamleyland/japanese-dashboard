import { READING_FILTERS } from "@/lib/reading/constants";

function toTimestamp(value) {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function sortReadingItems(items) {
  return [...items].sort((left, right) => {
    const statusRank = { current: 0, queued: 1, completed: 2 };
    const statusDifference = (statusRank[left.status] ?? 99) - (statusRank[right.status] ?? 99);

    if (statusDifference) {
      return statusDifference;
    }

    const rightTimestamp = toTimestamp(right.updatedAt || right.finishedAt || right.startedAt);
    const leftTimestamp = toTimestamp(left.updatedAt || left.finishedAt || left.startedAt);

    if (rightTimestamp !== leftTimestamp) {
      return rightTimestamp - leftTimestamp;
    }

    return left.title.localeCompare(right.title, undefined, { sensitivity: "base" });
  });
}

export function getVisibleReadingItems(items, filterKey) {
  const sortedItems = sortReadingItems(items);

  if (filterKey === "completed") {
    return sortedItems.filter((item) => item.status === "completed");
  }

  if (filterKey === "queued") {
    return sortedItems.filter((item) => item.status === "queued");
  }

  return sortedItems.filter((item) => item.status === "current");
}

export function getReadingCounts(items) {
  return READING_FILTERS.reduce((counts, filter) => {
    counts[filter.key] = getVisibleReadingItems(items, filter.key).length;
    return counts;
  }, {});
}

export function getCurrentlyReadingItem(items) {
  const currentItems = getVisibleReadingItems(items, "current");

  if (currentItems.length) {
    return currentItems[0];
  }

  return null;
}

