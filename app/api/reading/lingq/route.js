import { NextResponse } from "next/server";
import {
  buildLingQHeaders,
  extractLingQWordsRead,
  getLingQConfigurationState,
} from "@/lib/reading/lingq";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const configuration = getLingQConfigurationState();

  if (!configuration.configured) {
    return NextResponse.json({
      configured: false,
      totalWordsRead: null,
      source: "lingq",
      message: "Add LINGQ_STATS_URL to enable LingQ reading sync.",
      fetchedAt: new Date().toISOString(),
    });
  }

  try {
    const response = await fetch(configuration.endpoint, {
      method: "GET",
      headers: buildLingQHeaders(),
      cache: "no-store",
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        {
          configured: true,
          error: payload?.error || payload?.message || "LingQ request failed.",
        },
        { status: response.status || 502 },
      );
    }

    const totalWordsRead = extractLingQWordsRead(payload);

    return NextResponse.json({
      configured: true,
      totalWordsRead,
      source: "lingq",
      fetchedAt: new Date().toISOString(),
      rawAvailable: totalWordsRead !== null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        configured: true,
        error: error instanceof Error ? error.message : "Failed to load LingQ stats.",
      },
      { status: 500 },
    );
  }
}
