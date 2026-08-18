import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveProjectRole } from "@/lib/project-access";
import { extractNotionPageId, mapWithConcurrency } from "@/lib/text-extract";
import { parseNotionStoryboard, mapImportedShotStatus } from "@/lib/notion-storyboard";

export const maxDuration = 60;

// Detects a storyboard already built into a Notion page (images, per-shot
// fields) and imports it directly — scenes, shots, and re-hosted images —
// instead of just grabbing plain text and requiring a separate LLM
// breakdown pass. Returns { structured: false } when the page doesn't
// match the pattern, so the caller can fall back to the plain-text import.
export async function POST(request: Request, ctx: RouteContext<"/api/projects/[id]/import/notion-storyboard">) {
  const { id: projectId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: project } = await supabase.from("projects").select("owner_id").eq("id", projectId).maybeSingle();
  if (!project) return NextResponse.json({ error: "project not found" }, { status: 404 });

  const { data: membership } = await supabase
    .from("project_members")
    .select("role")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();
  const role = resolveProjectRole({ ownerId: project.owner_id, userId: user.id, membershipRole: membership?.role });
  if (role !== "owner" && role !== "co_writer") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { url } = await request.json().catch(() => ({}));
  if (!url?.trim()) return NextResponse.json({ error: "url is required" }, { status: 400 });

  const pageId = extractNotionPageId(url);
  if (!pageId) return NextResponse.json({ error: "Could not find a Notion page ID in that link" }, { status: 400 });

  let parsed;
  try {
    parsed = await parseNotionStoryboard(pageId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Notion import failed";
    return NextResponse.json({ error: message }, { status: 422 });
  }

  if (!parsed) {
    return NextResponse.json({ structured: false });
  }

  const { data: script } = await supabase.from("scripts").select("id").eq("project_id", projectId).single();
  if (!script) return NextResponse.json({ error: "script not found" }, { status: 404 });

  // Same cleanup as /breakdown — replacing the storyboard, so clear what
  // was there before (comments aren't FK'd to shots/scenes, drop by hand).
  const { data: oldScenes } = await supabase.from("scenes").select("id").eq("script_id", script.id);
  const { data: oldShots } = await supabase
    .from("shots")
    .select("id")
    .in("scene_id", (oldScenes ?? []).map((s) => s.id));
  const staleIds = [...(oldScenes ?? []).map((s) => s.id), ...(oldShots ?? []).map((s) => s.id)];
  if (staleIds.length) await supabase.from("comments").delete().in("target_id", staleIds);
  await supabase.from("scenes").delete().eq("script_id", script.id);

  // A lightweight readable summary — avoids a second full-page fetch just
  // to fill the Script tab; the real content now lives in the shots.
  const scriptSummary = parsed.scenes
    .map(
      (scene) =>
        `## ${scene.title}\n` +
        scene.shots.map((s) => (s.lineText ? `- ${s.lineText}` : null)).filter(Boolean).join("\n")
    )
    .join("\n\n");
  await supabase
    .from("scripts")
    .update({ content: scriptSummary, updated_at: new Date().toISOString() })
    .eq("id", script.id);

  const imageJobs: { shotId: string; imageUrl: string }[] = [];
  let sceneCount = 0;
  let shotCount = 0;

  for (const scene of parsed.scenes) {
    const { data: insertedScene, error: sceneError } = await supabase
      .from("scenes")
      .insert({
        script_id: script.id,
        project_id: projectId,
        order_index: scene.orderIndex,
        title: scene.title,
        summary: null,
        source_text: null,
      })
      .select()
      .single();
    if (sceneError || !insertedScene) {
      return NextResponse.json({ error: sceneError?.message ?? "failed to insert scene" }, { status: 500 });
    }
    sceneCount++;

    for (const shot of scene.shots) {
      const { data: insertedShot, error: shotError } = await supabase
        .from("shots")
        .insert({
          scene_id: insertedScene.id,
          project_id: projectId,
          order_index: shot.orderIndex,
          prompt: shot.lineText ?? "",
          status: mapImportedShotStatus(shot.statusText),
          duration_seconds: shot.durationSeconds,
          line_text: shot.lineText,
          emotion_notes: shot.emotionNotes,
          editing_notes: shot.editingNotes,
          sound_notes: shot.soundNotes,
          voiceover_text: shot.voiceoverText,
          tags: shot.tags,
        })
        .select()
        .single();
      if (shotError || !insertedShot) {
        return NextResponse.json({ error: shotError?.message ?? "failed to insert shot" }, { status: 500 });
      }
      shotCount++;
      if (shot.imageUrl) imageJobs.push({ shotId: insertedShot.id, imageUrl: shot.imageUrl });
    }
  }

  // Re-host images (Notion's CDN URLs expire) concurrently, bounded.
  let imagesImported = 0;
  await mapWithConcurrency(imageJobs, 6, async ({ shotId, imageUrl }) => {
    try {
      const res = await fetch(imageUrl);
      if (!res.ok) return;
      const bytes = Buffer.from(await res.arrayBuffer());
      const mimeType = res.headers.get("content-type") || "image/png";
      const ext = mimeType.includes("png") ? "png" : mimeType.includes("webp") ? "webp" : "jpg";
      const path = `shots/${projectId}/${shotId}-notion-import.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("assets")
        .upload(path, bytes, { contentType: mimeType, upsert: true });
      if (uploadError) return;

      const { data: publicUrl } = supabase.storage.from("assets").getPublicUrl(path);

      const { data: generation, error: genError } = await supabase
        .from("generations")
        .insert({
          shot_id: shotId,
          project_id: projectId,
          kind: "image",
          provider: "notion-import",
          asset_url: publicUrl.publicUrl,
          status: "completed",
          created_by: user.id,
        })
        .select()
        .single();
      if (genError || !generation) return;

      await supabase.from("shots").update({ active_generation_id: generation.id }).eq("id", shotId);
      imagesImported++;
    } catch {
      // Best-effort — a shot missing its image just shows the "no image" state.
    }
  });

  return NextResponse.json({ structured: true, sceneCount, shotCount, imagesImported });
}
