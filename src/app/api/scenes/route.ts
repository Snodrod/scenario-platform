import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Manually add a scene at the end of the script (for touch-ups after the
// AI breakdown, or for building a storyboard scene-by-scene by hand).
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { projectId, scriptId, title } = await request.json();
  if (!projectId || !scriptId) {
    return NextResponse.json({ error: "projectId and scriptId are required" }, { status: 400 });
  }

  const { count } = await supabase
    .from("scenes")
    .select("id", { count: "exact", head: true })
    .eq("script_id", scriptId);

  const { data: scene, error } = await supabase
    .from("scenes")
    .insert({
      project_id: projectId,
      script_id: scriptId,
      order_index: count ?? 0,
      title: title || "Новая сцена",
      summary: "",
      source_text: "",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ scene });
}
