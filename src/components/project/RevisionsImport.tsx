"use client";

import { useState } from "react";

export function RevisionsImport({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    const res = await fetch(`/api/projects/${projectId}/revisions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(json.error);
      return;
    }
    setResult(
      json.count > 0
        ? `Добавлено ${json.count} комментариев на соответствующие кадры. Откройте «💬 Комментарии» на кадре, чтобы посмотреть.`
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
        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="self-start rounded bg-white text-neutral-900 text-sm font-medium px-4 py-1.5 disabled:opacity-50"
        >
          {busy ? "Разбираем правки…" : "Применить"}
        </button>
      </form>
      {result && <p className="text-xs text-emerald-400 mt-2">{result}</p>}
      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
    </div>
  );
}
