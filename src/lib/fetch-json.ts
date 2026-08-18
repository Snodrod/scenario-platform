"use client";

// Every client component was calling `await res.json()` directly with no
// guard — an unhandled server exception (e.g. a missing env var throwing
// before any NextResponse.json() call) makes Next.js return an empty/HTML
// body instead of JSON, which crashes res.json() with a cryptic
// "unexpected end of data" SyntaxError instead of showing a real message.
// Route every fetch through this instead.
export interface FetchJsonResult<T = unknown> {
  ok: boolean;
  status: number;
  data: T | null;
  error: string | null;
}

export async function fetchJson<T = unknown>(input: RequestInfo | URL, init?: RequestInit): Promise<FetchJsonResult<T>> {
  let res: Response;
  try {
    res = await fetch(input, init);
  } catch (err) {
    return { ok: false, status: 0, data: null, error: err instanceof Error ? err.message : "Сеть недоступна" };
  }

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    return {
      ok: false,
      status: res.status,
      data: null,
      error: res.ok ? null : `Сервер вернул неожиданный ответ (${res.status})`,
    };
  }

  if (!res.ok) {
    const message = (data as { error?: string } | null)?.error ?? `Ошибка (${res.status})`;
    return { ok: false, status: res.status, data: data as T, error: message };
  }
  return { ok: true, status: res.status, data: data as T, error: null };
}
