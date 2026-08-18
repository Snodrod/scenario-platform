"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setStatus("error");
      setError(error.message);
      return;
    }
    setStatus("sent");
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold text-center mb-1">Scenario Platform</h1>
        <p className="text-center text-sm text-neutral-500 mb-8">
          Сценарий → раскадровка → совместная работа с клиентом
        </p>

        {status === "sent" ? (
          <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4 text-sm text-center text-neutral-200">
            Ссылка для входа отправлена на <strong>{email}</strong>. Проверьте почту.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-neutral-700 bg-neutral-900 text-neutral-100 px-3 py-2 text-sm outline-none focus:border-neutral-400"
            />
            <button
              type="submit"
              disabled={status === "sending"}
              className="rounded-lg bg-white text-neutral-900 text-sm font-medium py-2 disabled:opacity-50"
            >
              {status === "sending" ? "Отправляем…" : "Получить ссылку для входа"}
            </button>
            {status === "error" && (
              <p className="text-sm text-red-500">{error}</p>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
