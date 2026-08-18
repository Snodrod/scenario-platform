import { z } from "zod";
import { generateJSON, resolveDefaultTextProvider, type TextProviderId } from "./text";

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
  revisionText: string,
  provider?: TextProviderId
): Promise<RevisionMatch[]> {
  if (shots.length === 0) throw new Error("В проекте пока нет кадров, к которым можно привязать правки");

  const shotList = shots
    .map(
      (s) =>
        `id=${s.id} | сцена="${s.sceneTitle}" | кадр #${s.orderIndex + 1} | промпт="${s.prompt.slice(0, 200)}" | реплика="${s.lineText ?? ""}"`
    )
    .join("\n");

  const raw = await generateJSON(
    provider ?? resolveDefaultTextProvider(),
    systemPrompt(),
    `КАДРЫ ПРОЕКТА:\n${shotList}\n\nТЕКСТ ПРАВОК КЛИЕНТА:\n${revisionText}`,
    0.2
  );

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
