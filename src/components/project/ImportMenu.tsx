"use client";

import { useState } from "react";

type DriveFile = { id: string; name: string; mimeType: string; modifiedTime?: string };
type Tab = "file" | "gdoc" | "drive";

export function ImportMenu({
  projectId,
  driveConfigured,
  driveConnected,
  onImport,
}: {
  projectId: string;
  driveConfigured: boolean;
  driveConnected: boolean;
  onImport: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("file");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gdocUrl, setGdocUrl] = useState("");
  const [driveFiles, setDriveFiles] = useState<DriveFile[] | null>(null);

  function handleResult(text: string) {
    onImport(text);
    setOpen(false);
    setError(null);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/import/file", { method: "POST", body: form });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) return setError(json.error);
    handleResult(json.text);
  }

  async function handleGdoc(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/import/gdoc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: gdocUrl }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) return setError(json.error);
    handleResult(json.text);
  }

  async function openDriveTab() {
    setTab("drive");
    if (!driveConnected || driveFiles) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/import/drive/list");
    const json = await res.json();
    setBusy(false);
    if (!res.ok) return setError(json.error);
    setDriveFiles(json.files);
  }

  async function handlePickDriveFile(fileId: string) {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/import/drive/fetch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileId }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) return setError(json.error);
    handleResult(json.text);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-neutral-700 text-sm px-4 py-2 text-neutral-200"
      >
        Импортировать сценарий
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4 max-w-lg">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-neutral-200">Импортировать сценарий</h4>
        <button onClick={() => setOpen(false)} className="text-neutral-500 text-sm">
          ✕
        </button>
      </div>

      <div className="flex gap-1 border-b border-neutral-800 mb-3 text-xs">
        {([
          ["file", "Файл (PDF/DOCX)"],
          ["gdoc", "Ссылка на Google Doc"],
          ["drive", "Google Drive"],
        ] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => (t === "drive" ? openDriveTab() : setTab(t))}
            className={`px-3 py-1.5 border-b-2 -mb-px ${
              tab === t ? "border-white text-white" : "border-transparent text-neutral-500"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "file" && (
        <div>
          <input
            type="file"
            accept=".pdf,.docx,.txt"
            onChange={handleFile}
            disabled={busy}
            className="text-xs text-neutral-400"
          />
          <p className="text-xs text-neutral-500 mt-2">PDF, DOCX или .txt, до 15 МБ.</p>
        </div>
      )}

      {tab === "gdoc" && (
        <form onSubmit={handleGdoc} className="flex flex-col gap-2">
          <input
            required
            placeholder="https://docs.google.com/document/d/…"
            value={gdocUrl}
            onChange={(e) => setGdocUrl(e.target.value)}
            className="rounded bg-neutral-800 border border-neutral-700 px-2 py-1.5 text-sm text-neutral-100"
          />
          <p className="text-xs text-neutral-500">
            Документ должен быть открыт по ссылке («Все, у кого есть ссылка — Читатель»).
          </p>
          <button
            type="submit"
            disabled={busy}
            className="self-start rounded bg-white text-neutral-900 text-sm font-medium px-4 py-1.5 disabled:opacity-50"
          >
            {busy ? "Загружаем…" : "Импортировать"}
          </button>
        </form>
      )}

      {tab === "drive" && (
        <div>
          {!driveConfigured ? (
            <p className="text-xs text-neutral-500">
              Google Drive import ещё не настроен на сервере — нужны GOOGLE_OAUTH_CLIENT_ID/SECRET (см. README).
            </p>
          ) : !driveConnected ? (
            <a
              href={`/api/import/drive/connect?projectId=${projectId}`}
              className="inline-block rounded bg-white text-neutral-900 text-sm font-medium px-4 py-1.5"
            >
              Подключить Google Drive
            </a>
          ) : busy && !driveFiles ? (
            <p className="text-xs text-neutral-500">Загружаем список файлов…</p>
          ) : (
            <ul className="max-h-64 overflow-y-auto flex flex-col gap-1">
              {(driveFiles ?? []).length === 0 && (
                <li className="text-xs text-neutral-500">Подходящих файлов (Docs/PDF/DOCX) не найдено.</li>
              )}
              {(driveFiles ?? []).map((f) => (
                <li key={f.id}>
                  <button
                    onClick={() => handlePickDriveFile(f.id)}
                    disabled={busy}
                    className="w-full text-left text-sm text-neutral-200 hover:bg-neutral-800 rounded px-2 py-1.5 disabled:opacity-50"
                  >
                    {f.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
    </div>
  );
}
