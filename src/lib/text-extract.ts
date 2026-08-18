// Server-only text extraction for script import (file upload, Google Doc
// link, Google Drive). Keeps pdf-parse/mammoth usage in one place so the
// three import routes stay thin.

export async function extractPdfText(bytes: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(bytes) });
  try {
    const result = await parser.getText();
    return result.text.trim();
  } finally {
    await parser.destroy();
  }
}

export async function extractDocxText(bytes: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer: bytes });
  return result.value.trim();
}

export async function extractTextFromFile(bytes: Buffer, filename: string, mimeType?: string): Promise<string> {
  const lower = filename.toLowerCase();
  const isPdf = mimeType === "application/pdf" || lower.endsWith(".pdf");
  const isDocx =
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lower.endsWith(".docx");

  if (isPdf) return extractPdfText(bytes);
  if (isDocx) return extractDocxText(bytes);
  if (mimeType?.startsWith("text/") || lower.endsWith(".txt")) return bytes.toString("utf-8").trim();

  throw new Error("Unsupported file type — upload a PDF, DOCX, or plain text file");
}

const GOOGLE_DOC_ID_PATTERN = /\/document\/d\/([a-zA-Z0-9_-]+)/;

export function extractGoogleDocId(urlOrId: string): string | null {
  const trimmed = urlOrId.trim();
  const match = trimmed.match(GOOGLE_DOC_ID_PATTERN);
  if (match) return match[1];
  // Bare ID (no slashes/spaces) — accept as-is.
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return trimmed;
  return null;
}

// Requires the doc to be shared as "Anyone with the link can view" — no
// OAuth needed, just Google's public export endpoint.
export async function fetchPublicGoogleDocText(urlOrId: string): Promise<string> {
  const docId = extractGoogleDocId(urlOrId);
  if (!docId) throw new Error("Could not find a Google Doc ID in that link");

  const res = await fetch(`https://docs.google.com/document/d/${docId}/export?format=txt`);
  if (res.status === 404 || res.status === 403) {
    throw new Error("Документ недоступен — включите доступ «Все, у кого есть ссылка» в настройках Google Doc");
  }
  if (!res.ok) throw new Error(`Google Docs export failed: ${res.status}`);

  return (await res.text()).trim();
}

// --- Notion ---------------------------------------------------------
// notion.site pages render their content client-side, so a plain fetch
// of the URL returns an empty shell — we go through Notion's official
// API instead (requires NOTION_API_KEY, see README "Notion import setup").

export function isNotionConfigured() {
  return Boolean(process.env.NOTION_API_KEY);
}

export function extractNotionPageId(urlOrId: string): string | null {
  const trimmed = urlOrId.trim();
  // Bare 32-char hex id, with or without dashes.
  const bare = trimmed.replace(/-/g, "");
  if (/^[0-9a-fA-F]{32}$/.test(bare)) return toDashedUuid(bare);

  // URLs end in ...-<32 hex chars> (dashes already stripped by Notion).
  const match = trimmed.match(/([0-9a-fA-F]{32})(?:\?|$)/) ?? trimmed.match(/-([0-9a-fA-F]{32})/);
  if (match) return toDashedUuid(match[1]);
  return null;
}

function toDashedUuid(hex32: string): string {
  return `${hex32.slice(0, 8)}-${hex32.slice(8, 12)}-${hex32.slice(12, 16)}-${hex32.slice(16, 20)}-${hex32.slice(20)}`;
}

export interface NotionRichText {
  plain_text: string;
  annotations?: { bold?: boolean };
}

export interface NotionBlock {
  id: string;
  type: string;
  has_children: boolean;
  [key: string]: unknown;
}

interface NotionBlockChildrenResponse {
  results?: NotionBlock[];
  has_more?: boolean;
  next_cursor?: string;
}

