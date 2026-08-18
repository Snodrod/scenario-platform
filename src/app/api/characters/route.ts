import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Reference images are uploaded client-side directly to Supabase Storage
// (bucket "assets", path characters/{projectId}/...) so this route only
// ever persists metadata + the resulting public URLs.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { projectId, name, description, promptToken, referenceAssetUrls } = await request.json();
  if (!projectId || !name?.trim()) {
    return NextResponse.json({ error: "projectId and name are required" }, { status: 400 });
  }

  const { data: character, error } = await supabase
    .from("characters")
    .insert({
      project_id: projectId,
      name,
      description: description ?? null,
      prompt_token: promptToken || name,
      reference_asset_urls: referenceAssetUrls ?? [],
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ character });
}
