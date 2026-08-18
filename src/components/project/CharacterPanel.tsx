"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CharacterRow } from "@/lib/types";
import { fetchJson } from "@/lib/fetch-json";

export function CharacterPanel({
  projectId,
  initialCharacters,
  canEdit,
}: {
  projectId: string;
  initialCharacters: CharacterRow[];
  canEdit: boolean;
}) {
  const [characters, setCharacters] = useState<CharacterRow[]>(initialCharacters);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);

    const supabase = createClient();
    const referenceAssetUrls: string[] = [];

    if (files) {
      for (const file of Array.from(files)) {
        const path = `characters/${projectId}/${crypto.randomUUID()}-${file.name}`;
        const { error } = await supabase.storage.from("assets").upload(path, file);
        if (!error) {
          const { data } = supabase.storage.from("assets").getPublicUrl(path);
          referenceAssetUrls.push(data.publicUrl);
        }
      }
    }

    const { ok, data, error } = await fetchJson<{ character: CharacterRow }>("/api/characters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, name, description, referenceAssetUrls }),
    });
    setBusy(false);
    if (!ok || !data) {
      window.alert(error);
      return;
    }
    setCharacters((prev) => [...prev, data.character]);
    setName("");
    setDescription("");
    setFiles(null);
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Удалить персонажа?")) return;
    setCharacters((prev) => prev.filter((c) => c.id !== id));
    await fetch(`/api/characters/${id}`, { method: "DELETE" });
  }

  return (
    <div className="flex flex-col gap-6">
      {characters.length === 0 ? (
        <p className="text-sm text-neutral-500">
          Персонажей пока нет. Добавьте их с референс-изображениями — тогда генерация кадров будет
          подставлять нужный образ, если в промпте упомянуто имя персонажа.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {characters.map((c) => (
            <li key={c.id} className="rounded-lg border border-neutral-800 bg-neutral-900 p-3">
              <div className="flex gap-2 mb-2">
                {(c.reference_asset_urls ?? []).slice(0, 3).map((url) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={url} src={url} alt={c.name} className="w-12 h-12 rounded object-cover" />
                ))}
              </div>
              <div className="font-medium text-sm text-neutral-100">{c.name}</div>
              <div className="text-xs text-neutral-500 mb-1">токен: {c.prompt_token}</div>
              {c.description && <p className="text-xs text-neutral-400">{c.description}</p>}
              {canEdit && (
                <button onClick={() => handleDelete(c.id)} className="mt-2 text-xs text-red-500 hover:text-red-400">
                  Удалить
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <form onSubmit={handleAdd} className="rounded-lg border border-neutral-800 p-4 flex flex-col gap-2 max-w-md">
          <h4 className="text-sm font-medium text-neutral-200">Новый персонаж</h4>
          <input
            required
            placeholder="Имя"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded bg-neutral-800 border border-neutral-700 px-2 py-1.5 text-sm text-neutral-100"
          />
          <textarea
            placeholder="Описание внешности/характера"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="rounded bg-neutral-800 border border-neutral-700 px-2 py-1.5 text-sm text-neutral-100"
          />
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setFiles(e.target.files)}
            className="text-xs text-neutral-400"
          />
          <button
            type="submit"
            disabled={busy}
            className="self-start rounded bg-white text-neutral-900 text-sm font-medium px-4 py-1.5 disabled:opacity-50"
          >
            {busy ? "Добавляем…" : "Добавить"}
          </button>
        </form>
      )}
    </div>
  );
}
