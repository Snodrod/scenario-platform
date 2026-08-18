import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchNotionPageText } from "@/lib/text-extract";

// Large pages walk hundreds of blocks even with bounded concurrency —
// Vercel's default 10s function timeout isn't enough. Requires a plan
// that supports it (Hobby caps at 60s regardless of this value).
export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { url } = await request.json().catch(() => ({}));
  if (!url?.trim()) return NextResponse.json({ error: "url is required" }, { status: 400 });

  try {
    const text = await fetchNotionPageText(url);
    if (!text) return NextResponse.json({ error: "the page appears to be empty" }, { status: 422 });
    return NextResponse.json({ text });
  } catch (err) {
    const message = err instanceof Error ? err.message : "import failed";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
