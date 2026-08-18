"use client";

import { useState } from "react";
import type { ShotWithGeneration } from "@/lib/types";
import { CommentDrawer } from "./CommentDrawer";
import { ImageLightbox } from "./ImageLightbox";

const STATUS_LABEL: Record<string, string> = {
  draft: "Черновик",
  generating: "Генерируется…",
  needs_review: "На проверке",
  approved: "Утверждено",
  needs_regen: "Нужна перегенерация",
};

const STATUS_COLOR: Record<string, string> = {
  draft: "bg-neutral-700 text-neutral-200",
  generating: "bg-amber-700 text-amber-100",
  needs_review: "bg-blue-700 text-blue-100",
  approved: "bg-emerald-700 text-emerald-100",
  needs_regen: "bg-red-700 text-red-100",
};

export function ShotCard({
  shot,
  index,
  canEdit,
  onUpdate,
  onDelete,
  onGenerate,
}: {
  shot: ShotWithGeneration;
  index: number;
  canEdit: boolean;
  onUpdate: (patch: Record<string, unknown>) => void;
  onDelete: () => void;
  onGenerate: (opts: {
    provider: "openai" | "gemini" | "pollinations";
    prompt?: string;
    aspectRatio: "16:9" | "9:16" | "1:1" | "4:5";
    quality: "low" | "medium" | "high";
  }) => Promise<void>;
}) {
  const [customPrompt, setCustomPrompt] = useState(shot.prompt);
  const [provider, setProvider] = useState<"openai" | "gemini" | "pollinations">("pollinations");
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16" | "1:1" | "4:5">("16:9");
  const [quality, setQuality] = useState<"low" | "medium" | "high">("medium");
  const [generating, setGenerating] = useState(false);
  const [showVO, setShowVO] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  async function handleGenerate() {
    setGenerating(true);
    try {
      await onGenerate({
        provider,
        prompt: customPrompt !== shot.prompt ? customPrompt : undefined,
        aspectRatio,
        quality,
      });
    } finally {
      setGenerating(false);
    }
  }

  const imageUrl = shot.activeGeneration?.asset_url ?? null;

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 flex flex-col sm:flex-row gap-4">
      {/* Left: frame */}
      <div className="relative w-full sm:w-64 shrink-0">
        <div className="aspect-video rounded-lg overflow-hidden bg-black flex items-center justify-center">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={`Кадр ${index + 1}`}
              onClick={() => setLightboxOpen(true)}
              className="w-full h-full object-cover cursor-zoom-in"
            />
          ) : (
            <span className="text-neutral-600 text-xs">
              {generating || shot.status === "generating" ? "Генерируется…" : "Нет изображения"}
            </span>
          )}
        </div>
        <span className="absolute top-2 left-2 text-[10px] font-mono bg-black/70 text-white px-1.5 py-0.5 rounded">
          {String(index + 1).padStart(2, "0")}
        </span>
      </div>
      {lightboxOpen && imageUrl && (
        <ImageLightbox src={imageUrl} alt={`Кадр ${index + 1}`} onClose={() => setLightboxOpen(false)} />
      )}

      {/* Right: editorial detail */}
      <div className="flex-1 min-w-0 flex flex-col gap-3 text-neutral-200">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {shot.duration_seconds ? (
            <span className="text-neutral-400">{shot.duration_seconds} сек</span>
          ) : null}
          {shot.tags?.map((tag) => (
            <span key={tag} className="rounded-full bg-neutral-800 px-2 py-0.5 text-neutral-300">
              {tag}
            </span>
          ))}
          <span className={`rounded-full px-2 py-0.5 ${STATUS_COLOR[shot.status] ?? "bg-neutral-700"}`}>
            {STATUS_LABEL[shot.status] ?? shot.status}
          </span>
        </div>

        {shot.line_text ? (
          <div className="border-l-2 border-amber-500 bg-neutral-800/60 rounded px-3 py-2 italic text-sm">
            {shot.line_text}
          </div>
        ) : null}

        <div className="grid sm:grid-cols-2 gap-3 text-xs">
          {(shot.emotion_notes || canEdit) && (
            <div>
              <div className="uppercase tracking-wide text-neutral-500 mb-1">Эмоция и подача</div>
              {canEdit ? (
                <textarea
                  defaultValue={shot.emotion_notes ?? ""}
                  onBlur={(e) => onUpdate({ emotion_notes: e.target.value })}
                  rows={2}
                  className="w-full rounded bg-neutral-800 border border-neutral-700 px-2 py-1 text-neutral-200"
                />
              ) : (
                <p className="text-neutral-300">{shot.emotion_notes}</p>
              )}
            </div>
          )}
          {(shot.editing_notes || canEdit) && (
            <div>
              <div className="uppercase tracking-wide text-neutral-500 mb-1">ТЗ к монтажу</div>
              {canEdit ? (
                <textarea
                  defaultValue={shot.editing_notes ?? ""}
                  onBlur={(e) => onUpdate({ editing_notes: e.target.value })}
                  rows={2}
                  className="w-full rounded bg-neutral-800 border border-neutral-700 px-2 py-1 text-neutral-200"
                />
              ) : (
                <p className="text-neutral-300">{shot.editing_notes}</p>
              )}
            </div>
          )}
        </div>

        {(shot.sound_notes || canEdit) && (
          <div className="text-xs">
            <div className="uppercase tracking-wide text-neutral-500 mb-1">Звук</div>
            {canEdit ? (
              <textarea
                defaultValue={shot.sound_notes ?? ""}
                onBlur={(e) => onUpdate({ sound_notes: e.target.value })}
                rows={1}
                className="w-full rounded bg-neutral-800 border border-neutral-700 px-2 py-1 text-neutral-200"
              />
            ) : (
              <p className="text-neutral-300">{shot.sound_notes}</p>
            )}
          </div>
        )}

        {shot.voiceover_text ? (
          <div className="text-xs">
            <button
              onClick={() => setShowVO((v) => !v)}
              className="text-neutral-500 hover:text-neutral-300"
            >
              {showVO ? "▾" : "▸"} Версия для диктора и ElevenLabs
            </button>
            {showVO && (
              <p className="mt-1 text-neutral-300 border-l-2 border-neutral-700 pl-2">{shot.voiceover_text}</p>
            )}
          </div>
        ) : null}

        {/* Prompt + regenerate */}
        {canEdit && (
          <div className="border-t border-neutral-800 pt-3 flex flex-col gap-2">
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              rows={2}
              placeholder="Промпт для генерации изображения…"
              className="w-full rounded bg-neutral-800 border border-neutral-700 px-2 py-1 text-xs text-neutral-200"
            />
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as "openai" | "gemini" | "pollinations")}
                className="rounded bg-neutral-800 border border-neutral-700 px-2 py-1 text-xs"
              >
                <option value="pollinations">Pollinations.ai (бесплатно)</option>
                <option value="openai">OpenAI (GPT Image)</option>
                <option value="gemini">Google (Nano Banana)</option>
              </select>
              <select
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value as typeof aspectRatio)}
                title="Соотношение сторон"
                className="rounded bg-neutral-800 border border-neutral-700 px-2 py-1 text-xs"
              >
                <option value="16:9">16:9 (широкий)</option>
                <option value="9:16">9:16 (вертикальный)</option>
                <option value="1:1">1:1 (квадрат)</option>
                <option value="4:5">4:5 (портрет)</option>
              </select>
              <select
                value={quality}
                onChange={(e) => setQuality(e.target.value as typeof quality)}
                title={provider === "gemini" ? "Не поддерживается Nano Banana" : "Качество / разрешение"}
                disabled={provider === "gemini"}
                className="rounded bg-neutral-800 border border-neutral-700 px-2 py-1 text-xs disabled:opacity-40"
              >
                <option value="low">Низкое (быстрее)</option>
                <option value="medium">Среднее</option>
                <option value="high">Высокое</option>
              </select>
              <button
                onClick={() => {
                  if (customPrompt !== shot.prompt) onUpdate({ prompt: customPrompt });
                  handleGenerate();
                }}
                disabled={generating}
                className="rounded bg-white text-neutral-900 text-xs font-medium px-3 py-1.5 disabled:opacity-50"
              >
                {generating ? "Генерация…" : imageUrl ? "Перегенерировать" : "Сгенерировать"}
              </button>
              <button
                onClick={() => setShowComments((v) => !v)}
                className="rounded border border-neutral-700 text-xs px-3 py-1.5 text-neutral-300"
              >
                💬 Комментарии
              </button>
              {shot.status !== "approved" && (
                <button
                  onClick={() => onUpdate({ status: "approved" })}
                  className="text-xs text-emerald-400 hover:text-emerald-300"
                >
                  Утвердить
                </button>
              )}
              <button onClick={onDelete} className="text-xs text-red-500 hover:text-red-400 ml-auto">
                Удалить кадр
              </button>
            </div>
          </div>
        )}

        {!canEdit && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowComments((v) => !v)}
              className="rounded border border-neutral-700 text-xs px-3 py-1.5 text-neutral-300"
            >
              💬 Комментарии
            </button>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="rounded border border-neutral-700 text-xs px-3 py-1.5 text-neutral-300 disabled:opacity-50"
            >
              {generating ? "Генерация…" : "Сгенерировать свой вариант"}
            </button>
          </div>
        )}

        {showComments && <CommentDrawer projectId={shot.project_id} targetType="shot" targetId={shot.id} />}
      </div>
    </div>
  );
}
