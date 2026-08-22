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
    topicEnglish: "A tiny win from today",
    topicJapanese: "\u4eca\u65e5\u306e\u5c0f\u3055\u306a\u9054\u6210",
    task: "Write 4-6 sentences about one small thing that went better than expected today.",
  },
  {
    topicEnglish: "A place that helps you focus",
    topicJapanese: "\u96c6\u4e2d\u3057\u3084\u3059\u3044\u5834\u6240",
    task: "Describe where you like to study and why it helps you stay calm or productive.",
  },
  {
    topicEnglish: "A habit you want to improve",
    topicJapanese: "\u6539\u5584\u3057\u305f\u3044\u7fd2\u6163",
    task: "Write about one habit you want to change and what first step you could take this week.",
  },
  {
    topicEnglish: "Something you are looking forward to",
    topicJapanese: "\u697d\u3057\u307f\u306b\u3057\u3066\u3044\u308b\u3053\u3068",
    task: "Write about an upcoming plan and why it matters to you.",
  },
  {
    topicEnglish: "A recent choice you made",
    topicJapanese: "\u6700\u8fd1\u3057\u305f\u9078\u629e",
    task: "Explain a decision you made recently and how you feel about it now.",
  },
];

const FALLBACK_GRAMMAR_POINTS = [
  {
    level: "N3",
    grammarPoint: "\u301c\u3088\u3046\u306b\u3059\u308b",
    grammarPointFurigana: "\u301c\u3088\u3046\u306b\u3059\u308b",
    grammarHint: "Use it to describe a habit or something you try to do regularly.",
    example: "\u6bce\u65e5\u3001\u65e5\u672c\u8a9e\u3067\u65e5\u8a18\u3092\u66f8\u304f\u3088\u3046\u306b\u3057\u3066\u3044\u307e\u3059\u3002",
    exampleFurigana: "\u6bce\u65e5[\u307e\u3044\u306b\u3061]\u3001\u65e5\u672c\u8a9e[\u306b\u307b\u3093\u3054]\u3067\u65e5\u8a18[\u306b\u3063\u304d]\u3092\u66f8[\u304b]\u304f\u3088\u3046\u306b\u3057\u3066\u3044\u307e\u3059\u3002",
  },
  {
    level: "N4",
    grammarPoint: "\u301c\u3066\u307f\u308b",
    grammarPointFurigana: "\u301c\u3066\u307f\u308b",
    grammarHint: "Use it when you want to say you tried something as an experiment.",
    example: "\u4eca\u65e5\u306f\u65b0\u3057\u3044\u52c9\u5f37\u6cd5\u3092\u4f7f\u3063\u3066\u307f\u307e\u3057\u305f\u3002",
    exampleFurigana: "\u4eca\u65e5[\u304d\u3087\u3046]\u306f\u65b0[\u3042\u305f\u3089]\u3057\u3044\u52c9\u5f37\u6cd5[\u3079\u3093\u304d\u3087\u3046\u307b\u3046]\u3092\u4f7f[\u3064\u304b]\u3063\u3066\u307f\u307e\u3057\u305f\u3002",
  },
  {
    level: "N4",
    grammarPoint: "\u301c\u3068\u601d\u3046",
    grammarPointFurigana: "\u301c\u3068\u601d[\u304a\u3082]\u3046",
    grammarHint: "Use it to share your opinion or reflection in a natural way.",
    example: "\u3053\u306e\u65b9\u6cd5\u306f\u81ea\u5206\u306b\u5408\u3063\u3066\u3044\u308b\u3068\u601d\u3044\u307e\u3059\u3002",
    exampleFurigana: "\u3053\u306e\u65b9\u6cd5[\u307b\u3046\u307b\u3046]\u306f\u81ea\u5206[\u3058\u3076\u3093]\u306b\u5408[\u3042]\u3063\u3066\u3044\u308b\u3068\u601d[\u304a\u3082]\u3044\u307e\u3059\u3002",
  },
  {
    level: "N4",
    grammarPoint: "\u301c\u305f\u3070\u304b\u308a",
    grammarPointFurigana: "\u301c\u305f\u3070\u304b\u308a",
    grammarHint: "Use it to say you just finished doing something.",
    example: "\u3055\u3063\u304d\u5bbf\u984c\u3092\u7d42\u3048\u305f\u3070\u304b\u308a\u3067\u3059\u3002",
    exampleFurigana: "\u3055\u3063\u304d\u5bbf\u984c[\u3057\u3085\u304f\u3060\u3044]\u3092\u7d42[\u304a]\u3048\u305f\u3070\u304b\u308a\u3067\u3059\u3002",
  },
  {
    level: "N5",
    grammarPoint: "\u301c\u306e\u3067",
    grammarPointFurigana: "\u301c\u306e\u3067",
    grammarHint: "Use it to give a softer reason or explanation.",
    example: "\u4eca\u65e5\u306f\u5c11\u3057\u75b2\u308c\u3066\u3044\u308b\u306e\u3067\u3001\u77ed\u304f\u66f8\u304d\u307e\u3059\u3002",
    exampleFurigana: "\u4eca\u65e5[\u304d\u3087\u3046]\u306f\u5c11[\u3059\u3053]\u3057\u75b2[\u3064\u304b]\u308c\u3066\u3044\u308b\u306e\u3067\u3001\u77ed[\u307f\u3058\u304b]\u304f\u66f8[\u304b]\u304d\u307e\u3059\u3002",
  },
  {
    level: "N2",
    grammarPoint: "\u301c\u308f\u3051\u3067\u306f\u306a\u3044",
    grammarPointFurigana: "\u301c\u308f\u3051\u3067\u306f\u306a\u3044",
    grammarHint: "Use it to clarify that something is not necessarily or entirely the case.",
    example: "\u5acc\u3044\u306a\u308f\u3051\u3067\u306f\u306a\u3044\u3067\u3059\u304c\u3001\u6bce\u65e5\u306f\u98df\u3079\u307e\u305b\u3093\u3002",
    exampleFurigana: "\u5acc[\u304d\u3089]\u3044\u306a\u308f\u3051\u3067\u306f\u306a\u3044\u3067\u3059\u304c\u3001\u6bce\u65e5[\u307e\u3044\u306b\u3061]\u306f\u98df[\u305f]\u3079\u307e\u305b\u3093\u3002",
  },
  {
    level: "N1",
    grammarPoint: "\u301c\u306b\u81f3\u308b",
    grammarPointFurigana: "\u301c\u306b\u81f3[\u3044\u305f]\u308b",
    grammarHint: "Use it to describe the result or final stage reached after a process.",
    example: "\u4f55\u5ea6\u3082\u8a71\u3057\u5408\u3063\u305f\u7d50\u679c\u3001\u3053\u306e\u7d50\u8ad6\u306b\u81f3\u308a\u307e\u3057\u305f\u3002",
    exampleFurigana: "\u4f55\u5ea6[\u306a\u3093\u3069]\u3082\u8a71[\u306f\u306a]\u3057\u5408[\u3042]\u3063\u305f\u7d50\u679c[\u3051\u3063\u304b]\u3001\u3053\u306e\u7d50\u8ad6[\u3051\u3064\u308d\u3093]\u306b\u81f3[\u3044\u305f]\u308a\u307e\u3057\u305f\u3002",
  },
];

