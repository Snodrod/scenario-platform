import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Manually add a shot at the end of a scene.
export async function POST(request: Request, ctx: RouteContext<"/api/scenes/[id]/shots">) {
  const { id: sceneId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: scene } = await supabase.from("scenes").select("project_id").eq("id", sceneId).single();
  if (!scene) return NextResponse.json({ error: "scene not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const { count } = await supabase
    .from("shots")
    .select("id", { count: "exact", head: true })
    .eq("scene_id", sceneId);

  const { data: shot, error } = await supabase
    .from("shots")
    .insert({
      scene_id: sceneId,
      project_id: scene.project_id,
      order_index: count ?? 0,
      prompt: body.prompt || "",
      status: "draft",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ shot });
}
