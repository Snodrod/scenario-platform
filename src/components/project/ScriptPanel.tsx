"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImportMenu } from "./ImportMenu";
import { TEXT_PROVIDER_LABEL, type TextProviderId } from "@/lib/ai/text-types";

export function ScriptPanel({
  scriptId,
  projectId,
  initialContent,
  canEdit,
  hasScenes,
  driveConfigured,
  driveConnected,
  notionConfigured,
  textProviders,
  onStoryboardImported,
}: {
  scriptId: string;
  projectId: string;
  initialContent: string;
  canEdit: boolean;
  hasScenes: boolean;
  driveConfigured: boolean;
  driveConnected: boolean;
  notionConfigured: boolean;
  textProviders: TextProviderId[];
  onStoryboardImported: () => void;
}) {
  const router = useRouter();
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const [breaking, setBreaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [provider, setProvider] = useState<TextProviderId | undefined>(textProviders[0]);

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/scripts/${scriptId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    setSaving(false);
    if (!res.ok) {
      const json = await res.json();
      setError(json.error);
      return;
    }
    setSavedAt(new Date());
  }

  async function runBreakdown() {
    if (hasScenes) {
      const ok = window.confirm(
        "Это заменит текущую раскадровку (сцены, кадры, сгенерированные изображения и комментарии к ним будут удалены). Продолжить?"
      );
      if (!ok) return;
    }
    setBreaking(true);
    setError(null);
    await save();
    const res = await fetch(`/api/projects/${projectId}/breakdown`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider }),
    });
    setBreaking(false);
    if (!res.ok) {
      const json = await res.json();
      setError(json.error);
      return;
    }
    router.refresh();
  }

  function handleImport(text: string) {
    if (content.trim() && content.trim() !== text.trim()) {
      const ok = window.confirm("Заменить текущий текст сценария импортированным содержимым?");
      if (!ok) return;
    }
    setContent(text);
    setError(null);
  }

  function handleStructuredImport(summary: { sceneCount: number; shotCount: number; imagesImported: number }) {
    setImportResult(
      `Найдена готовая раскадровка — импортировано ${summary.sceneCount} сцен, ${summary.shotCount} кадров, ${summary.imagesImported} изображений. Открываю «Раскадровку».`
    );
    onStoryboardImported();
  }

  return (
    <div className="flex flex-col gap-3">
      {canEdit && (
        <ImportMenu
          projectId={projectId}
          driveConfigured={driveConfigured}
          driveConnected={driveConnected}
          notionConfigured={notionConfigured}
          hasScenes={hasScenes}
          onImport={handleImport}
          onStructuredImport={handleStructuredImport}
        />
      )}
      {importResult && <p className="text-sm text-emerald-400">{importResult}</p>}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        readOnly={!canEdit}
        rows={20}
        placeholder="Вставьте или напишите сценарий здесь…"
        className="w-full rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-100 px-3 py-2 text-sm font-mono leading-relaxed outline-none focus:border-neutral-600"
      />
      {canEdit && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg border border-neutral-700 text-sm px-4 py-2 text-neutral-200 disabled:opacity-50"
          >
            {saving ? "Сохраняем…" : "Сохранить"}
          </button>
          <button
            onClick={runBreakdown}
            disabled={breaking || !content.trim() || !provider}
            className="rounded-lg bg-white text-neutral-900 text-sm font-medium px-4 py-2 disabled:opacity-50"
          >
            {breaking ? "Разбиваем на сцены…" : hasScenes ? "Разбить заново" : "Разбить на сцены"}
          </button>
          {textProviders.length > 0 ? (
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as TextProviderId)}
              className="rounded-lg border border-neutral-700 bg-neutral-900 text-sm px-2 py-2 text-neutral-300"
            >
              {textProviders.map((p) => (
                <option key={p} value={p}>
                  {TEXT_PROVIDER_LABEL[p]}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-xs text-red-500">
              Не настроена ни одна текстовая LLM — задайте OPENAI_API_KEY или GOOGLE_API_KEY
            </span>
          )}
          {savedAt && <span className="text-xs text-neutral-500">Сохранено {savedAt.toLocaleTimeString()}</span>}
        </div>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
