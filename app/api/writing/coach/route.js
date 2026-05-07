import { NextResponse } from "next/server";
import { getOptionalServerEnv, getRequiredServerEnv } from "@/lib/serverEnv";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "google/gemma-4-31b-it:free";
const FEEDBACK_FALLBACK_MODELS = [
  "openrouter/free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
  "google/gemma-3-27b-it:free",
  "google/gemma-3-12b-it:free",
];

const FALLBACK_TOPICS = [
  {
    topic: "A tiny win from today / \u4eca\u65e5\u306e\u5c0f\u3055\u306a\u9054\u6210",
    task: "Write 4-6 sentences about one small thing that went better than expected today.",
  },
  {
    topic: "A place that helps you focus / \u96c6\u4e2d\u3057\u3084\u3059\u3044\u5834\u6240",
    task: "Describe where you like to study and why it helps you stay calm or productive.",
  },
  {
    topic: "A habit you want to improve / \u6539\u5584\u3057\u305f\u3044\u7fd2\u6163",
    task: "Write about one habit you want to change and what first step you could take this week.",
  },
  {
    topic: "Something you are looking forward to / \u697d\u3057\u307f\u306b\u3057\u3066\u3044\u308b\u3053\u3068",
    task: "Write about an upcoming plan and why it matters to you.",
  },
  {
    topic: "A recent choice you made / \u6700\u8fd1\u3057\u305f\u9078\u629e",
    task: "Explain a decision you made recently and how you feel about it now.",
  },
];

const FALLBACK_GRAMMAR_POINTS = [
  {
    grammarPoint: "\u301c\u3088\u3046\u306b\u3059\u308b",
    grammarHint: "Use it to describe a habit or something you try to do regularly.",
    example: "\u6bce\u65e5\u3001\u65e5\u672c\u8a9e\u3067\u65e5\u8a18\u3092\u66f8\u304f\u3088\u3046\u306b\u3057\u3066\u3044\u307e\u3059\u3002",
  },
  {
    grammarPoint: "\u301c\u3066\u307f\u308b",
    grammarHint: "Use it when you want to say you tried something as an experiment.",
    example: "\u4eca\u65e5\u306f\u65b0\u3057\u3044\u52c9\u5f37\u6cd5\u3092\u4f7f\u3063\u3066\u307f\u307e\u3057\u305f\u3002",
  },
  {
    grammarPoint: "\u301c\u3068\u601d\u3046",
    grammarHint: "Use it to share your opinion or reflection in a natural way.",
    example: "\u3053\u306e\u65b9\u6cd5\u306f\u81ea\u5206\u306b\u5408\u3063\u3066\u3044\u308b\u3068\u601d\u3044\u307e\u3059\u3002",
  },
  {
    grammarPoint: "\u301c\u305f\u3070\u304b\u308a",
    grammarHint: "Use it to say you just finished doing something.",
    example: "\u3055\u3063\u304d\u5bbf\u984c\u3092\u7d42\u3048\u305f\u3070\u304b\u308a\u3067\u3059\u3002",
  },
  {
    grammarPoint: "\u301c\u306e\u3067",
    grammarHint: "Use it to give a softer reason or explanation.",
    example: "\u4eca\u65e5\u306f\u5c11\u3057\u75b2\u308c\u3066\u3044\u308b\u306e\u3067\u3001\u77ed\u304f\u66f8\u304d\u307e\u3059\u3002",
  },
];

