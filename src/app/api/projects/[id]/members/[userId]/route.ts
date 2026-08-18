import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveProjectRole } from "@/lib/project-access";

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/projects/[id]/members/[userId]">
) {
  const { id: projectId, userId: targetUserId } = await ctx.params;
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

  if (targetUserId === project.owner_id) {
    return NextResponse.json({ error: "нельзя удалить владельца проекта" }, { status: 400 });
  }

  const { error } = await supabase
    .from("project_members")
    .delete()
    .eq("project_id", projectId)
    .eq("user_id", targetUserId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
