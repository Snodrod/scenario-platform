import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const name = (body?.name as string | undefined)?.trim();
  const format = body?.format === "short" ? "short" : "long";
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const { data: project, error } = await supabase
    .from("projects")
    .insert({ name, format, owner_id: user.id, description: body?.description ?? null })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Every project gets exactly one live script document (versioned by
  // `version`, content overwritten in place — see /api/scripts/[id]).
  const { error: scriptError } = await supabase
    .from("scripts")
    .insert({ project_id: project.id, content: "" });
  if (scriptError) return NextResponse.json({ error: scriptError.message }, { status: 500 });

  return NextResponse.json({ project });
}
