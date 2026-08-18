import { z } from "zod";
import type { BreakdownResult } from "./types";
import { generateJSON, resolveDefaultTextProvider, type TextProviderId } from "./text";

type ProjectFormatLike = "long" | "short";

const shotSchema = z.object({
  prompt: z.string().min(1),
  durationSeconds: z.number().positive().optional(),
  lineText: z.string().optional(),
  emotionNotes: z.string().optional(),
  editingNotes: z.string().optional(),
  soundNotes: z.string().optional(),
  voiceoverText: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

const sceneSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  sourceText: z.string().min(1),
  shots: z.array(shotSchema).min(1),
});

const responseSchema = z.object({
  scenes: z.array(sceneSchema).min(1),
});

function systemPrompt(format: ProjectFormatLike, characterNames: string[]) {
  const lengthGuidance =
    format === "short"
      ? "Это короткий вертикальный ролик (до ~90 секунд). Дели на 5-12 коротких сцен, по 1 кадру на сцену, если не очевидна смена ракурса. Кадры обычно 3-6 секунд."
      : "Это длинный ролик. Дели на сцены по смыслу/локации/времени, 1-4 кадра на сцену в зависимости от насыщенности действия.";

  const characterNote = characterNames.length
    ? `В проекте уже есть персонажи: ${characterNames.join(", ")}. Если сцена о них — упомяни имя персонажа в начале prompt кадра, чтобы потом подставить референс.`
    : "";

  return `Ты — раскадровщик и монтажный супервайзер. Тебе дают текст сценария. Разбей его на сцены и кадры для раскадровки (storyboard), как для монтажного листа с озвучкой.

${lengthGuidance}
${characterNote}

Для каждой сцены укажи:
- title: короткое название сцены
- summary: 1-2 предложения о том, что происходит
- sourceText: дословная выдержка из исходного сценария, которую покрывает эта сцена
- shots: список кадров

Для каждого кадра укажи:
- prompt: готовый промпт для генерации изображения (визуальное описание кадра: план, персонажи, окружение, свет, настроение — на английском языке, т.к. большинство image-моделей лучше понимают английские промпты)
- durationSeconds: примерная длительность кадра в секундах (число)
- lineText: дословная реплика/фраза диктора, которая звучит в этом кадре (если есть в сценарии; иначе пропусти поле)
- voiceoverText: то же самое как чистый текст под озвучку (без ремарок) — может совпадать с lineText
- emotionNotes: как это должно звучать — тон, темп, интонация для диктора
- editingNotes: техническое задание для монтажёра — тип плана, движение камеры, склейка, графика/титры
- soundNotes: что со звуком в этот момент — тишина/музыка/шумы/эффекты
- tags: 1-3 коротких тега-категории кадра (жанр/тип, например "Природа", "Новый кадр")

Ответь СТРОГО в виде JSON без markdown-обёртки, по схеме:
{"scenes":[{"title":string,"summary":string,"sourceText":string,"shots":[{"prompt":string,"durationSeconds":number,"lineText":string,"voiceoverText":string,"emotionNotes":string,"editingNotes":string,"soundNotes":string,"tags":string[]}]}]}`;
}

export async function breakdownScript(
  script: string,
  format: ProjectFormatLike,
  characterNames: string[] = [],
  provider?: TextProviderId
): Promise<BreakdownResult> {
  const raw = await generateJSON(
    provider ?? resolveDefaultTextProvider(),
    systemPrompt(format, characterNames),
    script,
    0.4
  );

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error("[breakdown] invalid JSON from model, length:", raw.length, "tail:", raw.slice(-500));
    throw new Error("Модель вернула невалидный JSON (возможно, ответ обрезан) — попробуйте другой провайдер или сократите сценарий");
  }

  let result;
  try {
    result = responseSchema.parse(parsed);
  } catch (err) {
    console.error("[breakdown] schema validation failed:", err, "raw:", JSON.stringify(parsed).slice(0, 1000));
    throw new Error("Модель вернула неожиданный формат данных — попробуйте ещё раз или смените провайдера");
  }

  return {
    scenes: result.scenes.map((scene, sceneIndex) => ({
      orderIndex: sceneIndex,
      title: scene.title,
      summary: scene.summary,
      sourceText: scene.sourceText,
      shots: scene.shots.map((shot, shotIndex) => ({
        orderIndex: shotIndex,
        prompt: shot.prompt,
        durationSeconds: shot.durationSeconds,
        lineText: shot.lineText,
        emotionNotes: shot.emotionNotes,
        editingNotes: shot.editingNotes,
        soundNotes: shot.soundNotes,
        voiceoverText: shot.voiceoverText,
        tags: shot.tags,
      })),
    })),
  };
}
