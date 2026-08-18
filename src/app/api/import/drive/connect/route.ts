import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildGoogleAuthUrl, isGoogleDriveConfigured } from "@/lib/google/oauth";

// Redirects to Google's consent screen. `projectId` (if given) is passed
// through as `state` so the callback knows where to send the user back.
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  if (!isGoogleDriveConfigured()) {
    return NextResponse.json(
      { error: "Google Drive import is not configured on this server yet" },
      { status: 501 }
    );
  }

  const projectId = new URL(request.url).searchParams.get("projectId") ?? "";
  const authUrl = buildGoogleAuthUrl(projectId);
  return NextResponse.redirect(authUrl);
}
