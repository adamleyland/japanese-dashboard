const RAKUTEN_IMAGE_SIZE = "600x600";
const RAKUTEN_IMAGE_PARAM = `_ex=${RAKUTEN_IMAGE_SIZE}`;

function isRakutenImageUrl(url) {
  if (typeof url !== "string") {
    return false;
  }

  const trimmedUrl = url.trim();
  if (!trimmedUrl) {
    return false;
  }

  try {
    return new URL(trimmedUrl).hostname.toLowerCase().includes("rakuten");
  } catch {
    return trimmedUrl.toLowerCase().includes("rakuten");
  }
}

function getHighResRakutenImage(url) {
  if (typeof url !== "string") {
    return url;
  }

  const trimmedUrl = url.trim();
  if (!trimmedUrl || !isRakutenImageUrl(trimmedUrl)) {
    return trimmedUrl || url;
  }

  if (trimmedUrl.includes("_ex=")) {
    return trimmedUrl.replace(/_ex=\d+x\d+/i, RAKUTEN_IMAGE_PARAM);
  }

  return trimmedUrl.includes("?")
    ? `${trimmedUrl}&${RAKUTEN_IMAGE_PARAM}`
    : `${trimmedUrl}?${RAKUTEN_IMAGE_PARAM}`;
}

module.exports = {
  RAKUTEN_IMAGE_SIZE,
  getHighResRakutenImage,
  isRakutenImageUrl,
};
