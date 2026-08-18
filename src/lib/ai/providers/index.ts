import type { ImageProvider, MusicProvider, VoiceProvider } from "../types";
import { openaiImageProvider } from "./openai-image";
import { geminiImageProvider } from "./gemini-image";
import { pollinationsImageProvider } from "./pollinations-image";

export const imageProviders: Record<string, ImageProvider> = {
  openai: openaiImageProvider,
  gemini: geminiImageProvider,
  pollinations: pollinationsImageProvider,
};

export function getImageProvider(id: string): ImageProvider {
  const provider = imageProviders[id];
  if (!provider) throw new Error(`Unknown image provider: ${id}`);
  return provider;
}

// --- Phase 3: voiceover / music providers plug in here -----------------
// Add an entry to one of these maps and the `kind: 'voice' | 'music'`
// generation flow (already modeled in supabase/schema.sql) lights up
// without any change to the shots/generations data model.
export const voiceProviders: Record<string, VoiceProvider> = {};
export const musicProviders: Record<string, MusicProvider> = {};