export async function POST(request) {
  let payload;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const action = payload?.action;
  if (action !== "prompt" && action !== "feedback") {
    return NextResponse.json({ error: "Unsupported writing coach action." }, { status: 400 });
  }

  if (action === "feedback" && !String(payload?.body || "").trim()) {
    return NextResponse.json({ error: "Writing feedback requires entry content." }, { status: 400 });
  }

  try {
    const apiKey = getRequiredServerEnv("OPENROUTER_API_KEY", "writing-coach");
    const model = getOptionalServerEnv("OPENROUTER_MODEL") || DEFAULT_MODEL;
    const appName = getOptionalServerEnv("OPENROUTER_APP_NAME");
    const siteUrl = getOptionalServerEnv("OPENROUTER_SITE_URL");
    const responseJson = await requestCoachCompletion({
      action,
      payload,
      model,
      apiKey,
      appName,
      siteUrl,
    });
    const content = extractMessageContent(responseJson);
    const parsed = parseJsonResponse(content);

    if (action === "prompt") {
      return NextResponse.json({
        prompt: sanitizePromptPayload(parsed),
        model,
      });
    }

    const feedback = sanitizeFeedbackPayload(parsed);
    if (isFeedbackTooThin(feedback)) {
      throw new Error("Feedback response was too thin.");
    }

    return NextResponse.json({
      feedback,
      model,
      fallback: false,
    });
  } catch {
    if (action === "prompt") {
      return NextResponse.json({
        prompt: buildFallbackPrompt(),
        model: getOptionalServerEnv("OPENROUTER_MODEL") || DEFAULT_MODEL,
        fallback: true,
      });
    }

    return NextResponse.json({
      feedback: buildFallbackFeedback(payload),
      model: getOptionalServerEnv("OPENROUTER_MODEL") || DEFAULT_MODEL,
      fallback: true,
      notice:
        "OpenRouter's free models are busy right now, so a fallback review was returned instead.",
    });
  }
}

async function requestCoachCompletion({ action, payload, model, apiKey, appName, siteUrl }) {
  const attemptModels =
    action === "feedback"
      ? [model, ...FEEDBACK_FALLBACK_MODELS.filter((candidate) => candidate !== model)]
      : [model];
  let lastError = null;

  for (let index = 0; index < attemptModels.length; index += 1) {
    const attemptModel = attemptModels[index];

    try {
      const response = await fetch(OPENROUTER_ENDPOINT, {
        method: "POST",
        headers: buildOpenRouterHeaders({ apiKey, appName, siteUrl }),
        body: JSON.stringify(buildOpenRouterRequest(action, payload, attemptModel)),
        cache: "no-store",
        signal: AbortSignal.timeout(45000),
      });

      if (!response.ok) {
        const responseText = await response.text();
        const error = new Error(
          `OpenRouter request failed (${response.status}): ${truncateText(responseText, 240)}`,
        );
        error.status = response.status;
        error.retryable = isRetryableOpenRouterStatus(response.status);

        if (!error.retryable || index === attemptModels.length - 1) {
          throw error;
        }

        lastError = error;
        continue;
      }

      return await response.json();
    } catch (error) {
      const retryable =
        Boolean(error?.retryable) ||
        isRetryableOpenRouterStatus(error?.status) ||
        isRetryableNetworkError(error);

      if (!retryable || index === attemptModels.length - 1) {
        throw error;
      }

      lastError = error;
    }
  }

  throw lastError || new Error("Unable to reach OpenRouter.");
}

function buildOpenRouterHeaders({ apiKey, appName, siteUrl }) {
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  if (siteUrl) {
    headers["HTTP-Referer"] = siteUrl;
  }

  if (appName) {
    headers["X-OpenRouter-Title"] = appName;
  }

  return headers;
}

function buildOpenRouterRequest(action, payload, model) {
  if (action === "prompt") {
    return {
      model,
      temperature: 0.85,
      max_tokens: 420,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a kind Japanese writing coach for a self-study dashboard. Return JSON only. Generate one writing prompt that is practical, motivating, and suitable for a learner writing a short journal-style entry in Japanese. Keep explanations in English, but include Japanese where helpful.",
        },
        {
          role: "user",
          content: [
            "Return a JSON object with exactly these string fields:",
            "topic",
            "task",
            "grammarPoint",
            "grammarHint",
            "example",
            "",
            "Requirements:",
            "- Topic should feel personal and concrete, not abstract.",
            "- Task should ask for 4-6 sentences.",
            "- Grammar point should be common and useful for learners.",
            "- Grammar hint should explain when to use it in plain English.",
            "- Example should be one natural Japanese sentence using the grammar point.",
            "- Keep each field concise.",
          ].join("\n"),
        },
      ],
    };
  }

  const entryBody = String(payload?.body || "").trim();
  const topic = String(payload?.coachPrompt?.topic || "").trim();
  const grammarPoint = String(payload?.coachPrompt?.grammarPoint || "").trim();

  return {
    model,
    temperature: 0.35,
    max_tokens: 1400,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are a warm, concise Japanese writing coach. Return JSON only. Write feedback primarily in natural Japanese. Be supportive, but be honest about whether the target grammar was correct, awkward, or missing.",
      },
      {
        role: "user",
        content: [
          "Return a JSON object with these keys:",
          "- encouragement: string",
          "- grammarJudgement: string",
          "- grammarFit: string",
          "- strengths: array of 1 to 3 short strings",
          "- corrections: array of up to 3 objects with string fields original, improved, reason",
          "- naturalRewrite: string",
          "- nextStep: string",
          "",
          "Rules:",
          "- Write encouragement, grammarJudgement, grammarFit, reason, and nextStep in Japanese.",
          "- naturalRewrite must be natural Japanese.",
          "- grammarJudgement must clearly be one of: 正しく使えている / 少し不自然 / 使えていない.",
          "- grammarFit must clearly say whether the target grammar was used correctly.",
          "- If the target grammar was wrong, include at least one correction about it.",
          "- strengths may be short Japanese phrases.",
          "- Do not leave any key empty.",
          "",
          `Target topic: ${topic || "None provided"}`,
          `Target grammar point: ${grammarPoint || "None provided"}`,
          "",
          "Learner entry:",
          entryBody,
        ].join("\n"),
      },
    ],
  };
}

