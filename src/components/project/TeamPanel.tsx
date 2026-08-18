"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { MemberRole } from "@/lib/supabase/types";
import { fetchJson } from "@/lib/fetch-json";

interface MemberWithEmail {
  user_id: string;
  role: MemberRole;
  email: string | null;
}

const ROLE_LABEL: Record<MemberRole, string> = {
  owner: "Владелец",
  co_writer: "Соавтор",
  client: "Клиент",
  viewer: "Наблюдатель",
};

export function TeamPanel({
  projectId,
  initialMembers,
  ownerEmail,
}: {
  projectId: string;
  initialMembers: MemberWithEmail[];
  ownerEmail: string | null;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("client");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const { ok, error } = await fetchJson(`/api/projects/${projectId}/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    setBusy(false);
    if (!ok) {
      setMessage(`Ошибка: ${error}`);
      return;
    }
    await copyProjectLink();
    setMessage(`Добавлен(а): ${email}. Ссылка на проект скопирована — отправьте её сами (мессенджер, почта и т.п.), вход через Google по этому же адресу.`);
    setEmail("");
    router.refresh();
  }

  async function copyProjectLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      // Clipboard API can fail (no permission, non-secure context) —
      // non-fatal, the link is still visible in the address bar.
    }
  }

  async function handleCopyLink(member: MemberWithEmail) {
    setBusyMemberId(member.user_id);
    await copyProjectLink();
    setBusyMemberId(null);
    setMessage(`Ссылка на проект скопирована — отправьте её ${member.email ?? "участнику"} сами.`);
  }

  async function handleRemove(member: MemberWithEmail) {
    if (!window.confirm(`Убрать ${member.email ?? "этого участника"} из проекта?`)) return;
    setBusyMemberId(member.user_id);
    setMessage(null);
    const { ok, error } = await fetchJson(`/api/projects/${projectId}/members/${member.user_id}`, {
      method: "DELETE",
    });
    setBusyMemberId(null);
    if (!ok) {
      setMessage(`Ошибка: ${error}`);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <div>
        <h4 className="text-sm font-medium text-neutral-200 mb-2">Участники</h4>
        <ul className="flex flex-col gap-1 text-sm">
          <li className="flex items-center justify-between text-neutral-300 py-1">
            <span>{ownerEmail}</span>
            <span className="text-neutral-500">Владелец</span>
          </li>
          {initialMembers.map((m) => (
            <li key={m.user_id} className="flex items-center justify-between text-neutral-300 py-1 gap-2">
              <span className="truncate">{m.email ?? m.user_id}</span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-neutral-500">{ROLE_LABEL[m.role]}</span>
                <button
                  onClick={() => handleCopyLink(m)}
                  disabled={busyMemberId === m.user_id}
                  className="text-xs text-neutral-400 hover:text-neutral-200 disabled:opacity-50"
                  title="Скопировать ссылку на проект, чтобы отправить снова"
                >
                  🔗 Ссылка
                </button>
                <button
                  onClick={() => handleRemove(m)}
                  disabled={busyMemberId === m.user_id}
                  className="text-xs text-red-500 hover:text-red-400 disabled:opacity-50"
                  title="Убрать из проекта"
                >
                  Убрать
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <form onSubmit={handleInvite} className="rounded-lg border border-neutral-800 p-4 flex flex-col gap-2">
        <h4 className="text-sm font-medium text-neutral-200">Добавить участника</h4>
        <p className="text-xs text-neutral-500 -mt-1">
          Письмо не отправляется — после добавления скопируется ссылка на проект, отправьте её сами.
        </p>
        <input
          required
          type="email"
          placeholder="email@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded bg-neutral-800 border border-neutral-700 px-2 py-1.5 text-sm text-neutral-100"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as MemberRole)}
          className="rounded bg-neutral-800 border border-neutral-700 px-2 py-1.5 text-sm text-neutral-100"
        >
          <option value="client">Клиент (комментирует, может генерировать свои варианты)</option>
          <option value="co_writer">Соавтор (полный доступ к сценарию и раскадровке)</option>
          <option value="viewer">Наблюдатель (только просмотр)</option>
        </select>
        <button
          type="submit"
          disabled={busy}
          className="self-start rounded bg-white text-neutral-900 text-sm font-medium px-4 py-1.5 disabled:opacity-50"
        >
          {busy ? "Добавляем…" : "Добавить"}
        </button>
        {message && <p className="text-xs text-neutral-400">{message}</p>}
      </form>
    </div>
  );
}
