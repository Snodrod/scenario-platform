// Detects and parses a storyboard that's already built into a Notion
// page — the pattern found on the user's real page:
//   heading_1 "Раскадровка"
//     heading_2 "БЛОК N · ..."          <- scene
//       heading_3 "КАДР NN · 0:00–0:05 · 5 сек · тег1 · тег2 · статус"  <- shot
//       image (external url)
//       column_list
//         column: "Озвучка" (bold) -> quote (line), "Эмоция и подача" (bold) -> paragraph
//         column: "ТЗ к монтажу" (bold) -> paragraph, "Звук" (bold) -> paragraph
//       toggle "... версия для диктора и ElevenLabs" -> code block (VO text)
// Falls back to null (caller uses plain-text import instead) when this
// exact shape isn't found — this is a bonus fast-path, not a general
// document parser.
import { fetchAllChildren, getBlockPlainText, mapWithConcurrency, type NotionBlock } from "./text-extract";

export interface ParsedShot {
  orderIndex: number;
  imageUrl: string | null;
  durationSeconds: number | null;
  tags: string[];
  statusText: string | null;
  lineText: string | null;
  emotionNotes: string | null;
  editingNotes: string | null;
  soundNotes: string | null;
  voiceoverText: string | null;
}

export interface ParsedScene {
  orderIndex: number;
  title: string;
  shots: ParsedShot[];
}

export interface ParsedStoryboard {
  scenes: ParsedScene[];
}

const SHOT_HEADING_PATTERN = /^КАДР\s*\d+/i;

function parseShotHeading(heading: string) {
  const parts = heading
    .split("·")
    .map((s) => s.trim())
    .filter(Boolean);

  let durationSeconds: number | null = null;
  let tags: string[] = [];
  let statusText: string | null = null;

  if (parts.length >= 3) {
    const durMatch = parts[2].match(/(\d+)/);
    durationSeconds = durMatch ? Number(durMatch[1]) : null;
  }
  if (parts.length > 3) {
    tags = parts.slice(3, -1);
    statusText = parts[parts.length - 1];
  }
  return { durationSeconds, tags, statusText };
}

const FIELD_LABELS: Record<string, "lineText" | "emotionNotes" | "editingNotes" | "soundNotes"> = {
  озвучка: "lineText",
  "эмоция и подача": "emotionNotes",
  "тз к монтажу": "editingNotes",
  звук: "soundNotes",
};

async function parseColumnListFields(columnListId: string) {
  const columns = await fetchAllChildren(columnListId);
  const blocks: NotionBlock[] = [];
  for (const col of columns) {
    blocks.push(...(await fetchAllChildren(col.id)));
  }

  const result: Partial<Record<"lineText" | "emotionNotes" | "editingNotes" | "soundNotes", string>> = {};
  for (let i = 0; i < blocks.length; i++) {
    const label = getBlockPlainText(blocks[i]).trim().toLowerCase();
    const field = FIELD_LABELS[label];
    if (field && i + 1 < blocks.length) {
      const value = getBlockPlainText(blocks[i + 1]).trim();
      if (value) result[field] = value;
    }
  }
  return result;
}

async function parseVoiceoverToggle(toggleId: string): Promise<string | null> {
  const children = await fetchAllChildren(toggleId);
  const codeBlock = children.find((b) => b.type === "code");
  if (codeBlock) {
    const text = getBlockPlainText(codeBlock).trim();
    if (text) return text;
  }
  const anyText = children.find((b) => getBlockPlainText(b).trim());
  return anyText ? getBlockPlainText(anyText).trim() : null;
}

function extractImageUrl(block: NotionBlock): string | null {
  const img = block.image as { type?: string; external?: { url: string }; file?: { url: string } } | undefined;
  if (!img) return null;
  return img.type === "external" ? (img.external?.url ?? null) : (img.file?.url ?? null);
}

