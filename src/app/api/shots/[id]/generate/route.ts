import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getImageProvider } from "@/lib/ai/providers";

export const maxDuration = 60;

export async function POST(request: Request, ctx: RouteContext<"/api/shots/[id]/generate">) {
  const { id: shotId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const providerId = body?.provider === "gemini" ? "gemini" : "openai";
  const aspectRatio = body?.aspectRatio ?? undefined;
  const overridePrompt = typeof body?.prompt === "string" ? body.prompt : undefined;

  const { data: shot, error: shotError } = await supabase
    .from("shots")
    .select("*")
    .eq("id", shotId)
    .single();
  if (shotError || !shot) return NextResponse.json({ error: "shot not found" }, { status: 404 });

  const projectId = shot.project_id;
  const prompt = overridePrompt ?? shot.prompt;
  if (!prompt?.trim()) {
    return NextResponse.json({ error: "shot has no prompt" }, { status: 400 });
  }

  // Pull in reference images for any character mentioned by name/token
  // in the prompt, so the same face/outfit recurs across shots.
  const { data: characters } = await supabase
    .from("characters")
    .select("name, prompt_token, reference_asset_urls")
    .eq("project_id", projectId);

  const lowerPrompt = prompt.toLowerCase();
  const referenceImageUrls = (characters ?? [])
    .filter((c) => {
      const needle = (c.prompt_token || c.name).toLowerCase();
      return needle && lowerPrompt.includes(needle);
    })
    .flatMap((c) => c.reference_asset_urls ?? [])
    .slice(0, 4);

  const { data: generation, error: genInsertError } = await supabase
    .from("generations")
    .insert({
      shot_id: shotId,
      project_id: projectId,
      kind: "image",
      provider: providerId,
      prompt_used: prompt,
      status: "running",
      created_by: user.id,
    })
    .select()
    .single();
  if (genInsertError || !generation) {
    return NextResponse.json({ error: genInsertError?.message ?? "failed to start generation" }, { status: 500 });
  }

  await supabase.from("shots").update({ status: "generating" }).eq("id", shotId);

  try {
    const provider = getImageProvider(providerId);
    const output = await provider.generate({ prompt, referenceImageUrls, aspectRatio });

    const ext = output.mimeType.includes("png") ? "png" : "jpg";
    const path = `shots/${projectId}/${shotId}-${generation.id}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("assets")
      .upload(path, output.bytes, { contentType: output.mimeType, upsert: true });
    if (uploadError) throw new Error(uploadError.message);

    const { data: publicUrl } = supabase.storage.from("assets").getPublicUrl(path);

    await supabase
      .from("generations")
      .update({ status: "completed", asset_url: publicUrl.publicUrl })
      .eq("id", generation.id);

    await supabase
      .from("shots")
      .update({ status: "needs_review", active_generation_id: generation.id })
      .eq("id", shotId);

    return NextResponse.json({
      generation: { ...generation, status: "completed", asset_url: publicUrl.publicUrl },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "generation failed";
    await supabase.from("generations").update({ status: "failed", error: message }).eq("id", generation.id);
    await supabase.from("shots").update({ status: "needs_regen" }).eq("id", shotId);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
