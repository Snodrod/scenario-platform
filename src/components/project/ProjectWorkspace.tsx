"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ProjectRow, ScriptRow, SceneWithShots, CharacterRow } from "@/lib/types";
import type { MemberRole } from "@/lib/supabase/types";
import { ScriptPanel } from "./ScriptPanel";
import { StoryboardPanel } from "./StoryboardPanel";
import { CharacterPanel } from "./CharacterPanel";
import { TeamPanel } from "./TeamPanel";
import { ExportButton } from "./ExportButton";
import type { TextProviderId } from "@/lib/ai/text-types";

type Tab = "script" | "storyboard" | "characters" | "team";

const TAB_LABEL: Record<Tab, string> = {
  script: "Сценарий",
  storyboard: "Раскадровка",
  characters: "Персонажи",
  team: "Команда",
};

export function ProjectWorkspace({
  project,
  script,
  scenes,
  characters,
  members,
  ownerEmail,
  role,
  driveConfigured,
  driveConnected,
  notionConfigured,
  textProviders,
}: {
  project: ProjectRow;
  script: ScriptRow;
  scenes: SceneWithShots[];
  characters: CharacterRow[];
  members: { user_id: string; role: MemberRole; email: string | null }[];
  ownerEmail: string | null;
  role: MemberRole;
  driveConfigured: boolean;
  driveConnected: boolean;
  notionConfigured: boolean;
  textProviders: TextProviderId[];
}) {
  const [tab, setTab] = useState<Tab>("script");
  const router = useRouter();
  const canEdit = role === "owner" || role === "co_writer";
  const isOwnerOrWriter = canEdit;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 flex-1 w-full">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-neutral-100">{project.name}</h1>
          <p className="text-xs text-neutral-500">
            {project.format === "short" ? "Короткий ролик" : "Длинный ролик"} · роль: {role}
          </p>
        </div>
        <ExportButton projectId={project.id} />
      </div>

      <div className="flex gap-1 border-b border-neutral-800 mb-6 text-sm">
        {(Object.keys(TAB_LABEL) as Tab[])
          .filter((t) => t !== "team" || isOwnerOrWriter)
          .map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-2 border-b-2 -mb-px ${
                tab === t ? "border-white text-white" : "border-transparent text-neutral-500 hover:text-neutral-300"
              }`}
            >
              {TAB_LABEL[t]}
            </button>
          ))}
      </div>

      {/* Every tab panel stays mounted and keeps its own local state
          (unsaved script edits, open import menus, etc.) — only CSS
          visibility toggles. Unmounting on tab switch used to reset each
          panel back to its server-loaded initial props, silently
          discarding anything the user hadn't saved yet. */}
      <div className={tab === "script" ? "" : "hidden"}>
        <ScriptPanel
          scriptId={script.id}
          projectId={project.id}
          initialContent={script.content}
          canEdit={canEdit}
          hasScenes={scenes.length > 0}
          driveConfigured={driveConfigured}
          driveConnected={driveConnected}
          notionConfigured={notionConfigured}
          textProviders={textProviders}
          onStoryboardImported={() => {
            router.refresh();
            setTab("storyboard");
          }}
        />
      </div>
      <div className={tab === "storyboard" ? "" : "hidden"}>
        <StoryboardPanel
          // Remount (resetting local state to the fresh server data)
          // whenever the actual set of scenes/shots changes server-side —
          // e.g. after "Разбить на сцены" — rather than only on first
          // mount. The panel stays mounted across tab switches otherwise,
          // so without this key it would keep showing stale data.
          key={scenes.map((s) => `${s.id}:${s.shots.length}`).join(",")}
          projectId={project.id}
          scriptId={script.id}
          initialScenes={scenes}
          canEdit={canEdit}
          textProviders={textProviders}
        />
      </div>
      <div className={tab === "characters" ? "" : "hidden"}>
        <CharacterPanel projectId={project.id} initialCharacters={characters} canEdit={canEdit} />
      </div>
      {isOwnerOrWriter && (
        <div className={tab === "team" ? "" : "hidden"}>
          <TeamPanel projectId={project.id} initialMembers={members} ownerEmail={ownerEmail} />
        </div>
      )}
    </div>
  );
}
