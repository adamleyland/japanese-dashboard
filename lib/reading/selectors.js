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
    const rightCreatedAt = toTimestamp(right.createdAt);
    const leftCreatedAt = toTimestamp(left.createdAt);

    if (rightCreatedAt !== leftCreatedAt) {
      return rightCreatedAt - leftCreatedAt;
    }

    const rightUpdatedAt = toTimestamp(right.updatedAt);
    const leftUpdatedAt = toTimestamp(left.updatedAt);

    if (rightUpdatedAt !== leftUpdatedAt) {
      return rightUpdatedAt - leftUpdatedAt;
    }

    return left.title.localeCompare(right.title, undefined, { sensitivity: "base" });
  });
}

export function getVisibleReadingItems(items, filterKey) {
  const sortedItems = sortReadingItems(items);

  if (filterKey === "all") {
    return sortedItems;
  }

  return sortedItems.filter((item) => item.status === filterKey);
}

export function getReadingCounts(items) {
  const counts = READING_FILTERS.reduce((result, filter) => {
    result[filter.key] = filter.key === "all" ? items.length : 0;
    return result;
  }, {});

  items.forEach((item) => {
    if (typeof counts[item.status] === "number") {
      counts[item.status] += 1;
    }
  });

  return counts;
}

export function getCurrentlyReadingItem(items) {
  const currentItems = getVisibleReadingItems(items, "in_progress");

  if (currentItems.length) {
    return currentItems[0];
  }

  return null;
}
