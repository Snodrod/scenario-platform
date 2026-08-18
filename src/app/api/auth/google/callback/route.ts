import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exchangeGoogleCode } from "@/lib/google/oauth";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const projectId = searchParams.get("state") || "";
  const returnPath = projectId ? `/project/${projectId}` : "/dashboard";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  if (!code) {
    return NextResponse.redirect(`${origin}${returnPath}?drive=error`);
  }

  try {
    const tokens = await exchangeGoogleCode(code);
    if (!tokens.refresh_token) {
      // Google only returns a refresh_token on the *first* consent, or
      // when prompt=consent forces re-consent (which connect/route.ts sets).
      throw new Error("Google did not return a refresh token");
    }

    let googleEmail: string | null = null;
    if (tokens.access_token) {
      const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (res.ok) googleEmail = (await res.json()).email ?? null;
    }

    const { error } = await supabase.from("google_accounts").upsert(
      {
        user_id: user.id,
        google_email: googleEmail,
        refresh_token: tokens.refresh_token,
        access_token: tokens.access_token ?? null,
        access_token_expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
      },
      { onConflict: "user_id" }
    );
    if (error) throw new Error(error.message);

    return NextResponse.redirect(`${origin}${returnPath}?drive=connected`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "connection failed";
    return NextResponse.redirect(`${origin}${returnPath}?drive=error&message=${encodeURIComponent(message)}`);
  }
}
