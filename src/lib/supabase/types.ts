// Hand-written to match supabase/schema.sql.
// Once the project is live, regenerate with:
//   npx supabase gen types typescript --project-id <id> > src/lib/supabase/types.ts
// and re-apply any manual edits below if you diverge from the CLI output.

export type MemberRole = "owner" | "co_writer" | "client" | "viewer";
export type ShotStatus = "draft" | "generating" | "needs_review" | "approved" | "needs_regen";
export type GenerationKind = "image" | "voice" | "music" | "video" | "text";
export type GenerationStatus = "pending" | "running" | "completed" | "failed";
export type CommentTarget = "shot" | "scene";
export type ProjectFormat = "long" | "short";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; email: string | null; full_name: string | null; created_at: string };
        Insert: { id: string; email?: string | null; full_name?: string | null };
        Update: Partial<{ email: string | null; full_name: string | null }>;
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          format: ProjectFormat;
          owner_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          format?: ProjectFormat;
          owner_id: string;
        };
        Update: Partial<{ name: string; description: string | null; format: ProjectFormat }>;
        Relationships: [];
      };
      project_members: {
        Row: {
          project_id: string;
          user_id: string;
          invited_email: string | null;
          role: MemberRole;
          created_at: string;
        };
        Insert: {
          project_id: string;
          user_id: string;
          invited_email?: string | null;
          role?: MemberRole;
        };
        Update: Partial<{ role: MemberRole }>;
        Relationships: [
          {
            foreignKeyName: "project_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      scripts: {
        Row: { id: string; project_id: string; content: string; version: number; updated_at: string };
        Insert: { id?: string; project_id: string; content?: string; version?: number };
        Update: Partial<{ content: string; version: number; updated_at: string }>;
        Relationships: [];
      };
      characters: {
        Row: {
          id: string;
          project_id: string;
          name: string;
          description: string | null;
          prompt_token: string | null;
          reference_asset_urls: string[];
          voice_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          name: string;
          description?: string | null;
          prompt_token?: string | null;
          reference_asset_urls?: string[];
          voice_id?: string | null;
        };
        Update: Partial<{
          name: string;
          description: string | null;
          prompt_token: string | null;
          reference_asset_urls: string[];
          voice_id: string | null;
        }>;
        Relationships: [];
      };
      scenes: {
        Row: {
          id: string;
          script_id: string;
          project_id: string;
          order_index: number;
          title: string | null;
          summary: string | null;
          source_text: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          script_id: string;
          project_id: string;
          order_index: number;
          title?: string | null;
          summary?: string | null;
          source_text?: string | null;
        };
        Update: Partial<{
          order_index: number;
          title: string | null;
          summary: string | null;
          source_text: string | null;
        }>;
        Relationships: [
          {
            foreignKeyName: "scenes_script_id_fkey";
            columns: ["script_id"];
            isOneToOne: false;
            referencedRelation: "scripts";
            referencedColumns: ["id"];
          },
        ];
      };
      shots: {
        Row: {
          id: string;
          scene_id: string;
          project_id: string;
          order_index: number;
          prompt: string;
          status: ShotStatus;
          active_generation_id: string | null;
          duration_seconds: number | null;
          line_text: string | null;
          emotion_notes: string | null;
          editing_notes: string | null;
          sound_notes: string | null;
          voiceover_text: string | null;
          tags: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          scene_id: string;
          project_id: string;
          order_index: number;
          prompt?: string;
          status?: ShotStatus;
          duration_seconds?: number | null;
          line_text?: string | null;
          emotion_notes?: string | null;
          editing_notes?: string | null;
          sound_notes?: string | null;
          voiceover_text?: string | null;
          tags?: string[];
        };
        Update: Partial<{
          order_index: number;
          prompt: string;
          status: ShotStatus;
          active_generation_id: string | null;
          duration_seconds: number | null;
          line_text: string | null;
          emotion_notes: string | null;
          editing_notes: string | null;
          sound_notes: string | null;
          voiceover_text: string | null;
          tags: string[];
        }>;
        Relationships: [
          {
            foreignKeyName: "scenes_shots_fkey";
            columns: ["scene_id"];
            isOneToOne: false;
            referencedRelation: "scenes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shots_active_generation_fk";
            columns: ["active_generation_id"];
            isOneToOne: false;
            referencedRelation: "generations";
            referencedColumns: ["id"];
          },
        ];
      };
      generations: {
        Row: {
          id: string;
          shot_id: string;
          project_id: string;
          kind: GenerationKind;
          provider: string;
          prompt_used: string | null;
          asset_url: string | null;
          status: GenerationStatus;
          error: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          shot_id: string;
          project_id: string;
          kind?: GenerationKind;
          provider: string;
          prompt_used?: string | null;
          asset_url?: string | null;
          status?: GenerationStatus;
          error?: string | null;
          created_by?: string | null;
        };
        Update: Partial<{
          asset_url: string | null;
          status: GenerationStatus;
          error: string | null;
        }>;
        Relationships: [
          {
            foreignKeyName: "generations_shot_id_fkey";
            columns: ["shot_id"];
            isOneToOne: false;
            referencedRelation: "shots";
            referencedColumns: ["id"];
          },
        ];
      };
      comments: {
        Row: {
          id: string;
          project_id: string;
          target_type: CommentTarget;
          target_id: string;
          author_id: string | null;
          body: string;
          resolved: boolean;
          parent_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          target_type: CommentTarget;
          target_id: string;
          author_id: string;
          body: string;
          parent_id?: string | null;
        };
        Update: Partial<{ resolved: boolean; body: string }>;
        Relationships: [];
      };
      exports: {
        Row: {
          id: string;
          project_id: string;
          type: string;
          url: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          type: string;
          url?: string | null;
          created_by?: string | null;
        };
        Update: Partial<{ url: string | null }>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_project_member: { Args: { pid: string }; Returns: boolean };
      project_role: { Args: { pid: string }; Returns: MemberRole };
    };
    Enums: {
      member_role: MemberRole;
      shot_status: ShotStatus;
      generation_kind: GenerationKind;
      generation_status: GenerationStatus;
      comment_target: CommentTarget;
    };
    CompositeTypes: Record<string, never>;
  };
}
