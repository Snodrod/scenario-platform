import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { createClient } from "@/lib/supabase/server";
import { StoryboardDocument, type PdfScene } from "@/lib/pdf/StoryboardDocument";

export async function GET(_request: Request, ctx: RouteContext<"/api/projects/[id]/export/pdf">) {
  const { id: projectId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: project } = await supabase.from("projects").select("*").eq("id", projectId).single();
  if (!project) return NextResponse.json({ error: "project not found" }, { status: 404 });

  const { data: script } = await supabase.from("scripts").select("id").eq("project_id", projectId).single();
  const { data: scenes } = await supabase
    .from("scenes")
    .select("*, shots(*, generations!shots_active_generation_fk(asset_url))")
    .eq("script_id", script?.id ?? "")
    .order("order_index");

  const pdfScenes: PdfScene[] = (scenes ?? []).map((scene) => ({
    orderIndex: scene.order_index,
    title: scene.title,
    summary: scene.summary,
    shots: (scene.shots ?? [])
      .sort((a: { order_index: number }, b: { order_index: number }) => a.order_index - b.order_index)
      .map((shot: Record<string, unknown>) => ({
        orderIndex: shot.order_index as number,
        imageUrl: (shot.generations as { asset_url: string | null } | null)?.asset_url ?? null,
        lineText: shot.line_text as string | null,
        emotionNotes: shot.emotion_notes as string | null,
        editingNotes: shot.editing_notes as string | null,
        soundNotes: shot.sound_notes as string | null,
        durationSeconds: shot.duration_seconds as number | null,
      })),
  }));

  // @react-pdf/renderer types its input as a <Document> element specifically;
  // StoryboardDocument returns one at runtime, so the cast is safe.
  const buffer = await renderToBuffer(
    createElement(StoryboardDocument, { projectName: project.name, scenes: pdfScenes }) as Parameters<
      typeof renderToBuffer
    >[0]
  );

  const path = `exports/${projectId}/storyboard-${Date.now()}.pdf`;
  await supabase.storage.from("assets").upload(path, buffer, { contentType: "application/pdf", upsert: true });
  const { data: publicUrl } = supabase.storage.from("assets").getPublicUrl(path);
  await supabase.from("exports").insert({ project_id: projectId, type: "pdf", url: publicUrl.publicUrl, created_by: user.id });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${project.name}-storyboard.pdf"`,
    },
  });
}
