import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { breakdownScript } from "@/lib/ai/breakdown";
import { resolveProjectRole } from "@/lib/project-access";

// Re-runs the AI breakdown for a project's current script content.
// Destructive: replaces all existing scenes/shots for this script (and
// any comments attached to them). The UI warns the user before calling
// this a second time on a project that already has approved shots.
export async function POST(request: Request, ctx: RouteContext<"/api/projects/[id]/breakdown">) {
  const { id: projectId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [{ data: project }, { data: script }, { data: characters }] = await Promise.all([
    supabase.from("projects").select("*").eq("id", projectId).single(),
    supabase.from("scripts").select("*").eq("project_id", projectId).single(),
    supabase.from("characters").select("name").eq("project_id", projectId),
  ]);

  if (!project || !script) {
    return NextResponse.json({ error: "project or script not found" }, { status: 404 });
  }

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
  if (!script.content.trim()) {
    return NextResponse.json({ error: "script is empty" }, { status: 400 });
  }

  let breakdown;
  try {
    breakdown = await breakdownScript(
      script.content,
      project.format === "short" ? "short" : "long",
      (characters ?? []).map((c) => c.name)
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "breakdown failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // Clean up whatever existed before (scenes -> shots cascade in the DB;
  // comments don't have an FK to shots/scenes, so clear them explicitly).
  const { data: oldScenes } = await supabase.from("scenes").select("id").eq("script_id", script.id);
  const { data: oldShots } = await supabase
    .from("shots")
    .select("id")
    .in("scene_id", (oldScenes ?? []).map((s) => s.id));

  const staleTargetIds = [
    ...(oldScenes ?? []).map((s) => s.id),
    ...(oldShots ?? []).map((s) => s.id),
  ];
  if (staleTargetIds.length) {
    await supabase.from("comments").delete().in("target_id", staleTargetIds);
  }
  await supabase.from("scenes").delete().eq("script_id", script.id);

  for (const scene of breakdown.scenes) {
    const { data: insertedScene, error: sceneError } = await supabase
      .from("scenes")
      .insert({
        script_id: script.id,
        project_id: projectId,
        order_index: scene.orderIndex,
        title: scene.title,
        summary: scene.summary,
        source_text: scene.sourceText,
      })
      .select()
      .single();

    if (sceneError || !insertedScene) {
      return NextResponse.json({ error: sceneError?.message ?? "failed to insert scene" }, { status: 500 });
    }

    const shotsPayload = scene.shots.map((shot) => ({
      scene_id: insertedScene.id,
      project_id: projectId,
      order_index: shot.orderIndex,
      prompt: shot.prompt,
      status: "draft" as const,
      duration_seconds: shot.durationSeconds ?? null,
      line_text: shot.lineText ?? null,
      emotion_notes: shot.emotionNotes ?? null,
      editing_notes: shot.editingNotes ?? null,
      sound_notes: shot.soundNotes ?? null,
      voiceover_text: shot.voiceoverText ?? null,
      tags: shot.tags ?? [],
    }));

    const { error: shotsError } = await supabase.from("shots").insert(shotsPayload);
    if (shotsError) {
      return NextResponse.json({ error: shotsError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, sceneCount: breakdown.scenes.length });
}
