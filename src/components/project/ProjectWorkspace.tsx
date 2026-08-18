"use client";

import { useState } from "react";
import type { ProjectRow, ScriptRow, SceneWithShots, CharacterRow } from "@/lib/types";
import type { MemberRole } from "@/lib/supabase/types";
import { ScriptPanel } from "./ScriptPanel";
import { StoryboardPanel } from "./StoryboardPanel";
import { CharacterPanel } from "./CharacterPanel";
import { TeamPanel } from "./TeamPanel";
import { ExportButton } from "./ExportButton";

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
}) {
  const [tab, setTab] = useState<Tab>("script");
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

      {tab === "script" && (
        <ScriptPanel
          scriptId={script.id}
          projectId={project.id}
          initialContent={script.content}
          canEdit={canEdit}
          hasScenes={scenes.length > 0}
          driveConfigured={driveConfigured}
          driveConnected={driveConnected}
          notionConfigured={notionConfigured}
        />
      )}
      {tab === "storyboard" && (
        <StoryboardPanel projectId={project.id} scriptId={script.id} initialScenes={scenes} canEdit={canEdit} />
      )}
      {tab === "characters" && (
        <CharacterPanel projectId={project.id} initialCharacters={characters} canEdit={canEdit} />
      )}
      {tab === "team" && isOwnerOrWriter && (
        <TeamPanel projectId={project.id} initialMembers={members} ownerEmail={ownerEmail} />
      )}
    </div>
  );
}