export async function notionApi(path: string, attempt = 0): Promise<NotionBlockChildrenResponse> {
  const apiKey = process.env.NOTION_API_KEY;
  if (!apiKey) throw new Error("NOTION_API_KEY is not set — add it to .env.local");

  const res = await fetch(`https://api.notion.com${path}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Notion-Version": "2022-06-28",
    },
  });
  if (res.status === 404) {
    throw new Error(
      "Страница не найдена или не расшарена с интеграцией — откройте её в Notion → «...» → Connections → добавьте вашу интеграцию"
    );
  }
  if (res.status === 429 && attempt < 4) {
    const retryAfter = Number(res.headers.get("retry-after")) || 1;
    await new Promise((r) => setTimeout(r, retryAfter * 1000));
    return notionApi(path, attempt + 1);
  }
  if (!res.ok) throw new Error(`Notion API error: ${res.status}`);
  return res.json();
}

// Runs `fn` over `items` with at most `limit` in flight at once — fast
// (unlike full sequential recursion, which took minutes on a real page),
// but still under Notion's ~3 req/s rate limit.
export async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function blockToText(block: NotionBlock): string {
  const type = block.type;
  const data = block[type] as { rich_text?: NotionRichText[]; language?: string } | undefined;
  const text = (data?.rich_text ?? []).map((t) => t.plain_text).join("");
  if (!text) return "";

  switch (type) {
    case "heading_1":
      return `# ${text}`;
    case "heading_2":
      return `## ${text}`;
    case "heading_3":
      return `### ${text}`;
    case "bulleted_list_item":
    case "to_do":
      return `- ${text}`;
    case "numbered_list_item":
      return `1. ${text}`;
    case "quote":
      return `> ${text}`;
    case "code":
      return `\`\`\`\n${text}\n\`\`\``;
    default:
      return text;
  }
}

async function fetchBlockChildrenRecursive(blockId: string, depth = 0): Promise<string[]> {
  if (depth > 6) return []; // guard against pathological nesting

  // Pagination for one parent is inherently sequential (cursor-based),
  // but that's rarely more than a couple of pages even for a long doc.
  const blocks: NotionBlock[] = [];
  let cursor: string | undefined;
  do {
    const query = cursor ? `?start_cursor=${cursor}&page_size=100` : "?page_size=100";
    const data = await notionApi(`/v1/blocks/${blockId}/children${query}`);
    blocks.push(...(data.results ?? []));
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);

  // Recurse into every child WITH children concurrently (bounded) instead
  // of one at a time — a real page with many toggles/sub-lists went from
  // minutes to seconds after this change.
  const childResults = await mapWithConcurrency(blocks, 6, (block) =>
    block.has_children ? fetchBlockChildrenRecursive(block.id, depth + 1) : Promise.resolve([] as string[])
  );

  const lines: string[] = [];
  blocks.forEach((block, i) => {
    const line = blockToText(block);
    if (line) lines.push(line);
    lines.push(...childResults[i].map((l) => `  ${l}`));
  });
  return lines;
}

// Plain concatenated text of a block's own rich_text (no markdown prefix,
// unlike blockToText) — used by the structured-storyboard parser.
export function getBlockPlainText(block: NotionBlock): string {
  const data = block[block.type] as { rich_text?: NotionRichText[] } | undefined;
  return (data?.rich_text ?? []).map((t) => t.plain_text).join("");
}

// Fetches one block's direct children in document order (paginated, not
// recursive) — the structured-storyboard parser needs the flat top-level
// sequence to detect heading boundaries, not a fully flattened text dump.
export async function fetchAllChildren(blockId: string): Promise<NotionBlock[]> {
  const blocks: NotionBlock[] = [];
  let cursor: string | undefined;
  do {
    const query = cursor ? `?start_cursor=${cursor}&page_size=100` : "?page_size=100";
    const data = await notionApi(`/v1/blocks/${blockId}/children${query}`);
    blocks.push(...(data.results ?? []));
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return blocks;
}

export async function fetchNotionPageText(urlOrId: string): Promise<string> {
  const pageId = extractNotionPageId(urlOrId);
  if (!pageId) throw new Error("Could not find a Notion page ID in that link");

  const lines = await fetchBlockChildrenRecursive(pageId);
  return lines.join("\n").trim();
}