const SUPPORTED_JLPT_LEVELS = new Set(["N5", "N4", "N3", "N2", "N1"]);

export async function POST(request) {
  let payload;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const action = payload?.action;
  if (
    action !== "prompt" &&
    action !== "feedback" &&
    action !== "explanation" &&
    action !== "assessment"
  ) {
    return NextResponse.json({ error: "Unsupported writing coach action." }, { status: 400 });
  }

  if ((action === "feedback" || action === "assessment") && !String(payload?.body || "").trim()) {
    return NextResponse.json({ error: "Writing feedback requires entry content." }, { status: 400 });
  }

  if (action === "explanation" && !String(payload?.grammarPoint || "").trim()) {
    return NextResponse.json({ error: "A grammar point is required." }, { status: 400 });
  }

  try {
    const apiKey = getRequiredServerEnv("OPENROUTER_API_KEY", "writing-coach");
    const model = getOptionalServerEnv("OPENROUTER_MODEL") || DEFAULT_MODEL;
    const appName = getOptionalServerEnv("OPENROUTER_APP_NAME");
    const siteUrl = getOptionalServerEnv("OPENROUTER_SITE_URL");
    const parsed = await requestParsedCoachCompletion({
      action,
      payload,
      model,
      apiKey,
      appName,
      siteUrl,
    });

    if (action === "prompt") {
      return NextResponse.json({
        prompt: sanitizePromptPayload(parsed),
        model,
      });
    }

    if (action === "explanation") {
      return NextResponse.json({
        explanation: sanitizeExplanationPayload(parsed, payload),
        model,
        fallback: false,
      });
    }

    if (action === "assessment") {
      return NextResponse.json({
        assessment: sanitizeAssessmentPayload(parsed),
        model,
        fallback: false,
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
        prompt: buildFallbackPrompt(payload?.jlptLevel, payload?.grammarTarget),
        model: getOptionalServerEnv("OPENROUTER_MODEL") || DEFAULT_MODEL,
        fallback: true,
      });
    }

    if (action === "explanation") {
      return NextResponse.json(
        { error: "The grammar explanation could not be generated. Please try again." },
        { status: 503 },
      );
    }

    if (action === "assessment") {
      return NextResponse.json(
        { error: "The entry was saved, but its writing score could not be generated." },
        { status: 503 },
      );
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

async function requestParsedCoachCompletion(options) {
  const maximumAttempts = options.action === "assessment" ? 2 : 1;
  let lastError = null;

  for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
    try {
      const responseJson = await requestCoachCompletion(options);
      const content = extractMessageContent(responseJson);
      return parseJsonResponse(content);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Unable to parse the writing coach response.");
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
    const jlptLevel = normalizeJlptLevel(payload?.jlptLevel);
    const grammarTarget = normalizeGrammarTarget(payload?.grammarTarget, jlptLevel);

    return {
      model,
      temperature: 0.85,
      max_tokens: 1200,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a kind Japanese writing coach for a self-study dashboard. Return JSON only. Generate one highly concrete writing prompt suitable for a learner dictating a short journal entry in Japanese. Make it effortless to start speaking and avoid abstract essay questions.",
        },
        {
          role: "user",
          content: [
            "Return a JSON object with exactly these string fields:",
            "topicEnglish",
            "topicJapanese",
            "task",
            "grammarPoint",
            "grammarPointFurigana",
            "grammarHintJapanese",
            "grammarHintJapaneseFurigana",
            "grammarHint",
            "example",
            "exampleFurigana",
            "talkingPoints (an array of exactly 3 objects with string fields english and japanese)",
            "sentenceStarter",
            "",
            "Requirements:",
            "- topicEnglish and topicJapanese must be natural translations of the same topic.",
            "- Topic must concern an easy everyday experience, preference, memory, plan, object, person, place, game, food, or routine.",
            "- Task should invite 1-4 sentences, making one tiny sentence acceptable.",
            grammarTarget
              ? `- You MUST use this exact target grammar point: ${grammarTarget.japanese} (${grammarTarget.meaning}). Do not substitute a different grammar point.`
              : `- Select one useful grammar point specifically associated with JLPT ${jlptLevel}.`,
            "- grammarPointFurigana must repeat grammarPoint using safe annotation like 漢字[かんじ]. Add readings only where kanji appear.",
            "- grammarHintJapanese must explain the grammar in one very short, very simple Japanese sentence suitable for the selected level.",
            `- grammarHintJapaneseFurigana must repeat grammarHintJapanese and annotate difficult kanji for JLPT ${jlptLevel} using 漢字[かんじ].`,
            "- Grammar hint should explain when to use it in plain English.",
            "- Example should be one natural Japanese sentence using the grammar point.",
            `- exampleFurigana must repeat example and annotate kanji likely to be difficult for a JLPT ${jlptLevel} learner, using 漢字[かんじ]. Do not annotate kana or punctuation.`,
            "- Each talking point must be a tiny, direct question that can be answered without planning.",
            "- sentenceStarter must be a short natural Japanese opening that uses or leads into the grammar point.",
            "- Keep each field concise.",
          ].join("\n"),
        },
      ],
    };
  }

  if (action === "explanation") {
    const grammarPoint = String(payload?.grammarPoint || "").trim();
    const jlptLevel = normalizeJlptLevel(payload?.jlptLevel);

    return {
      model,
      temperature: 0.25,
      max_tokens: 2600,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are an accurate, approachable Japanese grammar teacher. Return JSON only. Explain grammar in clear English, with natural Japanese examples and English translations.",
        },
        {
          role: "user",
          content: [
            "Return a JSON object with exactly these fields:",
            "grammarPoint (string)",
            "grammarPointFurigana (string using 漢字[かんじ] notation)",
            "level (string)",
            "meaning (string)",
            "meaningJapanese (one very short explanation in simple Japanese)",
            "meaningJapaneseFurigana (repeat meaningJapanese using \u6f22\u5b57[\u304b\u3093\u3058] notation)",
            "formation (array of 1 to 4 short strings)",
            "nuance (string)",
            "examples (array of exactly 4 objects with japanese, japaneseFurigana, and english string fields)",
            "commonMistake (string)",
            "similarGrammar (string)",
            "quickChallenge (string)",
            "",
            `Explain: ${grammarPoint}`,
            `Learner level: JLPT ${jlptLevel}`,
            `meaningJapanese must use Japanese simple enough for JLPT ${jlptLevel}.`,
            `meaningJapaneseFurigana must annotate kanji likely to be difficult at JLPT ${jlptLevel}.`,
            `In every japaneseFurigana field, repeat the Japanese sentence and annotate kanji likely to be difficult at JLPT ${jlptLevel} using 漢字[かんじ]. Do not annotate kana or punctuation.`,
            "Keep the explanation practical and concise enough to scan on a phone.",
          ].join("\n"),
        },
      ],
    };
  }

  if (action === "assessment") {
    const entryBody = String(payload?.body || "").trim();
    const topicEnglish = String(payload?.coachPrompt?.topicEnglish || "").trim();
    const topicJapanese = String(payload?.coachPrompt?.topicJapanese || "").trim();
    const grammarPoint = String(payload?.coachPrompt?.grammarPoint || "").trim();
    const grammarPointId = String(payload?.coachPrompt?.grammarPointId || "").trim();
    const grammarCandidates = Array.isArray(payload?.grammarCandidates)
      ? payload.grammarCandidates
          .map((candidate) => normalizeGrammarTarget(candidate, candidate?.level))
          .filter(Boolean)
          .slice(0, 12)
      : [];
    const hasPrompt = Boolean(topicEnglish || topicJapanese || grammarPoint);

    return {
      model,
      temperature: 0.2,
      max_tokens: 1400,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a fair and encouraging Japanese writing assessor. Return JSON only. Assess communicative success, not native perfection. A single short sentence is a valid complete entry and must not lose points merely for being short.",
        },
        {
          role: "user",
          content: [
            "Return a JSON object with exactly these fields:",
            "score (integer from 0 to 100)",
            "summary (one short encouraging English sentence)",
            "promptAchieved (boolean)",
            "grammarAchieved (boolean)",
            "communicationScore (integer from 0 to 35)",
            "promptScore (integer from 0 to 25)",
            "grammarScore (integer from 0 to 25)",
            "naturalnessScore (integer from 0 to 15)",
            "grammarAssessment (an object with attempted, used, correctnessScore, naturalnessScore, qualityScore, evidence, and feedback)",
            "detectedGrammar (an array of objects with grammarPointId, attempted, used, correctnessScore, naturalnessScore, qualityScore, evidence, and feedback)",
            "mainImprovement (one short, specific and actionable English sentence)",
            "",
            "Rubric:",
            "- Communication: 35 points for conveying a comprehensible idea.",
            "- Prompt relevance: 25 points for answering the selected topic. If no prompt was supplied, award this based on coherence.",
            "- Target grammar: 25 points for using the selected grammar naturally and correctly. If no grammar target was supplied, award this based on general grammar control.",
            "- Naturalness: 15 points for natural phrasing and appropriate particles/forms.",
            "- score must equal the four component scores added together.",
            "- Be generous with understandable learner Japanese while remaining honest.",
            "- grammarAssessment.attempted and grammarAssessment.used must be booleans.",
            "- grammarAssessment correctnessScore, naturalnessScore, and qualityScore must each be integers from 0 to 100.",
            "- If the target grammar is absent, set used false and qualityScore to 0.",
            "- evidence must quote only the shortest relevant part of the learner entry, or be empty if absent.",
            "- feedback must be one short actionable English sentence about this grammar point.",
            "- Only include a detectedGrammar item when one of the supplied candidate grammar patterns is genuinely used with that grammatical meaning.",
            "- Do not count an incidental character or matching text that serves a different grammatical function.",
            `Prompt supplied: ${hasPrompt ? "yes" : "no"}`,
            `Topic: ${topicEnglish || topicJapanese || "None"}`,
            `Grammar catalogue ID: ${grammarPointId || "None"}`,
            `Target grammar: ${grammarPoint || "None"}`,
            `Possible additional grammar candidates: ${grammarCandidates.length
              ? grammarCandidates.map((item) => `${item.id}: ${item.japanese} (${item.meaning})`).join(" | ")
              : "None"}`,
            "",
            "Learner entry:",
            entryBody,
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
  const topicEnglish = sanitizeString(payload?.topicEnglish, "A small moment from your day");
  const topicJapanese = sanitizeString(payload?.topicJapanese, "\u4eca\u65e5\u306e\u3061\u3087\u3063\u3068\u3057\u305f\u51fa\u6765\u4e8b");
  const talkingPoints = Array.isArray(payload?.talkingPoints)
    ? payload.talkingPoints
        .map((item) => ({
          english: sanitizeString(item?.english),
          japanese: sanitizeString(item?.japanese),
        }))
        .filter((item) => item.english && item.japanese)
        .slice(0, 3)
    : [];

  return {
    topicEnglish,
    topicJapanese,
    topic: `${topicEnglish} / ${topicJapanese}`,
    task: sanitizeString(
      payload?.task,
      "Write 4-6 sentences about a real moment from today and how you felt about it.",
    ),
    grammarPoint: sanitizeString(payload?.grammarPoint, "\u301c\u3068\u601d\u3046"),
    grammarPointFurigana: sanitizeFuriganaString(
      payload?.grammarPointFurigana,
      sanitizeString(payload?.grammarPoint, "\u301c\u3068\u601d\u3046"),
    ),
    grammarHint: sanitizeString(
      payload?.grammarHint,
      "Use it when you want to share an opinion or reflection naturally.",
    ),
    grammarHintJapanese: sanitizeString(
      payload?.grammarHintJapanese,
      "\u81ea\u5206\u306e\u8003\u3048\u3092\u8a00\u3046\u3068\u304d\u306b\u4f7f\u3044\u307e\u3059\u3002",
    ),
    grammarHintJapaneseFurigana: sanitizeFuriganaString(
      payload?.grammarHintJapaneseFurigana,
      sanitizeString(
        payload?.grammarHintJapanese,
        "\u81ea\u5206[\u3058\u3076\u3093]\u306e\u8003[\u304b\u3093\u304c]\u3048\u3092\u8a00[\u3044]\u3046\u3068\u304d\u306b\u4f7f[\u3064\u304b]\u3044\u307e\u3059\u3002",
      ),
    ),
    example: sanitizeString(
      payload?.example,
      "\u4eca\u65e5\u306f\u5c11\u3057\u5fd9\u3057\u304b\u3063\u305f\u3067\u3059\u304c\u3001\u3044\u3044\u4e00\u65e5\u3060\u3063\u305f\u3068\u601d\u3044\u307e\u3059\u3002",
    ),
    exampleFurigana: sanitizeFuriganaString(
      payload?.exampleFurigana,
      sanitizeString(
        payload?.example,
        "\u4eca\u65e5[\u304d\u3087\u3046]\u306f\u5c11[\u3059\u3053]\u3057\u5fd9[\u3044\u305d\u304c]\u3057\u304b\u3063\u305f\u3067\u3059\u304c\u3001\u3044\u3044\u4e00\u65e5[\u3044\u3061\u306b\u3061]\u3060\u3063\u305f\u3068\u601d[\u304a\u3082]\u3044\u307e\u3059\u3002",
      ),
    ),
    talkingPoints: talkingPoints.length === 3
      ? talkingPoints
      : [
          { english: "What happened?", japanese: "\u4f55\u304c\u3042\u308a\u307e\u3057\u305f\u304b\uff1f" },
          { english: "How did you feel?", japanese: "\u3069\u3046\u611f\u3058\u307e\u3057\u305f\u304b\uff1f" },
          { english: "What will you do next?", japanese: "\u6b21\u306f\u3069\u3046\u3057\u307e\u3059\u304b\uff1f" },
        ],
    sentenceStarter: sanitizeString(payload?.sentenceStarter, "\u4eca\u65e5\u306f\u3001"),
  };
}

function sanitizeExplanationPayload(payload, requestPayload) {
  const formation = Array.isArray(payload?.formation)
    ? payload.formation.map((item) => sanitizeString(item)).filter(Boolean).slice(0, 4)
    : [];
  const examples = Array.isArray(payload?.examples)
    ? payload.examples
        .map((item) => ({
          japanese: sanitizeString(item?.japanese),
          japaneseFurigana: sanitizeFuriganaString(item?.japaneseFurigana, item?.japanese),
          english: sanitizeString(item?.english),
        }))
        .filter((item) => item.japanese && item.english)
        .slice(0, 4)
    : [];

  return {
    grammarPoint: sanitizeString(payload?.grammarPoint, String(requestPayload?.grammarPoint || "")),
    grammarPointFurigana: sanitizeFuriganaString(
      payload?.grammarPointFurigana,
      sanitizeString(payload?.grammarPoint, String(requestPayload?.grammarPoint || "")),
    ),
    level: sanitizeString(payload?.level, normalizeJlptLevel(requestPayload?.jlptLevel)),
    meaning: sanitizeString(payload?.meaning),
    meaningJapanese: sanitizeString(payload?.meaningJapanese),
    meaningJapaneseFurigana: sanitizeFuriganaString(
      payload?.meaningJapaneseFurigana,
      payload?.meaningJapanese,
    ),
    formation,
    nuance: sanitizeString(payload?.nuance),
    examples,
    commonMistake: sanitizeString(payload?.commonMistake),
    similarGrammar: sanitizeString(payload?.similarGrammar),
    quickChallenge: sanitizeString(payload?.quickChallenge),
  };
}

function sanitizeAssessmentPayload(payload) {
  const communicationScore = clampInteger(payload?.communicationScore, 0, 35);
  const promptScore = clampInteger(payload?.promptScore, 0, 25);
  const grammarScore = clampInteger(payload?.grammarScore, 0, 25);
  const naturalnessScore = clampInteger(payload?.naturalnessScore, 0, 15);
  const calculatedScore = communicationScore + promptScore + grammarScore + naturalnessScore;
  const grammarAssessment = payload?.grammarAssessment && typeof payload.grammarAssessment === "object"
    ? {
        attempted: sanitizeBoolean(payload.grammarAssessment.attempted),
        used: sanitizeBoolean(payload.grammarAssessment.used),
        correctnessScore: clampInteger(payload.grammarAssessment.correctnessScore, 0, 100),
        naturalnessScore: clampInteger(payload.grammarAssessment.naturalnessScore, 0, 100),
        qualityScore: clampInteger(payload.grammarAssessment.qualityScore, 0, 100),
        evidence: sanitizeString(payload.grammarAssessment.evidence),
        feedback: sanitizeString(payload.grammarAssessment.feedback),
      }
    : null;
  const detectedGrammar = Array.isArray(payload?.detectedGrammar)
    ? payload.detectedGrammar
        .map((item) => ({
          grammarPointId: sanitizeString(item?.grammarPointId),
          attempted: sanitizeBoolean(item?.attempted),
          used: sanitizeBoolean(item?.used),
          correctnessScore: clampInteger(item?.correctnessScore, 0, 100),
          naturalnessScore: clampInteger(item?.naturalnessScore, 0, 100),
          qualityScore: clampInteger(item?.qualityScore, 0, 100),
          evidence: sanitizeString(item?.evidence),
          feedback: sanitizeString(item?.feedback),
        }))
        .filter((item) => item.grammarPointId && item.used)
        .slice(0, 12)
    : [];

  return {
    score: calculatedScore || clampInteger(payload?.score, 0, 100),
    summary: sanitizeString(payload?.summary, "Entry complete—another useful piece of Japanese practice logged."),
    promptAchieved: sanitizeBoolean(payload?.promptAchieved),
    grammarAchieved: sanitizeBoolean(payload?.grammarAchieved),
    communicationScore,
    promptScore,
    grammarScore,
    naturalnessScore,
    grammarAssessment,
    detectedGrammar,
    mainImprovement: sanitizeString(
      payload?.mainImprovement,
      grammarAssessment?.feedback || "Keep building one natural sentence at a time.",
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

function buildFallbackPrompt(jlptLevel = "N4", requestedGrammarTarget = null) {
  const topic = pickRandom(FALLBACK_TOPICS);
  const normalizedLevel = normalizeJlptLevel(jlptLevel);
  const grammarTarget = normalizeGrammarTarget(requestedGrammarTarget, normalizedLevel);
  const fallbackGrammar = pickRandom(
    FALLBACK_GRAMMAR_POINTS.filter((item) => item.level === normalizedLevel),
  ) || pickRandom(FALLBACK_GRAMMAR_POINTS);
  const grammar = grammarTarget
    ? {
        level: grammarTarget.level,
        grammarPoint: grammarTarget.japanese,
        grammarPointFurigana: grammarTarget.japanese,
        grammarHint: grammarTarget.meaning,
        example: `今日は「${grammarTarget.japanese}」を使って文を書きます。`,
        exampleFurigana: `今日[きょう]は「${grammarTarget.japanese}」を使[つか]って文[ぶん]を書[か]きます。`,
      }
    : fallbackGrammar;

  return {
    topicEnglish: topic.topicEnglish,
    topicJapanese: topic.topicJapanese,
    topic: `${topic.topicEnglish} / ${topic.topicJapanese}`,
    task: topic.task,
    grammarPoint: grammar.grammarPoint,
    grammarPointFurigana: grammar.grammarPointFurigana || grammar.grammarPoint,
    grammarHint: grammar.grammarHint,
    grammarHintJapanese: grammar.grammarHintJapanese || "\u3053\u306e\u6587\u6cd5\u3092\u4f7f\u3063\u3066\u3001\u81ea\u5206\u306e\u3053\u3068\u3092\u8a71\u3057\u307e\u3059\u3002",
    grammarHintJapaneseFurigana: grammar.grammarHintJapaneseFurigana || "\u3053\u306e\u6587\u6cd5[\u3076\u3093\u307d\u3046]\u3092\u4f7f[\u3064\u304b]\u3063\u3066\u3001\u81ea\u5206[\u3058\u3076\u3093]\u306e\u3053\u3068\u3092\u8a71[\u306f\u306a]\u3057\u307e\u3059\u3002",
    example: grammar.example,
    exampleFurigana: grammar.exampleFurigana || grammar.example,
    talkingPoints: [
      { english: "What happened?", japanese: "\u4f55\u304c\u3042\u308a\u307e\u3057\u305f\u304b\uff1f" },
      { english: "How did you feel?", japanese: "\u3069\u3046\u611f\u3058\u307e\u3057\u305f\u304b\uff1f" },
      { english: "What will you do next?", japanese: "\u6b21\u306f\u3069\u3046\u3057\u307e\u3059\u304b\uff1f" },
    ],
    sentenceStarter: "\u4eca\u65e5\u306f\u3001",
  };
}

function normalizeJlptLevel(value) {
  const level = String(value || "").trim().toUpperCase();
  return SUPPORTED_JLPT_LEVELS.has(level) ? level : "N4";
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

function normalizeGrammarTarget(value, fallbackLevel = "N4") {
  if (!value || typeof value !== "object") return null;
  const japanese = sanitizeString(value.japanese);
  if (!japanese) return null;
  return {
    id: sanitizeString(value.id),
    level: normalizeJlptLevel(value.level || fallbackLevel),
    japanese,
    meaning: sanitizeString(value.meaning, "use this grammar naturally"),
  };
}

function sanitizeFuriganaString(value, fallback = "") {
  const text = sanitizeString(value, fallback);

  return text
    .replace(/<[^>]*>/g, "")
    .replace(/\[([^\]]{20,})\]/g, "")
    .slice(0, 1000);
}

function sanitizeBoolean(value) {
  return value === true || String(value).toLowerCase() === "true";
}

function clampInteger(value, minimum, maximum) {
  const number = Math.round(Number(value));
  if (!Number.isFinite(number)) {
    return minimum;
  }

  return Math.min(maximum, Math.max(minimum, number));
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
