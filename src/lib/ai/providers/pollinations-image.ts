import type { ImageProvider } from "../types";

// Genuinely free, no API key, no billing — a public generative endpoint.
// Text-to-image only (no reference-image conditioning), so character
// consistency has to ride on the prompt text alone. Verified live before
// wiring this in: a plain GET against image.pollinations.ai returned a
// real image in a few seconds.
//
// Rate limits (per their API docs, auth.pollinations.ai): anonymous is
// 1 request/15s, which is tight for a multi-user app. Free registration
// ("Seed" tier) gets 1 request/3s plus real watermark removal — set
// POLLINATIONS_API_TOKEN to use it via a plain Bearer header.
//
// Quality has no dedicated API param (confirmed against their docs) —
// mapped to resolution instead. A live test requesting 2048x2048 came
// back downscaled to 768x768 on the anonymous tier, so "high" here is a
// request, not a guarantee — a registered token may raise the real cap.
const QUALITY_SCALE: Record<string, number> = { low: 0.5, medium: 1, high: 1.5 };

function dimensionsFor(aspectRatio: string | undefined, quality: string | undefined) {
  const base =
    aspectRatio === "9:16"
      ? { width: 768, height: 1365 }
      : aspectRatio === "16:9"
        ? { width: 1365, height: 768 }
        : aspectRatio === "4:5"
          ? { width: 1024, height: 1280 }
          : { width: 1024, height: 1024 };

  const scale = QUALITY_SCALE[quality ?? "medium"] ?? 1;
  return {
    width: Math.round((base.width * scale) / 8) * 8,
    height: Math.round((base.height * scale) / 8) * 8,
  };
}

export const pollinationsImageProvider: ImageProvider = {
  id: "pollinations",
  label: "Pollinations.ai (бесплатно, без ключа)",

  async generate({ prompt, referenceImageUrls, aspectRatio, quality }) {
    const { width, height } = dimensionsFor(aspectRatio, quality);
    // Pollinations caches by URL — vary the seed so "regenerate" actually
    // produces a different image instead of the cached previous one.
    const seed = Math.floor(Math.random() * 1_000_000_000);

    const fullPrompt = referenceImageUrls?.length
      ? `${prompt}. Keep the character's appearance consistent with prior shots.`
      : prompt;

    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?width=${width}&height=${height}&nologo=true&seed=${seed}`;
    const token = process.env.POLLINATIONS_API_TOKEN;
    const res = await fetch(url, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
    if (res.status === 429) {
      throw new Error("Pollinations: превышен лимит запросов — подождите немного и попробуйте снова");
    }
    if (!res.ok) throw new Error(`Pollinations image generation failed: ${res.status}`);

    const bytes = Buffer.from(await res.arrayBuffer());
    const mimeType = res.headers.get("content-type") || "image/jpeg";
    return { bytes, mimeType };
  },
};
