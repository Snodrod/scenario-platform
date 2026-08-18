"use client";

import { useState } from "react";
import type { SceneWithShots } from "@/lib/types";
import { ShotCard } from "./ShotCard";
import { RevisionsImport } from "./RevisionsImport";

export function StoryboardPanel({
  projectId,
  scriptId,
  initialScenes,
  canEdit,
}: {
  projectId: string;
  scriptId: string;
  initialScenes: SceneWithShots[];
  canEdit: boolean;
}) {
  const [scenes, setScenes] = useState<SceneWithShots[]>(initialScenes);

  async function updateShot(sceneId: string, shotId: string, patch: Record<string, unknown>) {
    setScenes((prev) =>
      prev.map((scene) =>
        scene.id !== sceneId
          ? scene
          : {
              ...scene,
              shots: scene.shots.map((s) => (s.id === shotId ? { ...s, ...patch } : s)),
            }
      )
    );
    await fetch(`/api/shots/${shotId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  async function deleteShot(sceneId: string, shotId: string) {
    if (!window.confirm("Удалить кадр?")) return;
    setScenes((prev) =>
      prev.map((scene) =>
        scene.id !== sceneId ? scene : { ...scene, shots: scene.shots.filter((s) => s.id !== shotId) }
      )
    );
    await fetch(`/api/shots/${shotId}`, { method: "DELETE" });
  }

  async function generateShot(sceneId: string, shotId: string, opts: { provider: "openai" | "gemini"; prompt?: string }) {
    const res = await fetch(`/api/shots/${shotId}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(opts),
    });
    const json = await res.json();
    if (!res.ok) {
      window.alert(`Ошибка генерации: ${json.error ?? "неизвестная ошибка"}`);
      return;
    }
    setScenes((prev) =>
      prev.map((scene) =>
        scene.id !== sceneId
          ? scene
          : {
              ...scene,
              shots: scene.shots.map((s) =>
                s.id === shotId
                  ? { ...s, status: "needs_review", activeGeneration: json.generation, prompt: opts.prompt ?? s.prompt }
                  : s
              ),
            }
      )
    );
  }

  async function addShot(sceneId: string) {
    const res = await fetch(`/api/scenes/${sceneId}/shots`, { method: "POST", body: JSON.stringify({}) });
    const json = await res.json();
    if (!res.ok) return;
    setScenes((prev) =>
      prev.map((scene) =>
        scene.id !== sceneId ? scene : { ...scene, shots: [...scene.shots, { ...json.shot, activeGeneration: null }] }
      )
    );
  }

  async function addScene() {
    const title = window.prompt("Название сцены:", "Новая сцена");
    if (title === null) return;
    const res = await fetch("/api/scenes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, scriptId, title }),
    });
    const json = await res.json();
    if (!res.ok) return;
    setScenes((prev) => [...prev, { ...json.scene, shots: [] }]);
  }

  async function deleteScene(sceneId: string) {
    if (!window.confirm("Удалить сцену вместе со всеми кадрами?")) return;
    setScenes((prev) => prev.filter((s) => s.id !== sceneId));
    await fetch(`/api/scenes/${sceneId}`, { method: "DELETE" });
  }

  if (scenes.length === 0) {
    return (
      <div className="text-sm text-neutral-500">
        Раскадровки пока нет. Перейдите на вкладку «Сценарий» и нажмите «Разбить на сцены»
        {canEdit ? ", либо " : "."}
        {canEdit && (
          <button onClick={addScene} className="text-neutral-200 underline">
            добавьте первую сцену вручную
          </button>
        )}
        .
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {canEdit && <RevisionsImport projectId={projectId} />}
      {scenes
        .sort((a, b) => a.order_index - b.order_index)
        .map((scene, sceneIdx) => (
          <div key={scene.id}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-neutral-300">
                Сцена {sceneIdx + 1}. {scene.title}
              </h3>
              {canEdit && (
                <div className="flex items-center gap-3 text-xs">
                  <button onClick={() => addShot(scene.id)} className="text-neutral-400 hover:text-neutral-200">
                    + кадр
                  </button>
                  <button onClick={() => deleteScene(scene.id)} className="text-red-500 hover:text-red-400">
                    удалить сцену
                  </button>
                </div>
              )}
            </div>
            {scene.summary && <p className="text-xs text-neutral-500 mb-3">{scene.summary}</p>}
            <div className="flex flex-col gap-4">
              {scene.shots
                .sort((a, b) => a.order_index - b.order_index)
                .map((shot, shotIdx) => (
                  <ShotCard
                    key={shot.id}
                    shot={shot}
                    index={shotIdx}
                    canEdit={canEdit}
                    onUpdate={(patch) => updateShot(scene.id, shot.id, patch)}
                    onDelete={() => deleteShot(scene.id, shot.id)}
                    onGenerate={(opts) => generateShot(scene.id, shot.id, opts)}
                  />
                ))}
            </div>
          </div>
        ))}
      {canEdit && (
        <button onClick={addScene} className="self-start text-sm text-neutral-400 hover:text-neutral-200">
          + Добавить сцену
        </button>
      )}
    </div>
  );
}
