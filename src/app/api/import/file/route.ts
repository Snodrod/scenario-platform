import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractTextFromFile } from "@/lib/text-extract";

const MAX_BYTES = 15 * 1024 * 1024; // 15MB

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "no file provided" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "file too large (max 15MB)" }, { status: 400 });
  }

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const text = await extractTextFromFile(bytes, file.name, file.type);
    if (!text) {
      return NextResponse.json({ error: "could not extract any text from this file" }, { status: 422 });
    }
    return NextResponse.json({ text });
  } catch (err) {
    const message = err instanceof Error ? err.message : "extraction failed";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
