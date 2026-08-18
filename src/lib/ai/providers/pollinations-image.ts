import type { ImageProvider } from "../types";

// Genuinely free, no API key, no billing — a public generative endpoint.
// Text-to-image only (no reference-image conditioning), so character
// consistency has to ride on the prompt text alone. Verified live before
// wiring this in: a plain GET against image.pollinations.ai returned a
// real image in a few seconds.
function dimensionsFor(aspectRatio?: string) {
  switch (aspectRatio) {
    case "9:16":
      return { width: 768, height: 1365 };
    case "16:9":
      return { width: 1365, height: 768 };
    case "4:5":
      return { width: 1024, height: 1280 };
    default:
      return { width: 1024, height: 1024 };
  }
}

export const pollinationsImageProvider: ImageProvider = {
  id: "pollinations",
  label: "Pollinations.ai (бесплатно, без ключа)",

  async generate({ prompt, referenceImageUrls, aspectRatio }) {
    const { width, height } = dimensionsFor(aspectRatio);
    // Pollinations caches by URL — vary the seed so "regenerate" actually
    // produces a different image instead of the cached previous one.
    const seed = Math.floor(Math.random() * 1_000_000_000);

    const fullPrompt = referenceImageUrls?.length
      ? `${prompt}. Keep the character's appearance consistent with prior shots.`
      : prompt;

    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?width=${width}&height=${height}&nologo=true&seed=${seed}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Pollinations image generation failed: ${res.status}`);

    const bytes = Buffer.from(await res.arrayBuffer());
    const mimeType = res.headers.get("content-type") || "image/jpeg";
    return { bytes, mimeType };
  },
};