function extractMessageContent(responseJson) {
  const content = responseJson?.choices?.[0]?.message?.content;

  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part?.text === "string" ? part.text : ""))
      .join("")
      .trim();
  }

  throw new Error("OpenRouter response did not include message content.");
}

function parseJsonResponse(content) {
  const normalized = String(content || "").trim();
  const withoutFence = normalized
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(withoutFence);
  } catch {
    const firstBrace = withoutFence.indexOf("{");
    const lastBrace = withoutFence.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(withoutFence.slice(firstBrace, lastBrace + 1));
    }

    throw new Error("Model response was not valid JSON.");
  }
}

function sanitizePromptPayload(payload) {
  return {
    topic: sanitizeString(
      payload?.topic,
      "A small moment from your day / \u4eca\u65e5\u306e\u3061\u3087\u3063\u3068\u3057\u305f\u51fa\u6765\u4e8b",
    ),
    task: sanitizeString(
      payload?.task,
      "Write 4-6 sentences about a real moment from today and how you felt about it.",
    ),
    grammarPoint: sanitizeString(payload?.grammarPoint, "\u301c\u3068\u601d\u3046"),
    grammarHint: sanitizeString(
      payload?.grammarHint,
      "Use it when you want to share an opinion or reflection naturally.",
    ),
    example: sanitizeString(
      payload?.example,
      "\u4eca\u65e5\u306f\u5c11\u3057\u5fd9\u3057\u304b\u3063\u305f\u3067\u3059\u304c\u3001\u3044\u3044\u4e00\u65e5\u3060\u3063\u305f\u3068\u601d\u3044\u307e\u3059\u3002",
    ),
  };
}

function sanitizeFeedbackPayload(payload) {
  const strengths = Array.isArray(payload?.strengths)
    ? payload.strengths.map((item) => sanitizeString(item)).filter(Boolean).slice(0, 3)
    : [];
  const corrections = Array.isArray(payload?.corrections)
    ? payload.corrections
        .map((item) => ({
          original: sanitizeString(item?.original),
          improved: sanitizeString(item?.improved),
          reason: sanitizeString(item?.reason),
        }))
        .filter((item) => item.original || item.improved || item.reason)
        .slice(0, 3)
    : [];

  return {
    encouragement: sanitizeString(
      payload?.encouragement,
      "\u65e5\u672c\u8a9e\u3067\u66f8\u3053\u3046\u3068\u3057\u305f\u306e\u304c\u3068\u3066\u3082\u826f\u3044\u3067\u3059\u3002",
    ),
    grammarJudgement: sanitizeString(payload?.grammarJudgement, ""),
    grammarFit: sanitizeString(
      payload?.grammarFit,
      "\u6b21\u56de\u306f\u76ee\u6a19\u306e\u6587\u6cd5\u3092\u4e00\u56de\u306f\u3063\u304d\u308a\u4f7f\u3063\u3066\u307f\u307e\u3057\u3087\u3046\u3002",
    ),
    strengths,
    corrections,
    naturalRewrite: sanitizeString(payload?.naturalRewrite, ""),
    nextStep: sanitizeString(
      payload?.nextStep,
      "\u6b21\u306e\u65e5\u8a18\u3067\u306f\u3001\u4e00\u3064\u306e\u8003\u3048\u3092\u306f\u3063\u304d\u308a\u66f8\u304f\u3053\u3068\u3092\u610f\u8b58\u3057\u3066\u307f\u307e\u3057\u3087\u3046\u3002",
    ),
  };
}

