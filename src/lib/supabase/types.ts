// Generated from the live Supabase project via MCP `generate_typescript_types`.
// Regenerate the same way after any schema change:
//   npx supabase gen types typescript --project-id hxwkebfpxhqcjohfravt > src/lib/supabase/types.ts
// then re-append the convenience aliases at the bottom of this file.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      characters: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          project_id: string
          prompt_token: string | null
          reference_asset_urls: string[]
          voice_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          project_id: string
          prompt_token?: string | null
          reference_asset_urls?: string[]
          voice_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          project_id?: string
          prompt_token?: string | null
          reference_asset_urls?: string[]
          voice_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "characters_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: string
          parent_id: string | null
          project_id: string
          resolved: boolean
          target_id: string
          target_type: Database["public"]["Enums"]["comment_target"]
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          parent_id?: string | null
          project_id: string
          resolved?: boolean
          target_id: string
          target_type: Database["public"]["Enums"]["comment_target"]
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          project_id?: string
          resolved?: boolean
          target_id?: string
          target_type?: Database["public"]["Enums"]["comment_target"]
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      exports: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          project_id: string
          type: string
          url: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          project_id: string
          type: string
          url?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          project_id?: string
          type?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      generations: {
        Row: {
          asset_url: string | null
          created_at: string
          created_by: string | null
          error: string | null
          id: string
          kind: Database["public"]["Enums"]["generation_kind"]
          project_id: string
          prompt_used: string | null
          provider: string
          shot_id: string
          status: Database["public"]["Enums"]["generation_status"]
        }
        Insert: {
          asset_url?: string | null
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["generation_kind"]
          project_id: string
          prompt_used?: string | null
          provider: string
          shot_id: string
          status?: Database["public"]["Enums"]["generation_status"]
        }
        Update: {
          asset_url?: string | null
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["generation_kind"]
          project_id?: string
          prompt_used?: string | null
          provider?: string
          shot_id?: string
          status?: Database["public"]["Enums"]["generation_status"]
        }
        Relationships: [
          {
            foreignKeyName: "generations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generations_shot_id_fkey"
            columns: ["shot_id"]
            isOneToOne: false
            referencedRelation: "shots"
            referencedColumns: ["id"]
          },
        ]
      }
      google_accounts: {
        Row: {
          access_token: string | null
          access_token_expires_at: string | null
          connected_at: string
          google_email: string | null
          refresh_token: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          access_token_expires_at?: string | null
          connected_at?: string
          google_email?: string | null
          refresh_token: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          access_token_expires_at?: string | null
          connected_at?: string
          google_email?: string | null
          refresh_token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      project_members: {
        Row: {
          created_at: string
          invited_email: string | null
          project_id: string
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          invited_email?: string | null
          project_id: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          invited_email?: string | null
          project_id?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          description: string | null
          format: string
          id: string
          name: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          format?: string
          id?: string
          name: string
          owner_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          format?: string
          id?: string
          name?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      scenes: {
        Row: {
          created_at: string
          id: string
          order_index: number
          project_id: string
          script_id: string
          source_text: string | null
          summary: string | null
          title: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          order_index: number
          project_id: string
          script_id: string
          source_text?: string | null
          summary?: string | null
          title?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          order_index?: number
          project_id?: string
          script_id?: string
          source_text?: string | null
          summary?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scenes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scenes_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "scripts"
            referencedColumns: ["id"]
          },
        ]
      }
      scripts: {
        Row: {
          content: string
          id: string
          project_id: string
          updated_at: string
          version: number
        }
        Insert: {
          content?: string
          id?: string
          project_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          content?: string
          id?: string
          project_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "scripts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      shots: {
        Row: {
          active_generation_id: string | null
          created_at: string
          duration_seconds: number | null
          editing_notes: string | null
          emotion_notes: string | null
          id: string
          line_text: string | null
          order_index: number
          project_id: string
          prompt: string
          scene_id: string
          sound_notes: string | null
          status: Database["public"]["Enums"]["shot_status"]
          tags: string[]
          voiceover_text: string | null
        }
        Insert: {
          active_generation_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          editing_notes?: string | null
          emotion_notes?: string | null
          id?: string
          line_text?: string | null
          order_index: number
          project_id: string
          prompt?: string
          scene_id: string
          sound_notes?: string | null
          status?: Database["public"]["Enums"]["shot_status"]
          tags?: string[]
          voiceover_text?: string | null
        }
        Update: {
          active_generation_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          editing_notes?: string | null
          emotion_notes?: string | null
          id?: string
          line_text?: string | null
          order_index?: number
          project_id?: string
          prompt?: string
          scene_id?: string
          sound_notes?: string | null
          status?: Database["public"]["Enums"]["shot_status"]
          tags?: string[]
          voiceover_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shots_active_generation_fk"
            columns: ["active_generation_id"]
            isOneToOne: false
            referencedRelation: "generations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shots_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shots_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "scenes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_project_member: { Args: { pid: string }; Returns: boolean }
      project_role: {
        Args: { pid: string }
        Returns: Database["public"]["Enums"]["member_role"]
      }
      storage_project_id: { Args: { object_name: string }; Returns: string }
    }
    Enums: {
      comment_target: "shot" | "scene"
      generation_kind: "image" | "voice" | "music" | "video" | "text"
      generation_status: "pending" | "running" | "completed" | "failed"
      member_role: "owner" | "co_writer" | "client" | "viewer"
      shot_status:
        | "draft"
        | "generating"
        | "needs_review"
        | "approved"
        | "needs_regen"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      comment_target: ["shot", "scene"],
      generation_kind: ["image", "voice", "music", "video", "text"],
      generation_status: ["pending", "running", "completed", "failed"],
      member_role: ["owner", "co_writer", "client", "viewer"],
      shot_status: [
        "draft",
        "generating",
        "needs_review",
        "approved",
        "needs_regen",
      ],
    },
  },
} as const

// --- App-layer convenience aliases (not generated) ----------------------
export type MemberRole = Database["public"]["Enums"]["member_role"]
export type ShotStatus = Database["public"]["Enums"]["shot_status"]
export type GenerationKind = Database["public"]["Enums"]["generation_kind"]
export type GenerationStatus = Database["public"]["Enums"]["generation_status"]
export type CommentTarget = Database["public"]["Enums"]["comment_target"]
// `projects.format` is a plain text column (no DB enum) — this union is
// enforced only at the app layer (API routes / forms), not by Postgres.
export type ProjectFormat = "long" | "short"
