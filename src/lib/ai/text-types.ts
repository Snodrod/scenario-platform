// Pure types/constants only (no SDK imports) — safe to import from
// Client Components. Server logic lives in ./text.
export type TextProviderId = "openai" | "gemini";

export const TEXT_PROVIDER_LABEL: Record<TextProviderId, string> = {
  openai: "OpenAI (платно)",
  gemini: "Google Gemini (бесплатный лимит)",
};
