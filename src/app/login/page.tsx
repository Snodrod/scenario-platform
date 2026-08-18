"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);

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

  async function handleGoogle() {
    setGoogleBusy(true);
    setError(null);
    const supabase = createClient();
    // No callback handling needed here — signInWithOAuth redirects the
    // browser to Google immediately, then back to /auth/callback, which
    // already knows how to exchange an OAuth `code` the same way it does
    // for magic-link codes.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setGoogleBusy(false);
      setStatus("error");
      setError(error.message);
    }
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
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={handleGoogle}
              disabled={googleBusy}
              className="flex items-center justify-center gap-2 rounded-lg border border-neutral-700 bg-neutral-900 text-neutral-100 text-sm font-medium py-2 hover:bg-neutral-800 disabled:opacity-50"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M23.52 12.27c0-.82-.07-1.6-.2-2.36H12v4.47h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.87c2.27-2.09 3.58-5.17 3.58-8.74Z" />
                <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.9l-3.87-3a7.4 7.4 0 0 1-11-3.89H1.08v3.09A12 12 0 0 0 12 24Z" />
                <path fill="#FBBC05" d="M5.07 14.21A7.2 7.2 0 0 1 4.68 12c0-.77.13-1.51.38-2.21V6.7H1.08A12 12 0 0 0 0 12c0 1.94.47 3.77 1.08 5.3l3.99-3.09Z" />
                <path fill="#EA4335" d="M12 4.75c1.76 0 3.34.6 4.58 1.79l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.08 6.7l3.99 3.09A7.18 7.18 0 0 1 12 4.75Z" />
              </svg>
              {googleBusy ? "Открываем Google…" : "Войти через Google"}
            </button>

            <div className="flex items-center gap-2 text-xs text-neutral-600">
              <div className="h-px flex-1 bg-neutral-800" />
              или по email
              <div className="h-px flex-1 bg-neutral-800" />
            </div>

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
          </div>
        )}
      </div>
    </main>
  );
}
