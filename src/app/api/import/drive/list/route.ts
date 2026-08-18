import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthorizedDriveClient, getValidAccessToken } from "@/lib/google/oauth";

const IMPORTABLE_MIME_TYPES = [
  "application/vnd.google-apps.document",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const accessToken = await getValidAccessToken(user.id);
    const drive = getAuthorizedDriveClient(accessToken);

    const q = IMPORTABLE_MIME_TYPES.map((m) => `mimeType='${m}'`).join(" or ");
    const { data } = await drive.files.list({
      q: `(${q}) and trashed=false`,
      orderBy: "modifiedTime desc",
      pageSize: 25,
      fields: "files(id, name, mimeType, modifiedTime, iconLink)",
    });

    return NextResponse.json({ files: data.files ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "failed to list Drive files";
    const notConnected = message.includes("not connected");
    return NextResponse.json({ error: message }, { status: notConnected ? 409 : 502 });
  }
}
