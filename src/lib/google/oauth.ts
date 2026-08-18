import { google } from "googleapis";
import { createAdminClient } from "@/lib/supabase/admin";

// Google Drive import (Phase C) needs a Google Cloud OAuth client —
// see README.md "Google Drive import setup". Everything here no-ops
// with a clear error until GOOGLE_OAUTH_CLIENT_ID/SECRET are set.
export function isGoogleDriveConfigured() {
  return Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET);
}

function getOAuthClient() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Google Drive import is not configured (GOOGLE_OAUTH_CLIENT_ID/SECRET missing)");
  }
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return new google.auth.OAuth2(clientId, clientSecret, `${siteUrl}/api/auth/google/callback`);
}

export function buildGoogleAuthUrl(state: string) {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // forces a refresh_token even if the user connected before
    scope: ["https://www.googleapis.com/auth/drive.readonly", "openid", "email"],
    state,
  });
}

export async function exchangeGoogleCode(code: string) {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);
  return tokens;
}

// Returns a valid access token for this user, transparently refreshing
// (and persisting the refresh) via the stored refresh_token if needed.
export async function getValidAccessToken(userId: string): Promise<string> {
  const admin = createAdminClient();
  const { data: account } = await admin
    .from("google_accounts")
    .select("*")
    .eq("user_id", userId)
    .single();
  if (!account) throw new Error("Google Drive is not connected for this user");

  const client = getOAuthClient();
  client.setCredentials({
    refresh_token: account.refresh_token,
    access_token: account.access_token ?? undefined,
    expiry_date: account.access_token_expires_at
      ? new Date(account.access_token_expires_at).getTime()
      : undefined,
  });

  const { token } = await client.getAccessToken();
  if (!token) throw new Error("Failed to obtain a Google access token");

  if (token !== account.access_token) {
    const expiry = client.credentials.expiry_date;
    await admin
      .from("google_accounts")
      .update({
        access_token: token,
        access_token_expires_at: expiry ? new Date(expiry).toISOString() : null,
      })
      .eq("user_id", userId);
  }

  return token;
}

export function getAuthorizedDriveClient(accessToken: string) {
  const client = getOAuthClient();
  client.setCredentials({ access_token: accessToken });
  return google.drive({ version: "v3", auth: client });
}
