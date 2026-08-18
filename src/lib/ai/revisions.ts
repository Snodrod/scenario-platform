import OpenAI from "openai";
import { z } from "zod";

export interface ShotContext {
  id: string;
  sceneTitle: string;
  orderIndex: number;
  prompt: string;
  lineText: string | null;
}

export interface RevisionMatch {
  shotId: string;
  comment: string;
}

const resultSchema = z.object({
  items: z.array(
    z.object({
      shotId: z.string(),
      comment: z.string().min(1),
    })
  ),
});

function systemPrompt() {
  return `Ты помогаешь применить правки клиента к раскадровке видео. Тебе дают список кадров проекта (id, сцена, порядковый номер, текущий image-промпт, реплика) и большой неструктурированный текст с правками/комментариями клиента (может содержать номера кадров, цитаты, свободные формулировки, несколько правок подряд).

Разбей текст правок на отдельные смысловые пункты. Для каждого пункта определи, к какому КОНКРЕТНОМУ кадру (shotId строго из списка) он относится сильнее всего — по номеру кадра, по содержанию промпта или по реплике.

Правила:
- Используй только shotId из предоставленного списка, ничего не выдумывай.
- Если правка явно не привязана ни к одному конкретному кадру (например, общее пожелание по всему ролику) — пропусти её.
- Если один пункт правок относится к нескольким кадрам подряд — создай отдельную запись на каждый затронутый кадр.
- comment — это очищенный текст самой правки на русском языке, без лишнего форматирования и без повторения номера кадра.

Ответь СТРОГО в виде JSON без markdown-обёртки:
{"items":[{"shotId":string,"comment":string}]}`;
}

export async function matchRevisionsToShots(
  shots: ShotContext[],
  revisionText: string
): Promise<RevisionMatch[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set — add it to .env.local");
  if (shots.length === 0) throw new Error("В проекте пока нет кадров, к которым можно привязать правки");

  const client = new OpenAI({ apiKey });
  const model = process.env.OPENAI_BREAKDOWN_MODEL || "gpt-4o-mini";

  const shotList = shots
    .map(
      (s) =>
        `id=${s.id} | сцена="${s.sceneTitle}" | кадр #${s.orderIndex + 1} | промпт="${s.prompt.slice(0, 200)}" | реплика="${s.lineText ?? ""}"`
    )
    .join("\n");

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt() },
      { role: "user", content: `КАДРЫ ПРОЕКТА:\n${shotList}\n\nТЕКСТ ПРАВОК КЛИЕНТА:\n${revisionText}` },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("Model returned an empty response");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Model did not return valid JSON");
  }

  const result = resultSchema.parse(parsed);
  const validShotIds = new Set(shots.map((s) => s.id));
  return result.items.filter((item) => validShotIds.has(item.shotId));
}
