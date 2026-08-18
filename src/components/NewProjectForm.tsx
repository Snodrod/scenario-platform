"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function NewProjectForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [format, setFormat] = useState<"long" | "short">("long");
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, format }),
    });
    const json = await res.json();

    if (!res.ok) {
      setError(json.error ?? "Не удалось создать проект");
      setSubmitting(false);
      return;
    }

    router.push(`/project/${json.project.id}`);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-white text-neutral-900 text-sm font-medium px-4 py-2"
      >
        + Новый проект
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-neutral-800 bg-neutral-900 p-4 flex flex-col gap-3 max-w-md">
      <input
        autoFocus
        required
        placeholder="Название проекта"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="rounded-lg border border-neutral-700 bg-neutral-800 text-neutral-100 px-3 py-2 text-sm outline-none focus:border-neutral-400"
      />
      <div className="flex gap-4 text-sm text-neutral-300">
        <label className="flex items-center gap-2">
          <input type="radio" checked={format === "long"} onChange={() => setFormat("long")} />
          Длинный ролик
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" checked={format === "short"} onChange={() => setFormat("short")} />
          Короткий (Shorts/Reels)
        </label>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-white text-neutral-900 text-sm font-medium px-4 py-2 disabled:opacity-50"
        >
          {submitting ? "Создаём…" : "Создать"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-neutral-500">
          Отмена
        </button>
      </div>
    </form>
  );
}
