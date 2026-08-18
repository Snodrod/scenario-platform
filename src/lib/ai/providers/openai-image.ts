import OpenAI from "openai";
import type { ImageProvider } from "../types";

// Text-to-image only for now — gpt-image-1 does support image inputs via
// images.edit, but wiring true multi-reference character consistency is
// left to the Gemini provider below, which handles it more directly.
export const openaiImageProvider: ImageProvider = {
  id: "openai",
  label: "OpenAI (GPT Image)",

  async generate({ prompt, referenceImageUrls, aspectRatio, quality }) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not set — add it to .env.local");

    const client = new OpenAI({ apiKey });
    const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
    const size = aspectRatio === "9:16" ? "1024x1536" : aspectRatio === "16:9" ? "1536x1024" : "1024x1024";

    const fullPrompt = referenceImageUrls?.length
      ? `${prompt}\n\n(Держи визуальный стиль/образ персонажей согласованным с проектом.)`
      : prompt;

    const result = await client.images.generate({
      model,
      prompt: fullPrompt,
      size,
      quality: quality ?? "medium", // real gpt-image-1 param — higher quality costs more per image
      n: 1,
    });

    const b64 = result.data?.[0]?.b64_json;
    if (!b64) throw new Error("OpenAI image generation returned no data");

    return { bytes: Buffer.from(b64, "base64"), mimeType: "image/png" };
  },
};