function isFeedbackTooThin(feedback) {
  const strengthCount = Array.isArray(feedback?.strengths) ? feedback.strengths.length : 0;
  const correctionCount = Array.isArray(feedback?.corrections) ? feedback.corrections.length : 0;
  const hasRewrite = Boolean(String(feedback?.naturalRewrite || "").trim());
  const hasJudgement = Boolean(String(feedback?.grammarJudgement || "").trim());
  const grammarFit = String(feedback?.grammarFit || "").trim();

  return (
    !hasJudgement ||
    grammarFit.length < 12 ||
    (!hasRewrite && correctionCount === 0 && strengthCount === 0)
  );
}

function buildFallbackPrompt() {
  const topic = pickRandom(FALLBACK_TOPICS);
  const grammar = pickRandom(FALLBACK_GRAMMAR_POINTS);

  return {
    topic: topic.topic,
    task: topic.task,
    grammarPoint: grammar.grammarPoint,
    grammarHint: grammar.grammarHint,
    example: grammar.example,
  };
}

function buildFallbackFeedback(payload) {
  const body = String(payload?.body || "").trim();
  const topic = String(payload?.coachPrompt?.topic || "").trim();
  const grammarPoint = String(payload?.coachPrompt?.grammarPoint || "").trim();
  const sentenceCount = body.split(/[。！？!?]+/).map((part) => part.trim()).filter(Boolean).length;
  const characterCount = body.replace(/\s+/g, "").length;
  const usedGrammar = detectGrammarAttempt(body, grammarPoint);
  const strengths = [];

  if (sentenceCount >= 2) {
    strengths.push("\u6587\u3092\u3064\u306a\u3052\u3066\u66f8\u3051\u3066\u3044\u308b\u306e\u304c\u826f\u3044\u3067\u3059\u3002");
  }

  if (characterCount >= 30) {
    strengths.push("\u5185\u5bb9\u306b\u5177\u4f53\u6027\u304c\u3042\u308a\u3001\u69d8\u5b50\u304c\u4f1d\u308f\u308a\u3084\u3059\u3044\u3067\u3059\u3002");
  }

  if (usedGrammar) {
    strengths.push("\u76ee\u6a19\u306e\u6587\u6cd5\u3092\u907f\u3051\u305a\u306b\u4f7f\u304a\u3046\u3068\u3057\u305f\u306e\u304c\u826f\u3044\u3067\u3059\u3002");
  }

  if (!strengths.length) {
    strengths.push("\u4f1d\u3048\u305f\u3044\u3053\u3068\u306f\u3061\u3083\u3093\u3068\u66f8\u3051\u3066\u3044\u307e\u3059\u3002");
  }

  return {
    encouragement:
      "\u4eca\u306fAI\u30e2\u30c7\u30eb\u304c\u6df7\u307f\u5408\u3063\u3066\u3044\u307e\u3059\u304c\u3001\u3053\u306e\u6587\u7ae0\u304b\u3089\u306f\u52c9\u5f37\u3092\u7d9a\u3051\u3088\u3046\u3068\u3059\u308b\u6c17\u6301\u3061\u304c\u3088\u304f\u4f1d\u308f\u3063\u3066\u304d\u307e\u3059\u3002",
    grammarJudgement: grammarPoint
      ? usedGrammar
        ? "\u5c11\u3057\u4e0d\u81ea\u7136"
        : "\u4f7f\u3048\u3066\u3044\u306a\u3044"
      : "\u78ba\u8a8d\u4e2d",
    grammarFit: grammarPoint
      ? usedGrammar
        ? `${grammarPoint}\u306f\u4f7f\u304a\u3046\u3068\u3057\u3066\u3044\u3066\u826f\u3044\u3067\u3059\u304c\u3001\u5f62\u306f\u307e\u3060\u5c11\u3057\u4e0d\u81ea\u7136\u3067\u3059\u3002`
        : `${grammarPoint}\u306e\u5f62\u306f\u307e\u3060\u306f\u3063\u304d\u308a\u898b\u3048\u307e\u305b\u3093\u3002\u77ed\u3044\u4e00\u6587\u3067\u3082\u3044\u3044\u306e\u3067\u3001\u3053\u306e\u6587\u578b\u3092\u76f4\u63a5\u5165\u308c\u3066\u307f\u307e\u3057\u3087\u3046\u3002`
      : "\u6587\u306e\u4e3b\u984c\u306f\u4f1d\u308f\u3063\u3066\u3044\u307e\u3059\u3002",
    strengths: strengths.slice(0, 3),
    corrections: [],
    naturalRewrite: "",
    nextStep: buildFallbackNextStep({ topic, grammarPoint, sentenceCount, usedGrammar }),
  };
}

