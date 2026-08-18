import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ImageProvider } from "../types";

async function fetchAsInlineImage(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not fetch reference image: ${url}`);
  const mimeType = res.headers.get("content-type") || "image/png";
  const buffer = Buffer.from(await res.arrayBuffer());
  return { inlineData: { data: buffer.toString("base64"), mimeType } };
}

// "Nano Banana" — Gemini's image-generation model. Takes reference
// images as extra input parts, which is what makes it a good fit for
// keeping a character's look consistent across shots.
export const geminiImageProvider: ImageProvider = {
  id: "gemini",
  label: "Google (Nano Banana)",

  // `quality` isn't accepted — checked the installed SDK's types, no
  // imageConfig/quality knob exposed for image generation. aspectRatio
  // stays a prompt-text hint rather than a structural param for the same
  // reason (unverified whether the raw API honors an untyped field).
  async generate({ prompt, referenceImageUrls, aspectRatio }) {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) throw new Error("GOOGLE_API_KEY is not set — add it to .env.local");

    const genAI = new GoogleGenerativeAI(apiKey);
    // Image-generation models currently have a 0 request/day free-tier
    // quota (confirmed against the live API) — this call needs billing
    // enabled on the Google Cloud project behind GOOGLE_API_KEY, even
    // though Gemini's text models (used for breakdown/revisions) work
    // fine on the free tier with the same key.
    const modelName = process.env.GOOGLE_IMAGE_MODEL || "gemini-3.1-flash-image";
    const model = genAI.getGenerativeModel({ model: modelName });

    const referenceParts = await Promise.all(
      (referenceImageUrls ?? []).slice(0, 4).map(fetchAsInlineImage)
    );

    const aspectNote = aspectRatio ? ` Aspect ratio: ${aspectRatio}.` : "";
    const textPart = { text: `${prompt}${aspectNote}` };

    const result = await model.generateContent([textPart, ...referenceParts]);

    const parts = result.response.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((p) => "inlineData" in p && p.inlineData);
    if (!imagePart || !("inlineData" in imagePart) || !imagePart.inlineData) {
      throw new Error("Gemini did not return an image — try rephrasing the prompt");
    }

    return {
      bytes: Buffer.from(imagePart.inlineData.data, "base64"),
      mimeType: imagePart.inlineData.mimeType || "image/png",
    };
  },
};
