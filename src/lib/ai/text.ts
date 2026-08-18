import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { TextProviderId } from "./text-types";

export type { TextProviderId } from "./text-types";
export { TEXT_PROVIDER_LABEL } from "./text-types";

// Shared "call an LLM, get JSON back" layer used by breakdown.ts and
// revisions.ts, so both can run on OpenAI or on Gemini (which has a
// genuinely free tier — no card required — for the flash models this
// defaults to) without duplicating provider plumbing.

export function availableTextProviders(): TextProviderId[] {
  const list: TextProviderId[] = [];
  if (process.env.GOOGLE_API_KEY) list.push("gemini");
  if (process.env.OPENAI_API_KEY) list.push("openai");
  return list;
}

// No explicit choice from the caller → prefer whichever is configured,
// with Gemini first since it's the free option.
export function resolveDefaultTextProvider(): TextProviderId {
  const available = availableTextProviders();
  if (available.length === 0) {
    throw new Error("Не настроена ни одна текстовая LLM — задайте GOOGLE_API_KEY или OPENAI_API_KEY");
  }
  return available[0];
}

export async function generateJSON(
  provider: TextProviderId,
  systemPrompt: string,
  userPrompt: string,
  temperature = 0.3
): Promise<string> {
  return provider === "gemini"
    ? generateJSONWithGemini(systemPrompt, userPrompt, temperature)
    : generateJSONWithOpenAI(systemPrompt, userPrompt, temperature);
}

async function generateJSONWithOpenAI(systemPrompt: string, userPrompt: string, temperature: number) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set — add it to .env.local");

  const client = new OpenAI({ apiKey });
  const model = process.env.OPENAI_TEXT_MODEL || "gpt-4o-mini";

  let completion;
  try {
    completion = await client.chat.completions.create({
      model,
      temperature,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });
  } catch (err) {
    console.error("[ai/text] OpenAI call failed:", err);
    throw err;
  }

  const choice = completion.choices[0];
  if (choice?.finish_reason === "length") {
    throw new Error("Ответ модели обрезан по лимиту токенов — попробуйте сократить сценарий или разбить его на части");
  }
  const raw = choice?.message?.content;
  if (!raw) {
    console.error("[ai/text] OpenAI returned no content, full response:", JSON.stringify(completion));
    throw new Error("OpenAI returned an empty response");
  }
  return raw;
}

async function generateJSONWithGemini(systemPrompt: string, userPrompt: string, temperature: number) {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_API_KEY is not set — add it to .env.local");

  const genAI = new GoogleGenerativeAI(apiKey);
  // gemini-2.5-flash 404s for new API keys now ("no longer available to
  // new users" per the live API) — verified gemini-3.6-flash works on
  // the free tier with a real key before defaulting to it here.
  const modelName = process.env.GOOGLE_TEXT_MODEL || "gemini-3.6-flash";
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: systemPrompt,
    generationConfig: { temperature, responseMimeType: "application/json", maxOutputTokens: 32768 },
  });

  let result;
  try {
    result = await model.generateContent(userPrompt);
  } catch (err) {
    console.error("[ai/text] Gemini call failed:", err);
    throw err;
  }

  const candidate = result.response.candidates?.[0];
  const finishReason = candidate?.finishReason;
  if (finishReason && finishReason !== "STOP") {
    console.error("[ai/text] Gemini finished abnormally:", finishReason, JSON.stringify(candidate?.safetyRatings));
    if (finishReason === "MAX_TOKENS") {
      throw new Error("Ответ модели обрезан по лимиту токенов — попробуйте сократить сценарий или разбить его на части");
    }
    if (finishReason === "SAFETY" || finishReason === "PROHIBITED_CONTENT" || finishReason === "RECITATION") {
      throw new Error(`Gemini заблокировал ответ (${finishReason}) — попробуйте другой провайдер (OpenAI) или переформулируйте текст`);
    }
    throw new Error(`Gemini не завершил генерацию нормально (${finishReason})`);
  }

  let raw: string;
  try {
    raw = result.response.text();
  } catch (err) {
    console.error("[ai/text] Gemini response.text() threw:", err, JSON.stringify(result.response));
    throw new Error("Gemini не вернул текстовый ответ — попробуйте другой провайдер (OpenAI)");
  }
  if (!raw) throw new Error("Gemini returned an empty response");
  return raw;
}
