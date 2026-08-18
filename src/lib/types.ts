import type { Database } from "@/lib/supabase/types";

export type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];
export type ScriptRow = Database["public"]["Tables"]["scripts"]["Row"];
export type SceneRow = Database["public"]["Tables"]["scenes"]["Row"];
export type ShotRow = Database["public"]["Tables"]["shots"]["Row"];
export type GenerationRow = Database["public"]["Tables"]["generations"]["Row"];
export type CharacterRow = Database["public"]["Tables"]["characters"]["Row"];
export type MemberRow = Database["public"]["Tables"]["project_members"]["Row"];
export type CommentRow = Database["public"]["Tables"]["comments"]["Row"];

export type ShotWithGeneration = ShotRow & { activeGeneration: GenerationRow | null };
export type SceneWithShots = SceneRow & { shots: ShotWithGeneration[] };
