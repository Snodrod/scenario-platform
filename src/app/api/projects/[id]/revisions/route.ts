import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveProjectRole } from "@/lib/project-access";
import { matchRevisionsToShots } from "@/lib/ai/revisions";

// Takes a raw block of client feedback (pasted from an email/chat) and
// uses an LLM to split it into per-shot comments — same effect as a
// client reading the storyboard and leaving comments themselves, just
// bulk-applied from wherever the feedback actually arrived.
export async function POST(request: Request, ctx: RouteContext<"/api/projects/[id]/revisions">) {
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

  const { text } = await request.json().catch(() => ({}));
  if (!text?.trim()) return NextResponse.json({ error: "text is required" }, { status: 400 });

  const { data: rawShots } = await supabase
    .from("shots")
    .select("id, order_index, prompt, line_text, scenes(title)")
    .eq("project_id", projectId)
    .order("order_index");

  const shots = (rawShots ?? []).map((s) => ({
    id: s.id,
    orderIndex: s.order_index,
    prompt: s.prompt,
    lineText: s.line_text,
    sceneTitle: (s.scenes as { title: string | null } | null)?.title ?? "",
  }));

  let matches;
  try {
    matches = await matchRevisionsToShots(shots, text);
  } catch (err) {
    const message = err instanceof Error ? err.message : "revision matching failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  if (matches.length === 0) {
    return NextResponse.json({ count: 0, shotIds: [] });
  }

  const { error } = await supabase.from("comments").insert(
    matches.map((m) => ({
      project_id: projectId,
      target_type: "shot" as const,
      target_id: m.shotId,
      author_id: user.id,
      body: `📋 Правка (авто-импорт): ${m.comment}`,
    }))
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ count: matches.length, shotIds: matches.map((m) => m.shotId) });
}