export async function parseNotionStoryboard(pageId: string): Promise<ParsedStoryboard | null> {
  const topBlocks = await fetchAllChildren(pageId);

  const startIdx = topBlocks.findIndex((b) => b.type === "heading_1" && /раскадровк/i.test(getBlockPlainText(b)));
  if (startIdx === -1) return null;

  let endIdx = topBlocks.length;
  for (let i = startIdx + 1; i < topBlocks.length; i++) {
    if (topBlocks[i].type === "heading_1") {
      endIdx = i;
      break;
    }
  }
  const sectionBlocks = topBlocks.slice(startIdx + 1, endIdx);

  interface ShotSkeleton {
    sceneIndex: number;
    orderIndex: number;
    heading: string;
    imageUrl: string | null;
    columnListId: string | null;
    toggleId: string | null;
  }

  const scenesMeta: { orderIndex: number; title: string }[] = [];
  const shotSkeletons: ShotSkeleton[] = [];
  let currentSceneIndex = -1;
  let shotOrderInScene = 0;

  for (let i = 0; i < sectionBlocks.length; i++) {
    const block = sectionBlocks[i];

    if (block.type === "heading_2") {
      scenesMeta.push({ orderIndex: scenesMeta.length, title: getBlockPlainText(block) || `Сцена ${scenesMeta.length + 1}` });
      currentSceneIndex = scenesMeta.length - 1;
      shotOrderInScene = 0;
      continue;
    }

    if (block.type === "heading_3" && SHOT_HEADING_PATTERN.test(getBlockPlainText(block))) {
      if (currentSceneIndex === -1) {
        scenesMeta.push({ orderIndex: 0, title: "Раскадровка" });
        currentSceneIndex = 0;
      }

      let imageUrl: string | null = null;
      let columnListId: string | null = null;
      let toggleId: string | null = null;
      let j = i + 1;
      for (; j < sectionBlocks.length; j++) {
        const b = sectionBlocks[j];
        if (b.type === "heading_1" || b.type === "heading_2" || b.type === "heading_3") break;
        if (b.type === "image" && !imageUrl) imageUrl = extractImageUrl(b);
        else if (b.type === "column_list" && !columnListId) columnListId = b.id;
        else if (b.type === "toggle" && !toggleId && /elevenlabs|диктор/i.test(getBlockPlainText(b))) toggleId = b.id;
      }

      shotSkeletons.push({
        sceneIndex: currentSceneIndex,
        orderIndex: shotOrderInScene++,
        heading: getBlockPlainText(block),
        imageUrl,
        columnListId,
        toggleId,
      });
      i = j - 1;
    }
  }

  if (shotSkeletons.length === 0) return null;

  const enriched = await mapWithConcurrency(shotSkeletons, 6, async (skel) => {
    const emptyFields: Partial<Record<"lineText" | "emotionNotes" | "editingNotes" | "soundNotes", string>> = {};
    const [fields, voiceoverText] = await Promise.all([
      skel.columnListId ? parseColumnListFields(skel.columnListId) : Promise.resolve(emptyFields),
      skel.toggleId ? parseVoiceoverToggle(skel.toggleId) : Promise.resolve(null),
    ]);
    const { durationSeconds, tags, statusText } = parseShotHeading(skel.heading);

    return {
      sceneIndex: skel.sceneIndex,
      shot: {
        orderIndex: skel.orderIndex,
        imageUrl: skel.imageUrl,
        durationSeconds,
        tags,
        statusText,
        lineText: fields.lineText ?? null,
        emotionNotes: fields.emotionNotes ?? null,
        editingNotes: fields.editingNotes ?? null,
        soundNotes: fields.soundNotes ?? null,
        voiceoverText,
      } as ParsedShot,
    };
  });

  const scenes: ParsedScene[] = scenesMeta.map((s) => ({ ...s, shots: [] }));
  for (const { sceneIndex, shot } of enriched) {
    scenes[sceneIndex].shots.push(shot);
  }

  const nonEmpty = scenes.filter((s) => s.shots.length > 0);
  nonEmpty.forEach((s, idx) => {
    s.orderIndex = idx;
  });

  return { scenes: nonEmpty };
}

export function mapImportedShotStatus(statusText: string | null): "approved" | "needs_review" {
  return statusText && /утвержд/i.test(statusText) ? "approved" : "needs_review";
}
