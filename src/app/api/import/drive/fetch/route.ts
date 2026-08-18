import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthorizedDriveClient, getValidAccessToken } from "@/lib/google/oauth";
import { extractTextFromFile } from "@/lib/text-extract";

export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { fileId } = await request.json().catch(() => ({}));
  if (!fileId) return NextResponse.json({ error: "fileId is required" }, { status: 400 });

  try {
    const accessToken = await getValidAccessToken(user.id);
    const drive = getAuthorizedDriveClient(accessToken);

    const { data: meta } = await drive.files.get({ fileId, fields: "id, name, mimeType" });

    let text: string;
    if (meta.mimeType === "application/vnd.google-apps.document") {
      const { data: exported } = await drive.files.export(
        { fileId, mimeType: "text/plain" },
        { responseType: "text" }
      );
      text = String(exported).trim();
    } else {
      const { data: raw } = await drive.files.get(
        { fileId, alt: "media" },
        { responseType: "arraybuffer" }
      );
      const bytes = Buffer.from(raw as ArrayBuffer);
      text = await extractTextFromFile(bytes, meta.name ?? "file", meta.mimeType ?? undefined);
    }

    if (!text) return NextResponse.json({ error: "could not extract any text from this file" }, { status: 422 });
    return NextResponse.json({ text, name: meta.name });
  } catch (err) {
    const message = err instanceof Error ? err.message : "failed to fetch file from Drive";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