function pickRandom(values) {
  return values[Math.floor(Math.random() * values.length)] || values[0];
}

function sanitizeString(value, fallback = "") {
  const text = typeof value === "string" ? value.trim() : "";
  return text || fallback;
}

function isRetryableOpenRouterStatus(status) {
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

function isRetryableNetworkError(error) {
  const message = String(error?.message || "").toLowerCase();

  return (
    message.includes("timed out") ||
    message.includes("timeout") ||
    message.includes("network") ||
    message.includes("fetch failed") ||
    message.includes("rate-limit") ||
    message.includes("rate limit")
  );
}

function detectGrammarAttempt(body, grammarPoint) {
  const normalizedBody = String(body || "");
  const normalizedGrammar = String(grammarPoint || "");

  if (!normalizedBody || !normalizedGrammar) {
    return false;
  }

  const hints = [];

  if (normalizedGrammar.includes("\u3088\u3046\u306b")) {
    hints.push("\u3088\u3046\u306b");
  }

  if (normalizedGrammar.includes("\u3066\u307f\u308b")) {
    hints.push("\u3066\u307f");
  }

  if (normalizedGrammar.includes("\u3068\u601d\u3046")) {
    hints.push("\u3068\u601d");
  }

  if (normalizedGrammar.includes("\u305f\u3070\u304b\u308a")) {
    hints.push("\u305f\u3070\u304b\u308a");
  }

  if (normalizedGrammar.includes("\u306e\u3067")) {
    hints.push("\u306e\u3067");
  }

  const simplifiedGrammar = normalizedGrammar.replace(/[〜～\s]/g, "");
  if (simplifiedGrammar) {
    hints.push(simplifiedGrammar);
  }

  return [...new Set(hints)].some((hint) => normalizedBody.includes(hint));
}

function buildFallbackNextStep({ topic, grammarPoint, sentenceCount, usedGrammar }) {
  if (grammarPoint && !usedGrammar) {
    return `${grammarPoint}\u3092\u4f7f\u3063\u305f\u77ed\u3044\u4e00\u6587\u3092\u4e00\u3064\u8ffd\u52a0\u3057\u3066\u307f\u307e\u3057\u3087\u3046\u3002`;
  }

  if (sentenceCount < 3) {
    return "\u6b21\u56de\u306f\u300c\u7406\u7531\u300d\u3068\u300c\u6c17\u6301\u3061\u300d\u3092\u4e00\u3064\u305a\u3064\u8db3\u3057\u3066\u3001\u6587\u7ae0\u306b\u307e\u3068\u307e\u308a\u3092\u51fa\u3057\u307e\u3057\u3087\u3046\u3002";
  }

  if (topic) {
    return `\u6b21\u56de\u306f\u300c${topic}\u300d\u306b\u95a2\u4fc2\u3059\u308b\u5177\u4f53\u7684\u306a\u8a73\u3057\u3044\u60c5\u5831\u3092\u3082\u3046\u4e00\u3064\u8db3\u3057\u3066\u307f\u307e\u3057\u3087\u3046\u3002`;
  }

  return "\u6b21\u306e\u65e5\u8a18\u3067\u306f\u3001\u3082\u3046\u4e00\u3064\u3060\u3051\u65b0\u3057\u3044\u6587\u578b\u3092\u5165\u308c\u3066\u307f\u307e\u3057\u3087\u3046\u3002";
}

function truncateText(value, maxLength) {
  const text = String(value || "").trim();
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength).trimEnd()}...`;
}
