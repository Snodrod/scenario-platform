import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { projectId, targetType, targetId, body, parentId } = await request.json();
  if (!projectId || !targetType || !targetId || !body?.trim()) {
    return NextResponse.json({ error: "projectId, targetType, targetId and body are required" }, { status: 400 });
  }

  const { data: comment, error } = await supabase
    .from("comments")
    .insert({
      project_id: projectId,
      target_type: targetType,
      target_id: targetId,
      author_id: user.id,
      body,
      parent_id: parentId ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ comment });
}
