import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { createClient } from "@/lib/supabase/server";
import { StoryboardDocument, type PdfScene } from "@/lib/pdf/StoryboardDocument";
import { mapWithConcurrency } from "@/lib/text-extract";

export const maxDuration = 60;

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

  // @react-pdf/renderer fetches each <Image src={url}> itself at render
  // time, one request at a time internally — with dozens of shots that
  // serialized fetch chain is what took 117s (and counting) on a real
  // 87-shot storyboard. Prefetching concurrently into data URIs first
  // means renderToBuffer does zero network I/O of its own.
  const allShots = pdfScenes.flatMap((s) => s.shots);
  const dataUriByUrl = new Map<string, string>();
  await mapWithConcurrency(
    allShots.filter((s) => s.imageUrl),
    6,
    async (shot) => {
      try {
        const res = await fetch(shot.imageUrl!);
        if (!res.ok) return;
        const bytes = Buffer.from(await res.arrayBuffer());
        const mimeType = res.headers.get("content-type") || "image/png";
        dataUriByUrl.set(shot.imageUrl!, `data:${mimeType};base64,${bytes.toString("base64")}`);
      } catch {
        // Missing image just renders as a placeholder in the PDF.
      }
    }
  );
  for (const shot of allShots) {
    if (shot.imageUrl) shot.imageUrl = dataUriByUrl.get(shot.imageUrl) ?? null;
  }

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

  // Content-Disposition filenames are restricted to Latin-1 bytes — a
  // Cyrillic (or any non-ASCII) project name broke this outright before.
  // ASCII fallback (filename=) for old clients + RFC 5987 UTF-8 form
  // (filename*=) for everything else.
  const asciiName = project.name.replace(/[^\x20-\x7E]/g, "_") || "storyboard";
  const encodedName = encodeURIComponent(`${project.name}-storyboard.pdf`);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${asciiName}-storyboard.pdf"; filename*=UTF-8''${encodedName}`,
    },
  });
}
