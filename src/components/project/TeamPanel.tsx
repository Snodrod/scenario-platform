"use client";

import { useState } from "react";
import type { MemberRole } from "@/lib/supabase/types";

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
  const [members, setMembers] = useState(initialMembers);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("client");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const res = await fetch(`/api/projects/${projectId}/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage(`Ошибка: ${json.error}`);
      return;
    }
    setMembers((prev) => [...prev, { user_id: crypto.randomUUID(), role, email }]);
    setMessage(`Приглашение отправлено на ${email}`);
    setEmail("");
  }

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <div>
        <h4 className="text-sm font-medium text-neutral-200 mb-2">Участники</h4>
        <ul className="flex flex-col gap-1 text-sm">
          <li className="flex justify-between text-neutral-300">
            <span>{ownerEmail}</span>
            <span className="text-neutral-500">Владелец</span>
          </li>
          {members.map((m) => (
            <li key={m.user_id} className="flex justify-between text-neutral-300">
              <span>{m.email ?? m.user_id}</span>
              <span className="text-neutral-500">{ROLE_LABEL[m.role]}</span>
            </li>
          ))}
        </ul>
      </div>

      <form onSubmit={handleInvite} className="rounded-lg border border-neutral-800 p-4 flex flex-col gap-2">
        <h4 className="text-sm font-medium text-neutral-200">Пригласить</h4>
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
          {busy ? "Отправляем…" : "Отправить приглашение"}
        </button>
        {message && <p className="text-xs text-neutral-400">{message}</p>}
      </form>
    </div>
  );
}
