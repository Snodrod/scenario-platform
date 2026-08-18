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

interface NotionRichText {
  plain_text: string;
}

interface NotionBlock {
  id: string;
  type: string;
  has_children: boolean;
  [key: string]: unknown;
}

async function notionApi(path: string) {
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
  if (!res.ok) throw new Error(`Notion API error: ${res.status}`);
  return res.json();
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
  const lines: string[] = [];
  let cursor: string | undefined;

  do {
    const query = cursor ? `?start_cursor=${cursor}&page_size=100` : "?page_size=100";
    const data = await notionApi(`/v1/blocks/${blockId}/children${query}`);
    const blocks: NotionBlock[] = data.results ?? [];

    for (const block of blocks) {
      const line = blockToText(block);
      if (line) lines.push(line);
      if (block.has_children) {
        const childLines = await fetchBlockChildrenRecursive(block.id, depth + 1);
        lines.push(...childLines.map((l) => `  ${l}`));
      }
    }

    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);

  return lines;
}

export async function fetchNotionPageText(urlOrId: string): Promise<string> {
  const pageId = extractNotionPageId(urlOrId);
  if (!pageId) throw new Error("Could not find a Notion page ID in that link");

  const lines = await fetchBlockChildrenRecursive(pageId);
  return lines.join("\n").trim();
}
