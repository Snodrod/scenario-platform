// Shared AI-layer types. Every provider (text, image today; voice, music,
// video in later phases) implements one of these small interfaces so the
// rest of the app never talks to OpenAI/Gemini/etc. directly.

export interface SceneDraft {
  orderIndex: number;
  title: string;
  summary: string;
  sourceText: string; // the excerpt of the script this scene covers
  shots: ShotDraft[];
}

export interface ShotDraft {
  orderIndex: number;
  prompt: string; // ready-to-use image generation prompt
  durationSeconds?: number;
  lineText?: string; // on-screen quote / dialogue for this shot
  emotionNotes?: string; // delivery/tone guidance (voice actor, pacing)
  editingNotes?: string; // cut/camera/graphics brief for the editor
  soundNotes?: string; // music/SFX guidance
  voiceoverText?: string; // VO script line — feeds ElevenLabs in Phase 3
  tags?: string[];
}

export interface BreakdownResult {
  scenes: SceneDraft[];
}

export interface ImageGenerationInput {
  prompt: string;
  /** Public URLs of character reference images to keep the look consistent. */
  referenceImageUrls?: string[];
  aspectRatio?: "16:9" | "9:16" | "1:1" | "4:5";
}

export interface ImageGenerationOutput {
  /** Raw image bytes — the API route uploads this to Supabase Storage. */
  bytes: Buffer;
  mimeType: string;
}

export interface ImageProvider {
  id: string;
  label: string;
  generate(input: ImageGenerationInput): Promise<ImageGenerationOutput>;
}

// --- Phase 3 extension points (not implemented yet) -------------------
// Kept here so the `generations.kind` values in the schema (voice, music,
// video) already have a home to plug into without touching call sites.

export interface VoiceGenerationInput {
  text: string;
  voiceId: string;
}

export interface VoiceProvider {
  id: string;
  label: string;
  generate(input: VoiceGenerationInput): Promise<{ bytes: Buffer; mimeType: string }>;
}

export interface MusicGenerationInput {
  prompt: string;
  durationSeconds?: number;
}

export interface MusicProvider {
  id: string;
  label: string;
  generate(input: MusicGenerationInput): Promise<{ bytes: Buffer; mimeType: string }>;
}
