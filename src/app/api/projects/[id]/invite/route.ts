import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveProjectRole } from "@/lib/project-access";

// Adds a collaborator (co-writer or client-reviewer) by email.
// - If they already have an account, link it immediately.
// - Otherwise, create the auth user silently via admin.createUser —
//   this does NOT send any email (unlike admin.inviteUserByEmail, which
//   goes through Supabase's own rate-limited mailer). Membership is
//   granted right away; the invited person gets access the moment they
//   sign in with the same email (Google OAuth, or magic link if SMTP is
//   configured) — share the project link with them yourself.
export async function POST(request: Request, ctx: RouteContext<"/api/projects/[id]/invite">) {
  const { id: projectId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: project } = await supabase.from("projects").select("owner_id").eq("id", projectId).maybeSingle();
  if (!project) return NextResponse.json({ error: "project not found" }, { status: 404 });

  const { data: membership } = await supabase
    .from("project_members")
    .select("role")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();
  const role = resolveProjectRole({ ownerId: project.owner_id, userId: user.id, membershipRole: membership?.role });
  if (role !== "owner" && role !== "co_writer") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { email, role: inviteRole } = await request.json();
  const targetRole = ["co_writer", "client", "viewer"].includes(inviteRole) ? inviteRole : "client";
  if (!email?.trim()) return NextResponse.json({ error: "email is required" }, { status: 400 });

  // createAdminClient() throws synchronously if this is unset — a bare
  // exception here means Next.js returns its default error page instead
  // of JSON, which crashes the client's res.json() with a cryptic parse
  // error rather than showing "not configured". Catch it explicitly.
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "Приглашения не настроены — не задан SUPABASE_SERVICE_ROLE_KEY на сервере (см. README)" },
      { status: 501 }
    );
  }
  const admin = createAdminClient();

  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  let userId = existingProfile?.id ?? null;

  // No account yet for this email — create one silently. email_confirm:
  // true means they can sign straight in (Google OAuth or magic link)
  // without any confirmation step, and critically, createUser never
  // sends mail, unlike inviteUserByEmail.
  if (!userId) {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }
    userId = created.user?.id ?? null;
  }

  if (!userId) {
    return NextResponse.json({ error: "could not resolve or create user" }, { status: 500 });
  }

  const { error: memberError } = await admin
    .from("project_members")
    .upsert(
      { project_id: projectId, user_id: userId, invited_email: email, role: targetRole },
      { onConflict: "project_id,user_id" }
    );

  if (memberError) return NextResponse.json({ error: memberError.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
