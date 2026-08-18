"use client";

import { useState } from "react";
import { TEXT_PROVIDER_LABEL, type TextProviderId } from "@/lib/ai/text-types";
import { fetchJson } from "@/lib/fetch-json";

export function RevisionsImport({
  projectId,
  textProviders,
}: {
  projectId: string;
  textProviders: TextProviderId[];
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [provider, setProvider] = useState<TextProviderId | undefined>(textProviders[0]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    const { ok, data, error: err } = await fetchJson<{ count: number }>(`/api/projects/${projectId}/revisions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, provider }),
    });
    setBusy(false);
    if (!ok || !data) {
      setError(err);
      return;
    }
    setResult(
      data.count > 0
        ? `Добавлено ${data.count} комментариев на соответствующие кадры. Откройте «💬 Комментарии» на кадре, чтобы посмотреть.`
        : "Не удалось привязать ни одной правки к конкретному кадру — попробуйте уточнить формулировки или номера кадров."
    );
    setText("");
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-sm text-neutral-400 hover:text-neutral-200">
        📋 Внести правки списком
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium text-neutral-200">Внести правки списком</h4>
        <button onClick={() => setOpen(false)} className="text-neutral-500 text-sm">
          ✕
        </button>
      </div>
      <p className="text-xs text-neutral-500 mb-2">
        Вставьте текст правок как есть (из письма, чата и т.п.) — модель сама определит, к какому кадру
        относится каждая правка, и добавит комментарии.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <textarea
          required
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          placeholder="Кадр 3 — поменять план на общий...&#10;В сцене с журавлями слишком тёмно...&#10;..."
          className="w-full rounded bg-neutral-800 border border-neutral-700 px-2 py-1.5 text-sm text-neutral-100 font-mono"
        />
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={busy || !text.trim() || !provider}
            className="self-start rounded bg-white text-neutral-900 text-sm font-medium px-4 py-1.5 disabled:opacity-50"
          >
            {busy ? "Разбираем правки…" : "Применить"}
          </button>
          {textProviders.length > 0 ? (
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as TextProviderId)}
              className="rounded border border-neutral-700 bg-neutral-800 text-xs px-2 py-1.5 text-neutral-300"
            >
              {textProviders.map((p) => (
                <option key={p} value={p}>
                  {TEXT_PROVIDER_LABEL[p]}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-xs text-red-500">Не настроена ни одна текстовая LLM</span>
          )}
        </div>
      </form>
      {result && <p className="text-xs text-emerald-400 mt-2">{result}</p>}
      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
    </div>
  );
}
