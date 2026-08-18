import type { MemberRole } from "@/lib/supabase/types";

type ProjectAccessInput = {
  ownerId: string;
  userId: string;
  membershipRole: MemberRole | null | undefined;
};

// Keep role resolution in application code. The database uses its private
// helper functions only inside RLS policies, so they cannot be called as
// public RPC endpoints.
export function resolveProjectRole({ ownerId, userId, membershipRole }: ProjectAccessInput): MemberRole | null {
  if (ownerId === userId) return "owner";
  return membershipRole ?? null;
}
