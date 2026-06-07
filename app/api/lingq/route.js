import rakutenImageUtils from "@/lib/rakutenImage";
import {
  buildLingQApiHeaders,
  buildLingQLessonUrl,
  extractLingQReadingChartWords,
  extractLingQWordsRead,
  getLingQApiToken,
} from "@/lib/reading/lingq";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const { getHighResRakutenImage } = rakutenImageUtils;

async function fetchJson(url, headers) {
  const response = await fetch(url, {
    headers,
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));

  return { response, payload };
}

export async function GET() {
  const token = getLingQApiToken();

  if (!token) {
    return Response.json({
      configured: false,
      wordsRead: null,
      estimatedReadingHours: null,
      bookTitle: null,
      chapterTitle: null,
      bookImage: null,
      bookProgress: null,
      lessonId: null,
      lessonUrl: null,
      source: "lingq",
      message: "Add LINGQ_API_KEY to enable automatic words-read totals.",
      fetchedAt: new Date().toISOString(),
    });
  }

  const headers = buildLingQApiHeaders();

  try {
    const [chartStatsResult, recentRes] = await Promise.all([
      fetchJson(
        "https://www.lingq.com/api/v3/ja/progress/chart_data/?metric=reading&period=all",
        headers,
      ),
      fetch(
        "https://www.lingq.com/api/v2/ja/lessons/recent/?page_size=1&groupBy=collection&page=1",
        {
          headers,
          cache: "no-store",
        },
      ),
    ]);

    let stats = chartStatsResult.payload;
    let statsRes = chartStatsResult.response;
    let wordsRead = statsRes.ok ? extractLingQReadingChartWords(stats) : null;

    if (!statsRes.ok || wordsRead === null) {
      const progressStatsResult = await fetchJson(
        "https://www.lingq.com/api/v2/ja/progress/?interval=all_time",
        headers,
      );
      const fallbackWordsRead = progressStatsResult.response.ok
        ? extractLingQWordsRead(progressStatsResult.payload)
        : null;

      if (fallbackWordsRead !== null) {
        stats = progressStatsResult.payload;
        statsRes = progressStatsResult.response;
        wordsRead = fallbackWordsRead;
      } else if (!statsRes.ok) {
        stats = progressStatsResult.payload;
        statsRes = progressStatsResult.response;
      }
    }

    if (!statsRes.ok || wordsRead === null) {
      const lingqMessage = stats?.detail || stats?.error || stats?.message || "LingQ API failed";
      const error =
        statsRes.status === 401
          ? "LingQ rejected LINGQ_API_KEY. Generate a fresh LingQ API key, update .env.local, then restart the dev server."
          : wordsRead === null
            ? "LingQ did not return a readable words-read total."
            : lingqMessage;

      return Response.json(
        {
          configured: true,
          error,
          status: statsRes.status,
          source: "lingq",
          fetchedAt: new Date().toISOString(),
        },
        { status: statsRes.ok ? 502 : statsRes.status || 502 },
      );
    }

    const recent = recentRes.ok ? await recentRes.json().catch(() => ({})) : {};
    const lesson = recent?.results?.[0] ?? null;
    const collectionId = lesson?.collectionId;
    const lessonId = Number(lesson?.contentId);
    let collection = null;

    if (collectionId) {
      const collectionRes = await fetch(
        `https://www.lingq.com/api/v2/ja/collections/${collectionId}/`,
        {
          headers,
          cache: "no-store",
        },
      );

      if (collectionRes.ok) {
        collection = await collectionRes.json().catch(() => null);
      }
    }

    return Response.json({
      configured: true,
      wordsRead,
      estimatedReadingHours: Math.floor(wordsRead / (125 * 60)),
      bookTitle: collection?.title ?? null,
      chapterTitle: lesson?.title ?? null,
      bookImage: getHighResRakutenImage(collection?.imageUrl ?? null),
      bookProgress:
        typeof collection?.completedRatio === "number"
          ? collection.completedRatio
          : null,
      lessonId: Number.isFinite(lessonId) && lessonId > 0 ? lessonId : null,
      lessonUrl: buildLingQLessonUrl({
        lessonId,
        language: "ja",
        displayLanguage: "en",
        lessonUrl: lesson?.url ?? lesson?.lessonUrl ?? null,
      }),
      source: "lingq",
      fetchedAt: new Date().toISOString(),
    });
  } catch {
    return new Response(JSON.stringify({ error: "LingQ API failed" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}
