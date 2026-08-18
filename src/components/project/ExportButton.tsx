"use client";

import { useState } from "react";

export function ExportButton({ projectId }: { projectId: string }) {
  const [busy, setBusy] = useState(false);

  async function handleExport() {
    setBusy(true);
    const res = await fetch(`/api/projects/${projectId}/export/pdf`);
    if (!res.ok) {
      window.alert("Не удалось экспортировать PDF");
      setBusy(false);
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "storyboard.pdf";
    a.click();
    URL.revokeObjectURL(url);
    setBusy(false);
  }

  return (
    <button
      onClick={handleExport}
      disabled={busy}
      className="rounded-lg border border-neutral-700 text-sm px-4 py-2 text-neutral-200 disabled:opacity-50"
    >
      {busy ? "Готовим PDF…" : "Экспорт в PDF"}
    </button>
  );
}
