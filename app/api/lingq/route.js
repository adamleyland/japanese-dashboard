import rakutenImageUtils from "@/lib/rakutenImage";
import { buildLingQLessonUrl } from "@/lib/reading/lingq";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const { getHighResRakutenImage } = rakutenImageUtils;

export async function GET() {
  const token = process.env.LINGQ_API_KEY;

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
      fetchedAt: new Date().toISOString(),
    });
  }

  const headers = {
    Authorization: `Token ${token}`,
    Accept: "application/json",
  };

  try {
    const [statsRes, recentRes] = await Promise.all([
      fetch("https://www.lingq.com/api/v2/ja/progress/?interval=all_time", {
        headers,
        cache: "no-store",
      }),
      fetch(
        "https://www.lingq.com/api/v2/ja/lessons/recent/?page_size=1&groupBy=collection&page=1",
        {
          headers,
          cache: "no-store",
        },
      ),
    ]);

    if (!statsRes.ok || !recentRes.ok) {
      return new Response(JSON.stringify({ error: "LingQ API failed" }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }

    const stats = await statsRes.json();
    const recent = await recentRes.json();
    const lesson = recent?.results?.[0];
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

      if (!collectionRes.ok) {
        return new Response(JSON.stringify({ error: "LingQ API failed" }), {
          status: 500,
          headers: {
            "Content-Type": "application/json",
          },
        });
      }

      collection = await collectionRes.json();
    }

    const wordsRead = typeof stats?.readWords === "number" ? stats.readWords : 0;

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
