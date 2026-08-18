import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

type ShotUpdate = Database["public"]["Tables"]["shots"]["Update"];

export async function PATCH(request: Request, ctx: RouteContext<"/api/shots/[id]">) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const patch: ShotUpdate = {};
  if (typeof body.prompt === "string") patch.prompt = body.prompt;
  if (typeof body.status === "string") patch.status = body.status as Database["public"]["Enums"]["shot_status"];
  if (typeof body.line_text === "string") patch.line_text = body.line_text;
  if (typeof body.emotion_notes === "string") patch.emotion_notes = body.emotion_notes;
  if (typeof body.editing_notes === "string") patch.editing_notes = body.editing_notes;
  if (typeof body.sound_notes === "string") patch.sound_notes = body.sound_notes;
  if (typeof body.voiceover_text === "string") patch.voiceover_text = body.voiceover_text;
  if (typeof body.duration_seconds === "number") patch.duration_seconds = body.duration_seconds;
  if (Array.isArray(body.tags)) patch.tags = body.tags;
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  const { data, error } = await supabase.from("shots").update(patch).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ shot: data });
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/shots/[id]">) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { error } = await supabase.from("shots").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
