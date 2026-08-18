import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/Header";
import { ProjectWorkspace } from "@/components/project/ProjectWorkspace";
import type { SceneWithShots } from "@/lib/types";
import { resolveProjectRole } from "@/lib/project-access";
import { isGoogleDriveConfigured } from "@/lib/google/oauth";
import { isNotionConfigured } from "@/lib/text-extract";
import { availableTextProviders } from "@/lib/ai/text";

export default async function ProjectPage(props: PageProps<"/project/[id]">) {
  const { id } = await props.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: project } = await supabase.from("projects").select("*").eq("id", id).single();
  if (!project) notFound();

  const { data: currentMembership } = await supabase
    .from("project_members")
    .select("role")
    .eq("project_id", id)
    .eq("user_id", user?.id ?? "")
    .maybeSingle();
  const role = user
    ? resolveProjectRole({ ownerId: project.owner_id, userId: user.id, membershipRole: currentMembership?.role }) ?? "viewer"
    : "viewer";

  const { data: script } = await supabase.from("scripts").select("*").eq("project_id", id).single();

  const { data: rawScenes } = await supabase
    .from("scenes")
    .select("*, shots(*, generations!shots_active_generation_fk(*))")
    .eq("script_id", script?.id ?? "")
    .order("order_index");

  const scenes: SceneWithShots[] = (rawScenes ?? []).map((scene) => ({
    ...scene,
    shots: (scene.shots ?? []).map((shot: Record<string, unknown>) => ({
      ...shot,
      activeGeneration: shot.generations ?? null,
    })),
  })) as SceneWithShots[];

  const { data: characters } = await supabase.from("characters").select("*").eq("project_id", id);

  const { data: ownerProfile } = await supabase.from("profiles").select("email").eq("id", project.owner_id).single();

  const { data: memberRows } = await supabase
    .from("project_members")
    .select("user_id, role, profiles(email)")
    .eq("project_id", id);

  const members = (memberRows ?? []).map((m) => ({
    user_id: m.user_id,
    role: m.role,
    email: (m.profiles as { email: string | null } | null)?.email ?? null,
  }));

  let driveConnected = false;
  if (user) {
    const { data: googleAccount } = await supabase
      .from("google_accounts")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    driveConnected = Boolean(googleAccount);
  }

  return (
    <>
      <Header email={user?.email} />
      <ProjectWorkspace
        project={project}
        script={script!}
        scenes={scenes}
        characters={characters ?? []}
        members={members}
        ownerEmail={ownerProfile?.email ?? null}
        role={role}
        driveConfigured={isGoogleDriveConfigured()}
        driveConnected={driveConnected}
        notionConfigured={isNotionConfigured()}
        textProviders={availableTextProviders()}
      />
    </>
  );
}
