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
