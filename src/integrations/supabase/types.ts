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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      edges: {
        Row: {
          avg_polarity: number | null
          created_at: string
          edge_sentiment: string | null
          edge_width: number | null
          id: string
          message_count: number | null
          recipient_id: string
          sender_id: string
          weight_norm: number | null
        }
        Insert: {
          avg_polarity?: number | null
          created_at?: string
          edge_sentiment?: string | null
          edge_width?: number | null
          id?: string
          message_count?: number | null
          recipient_id: string
          sender_id: string
          weight_norm?: number | null
        }
        Update: {
          avg_polarity?: number | null
          created_at?: string
          edge_sentiment?: string | null
          edge_width?: number | null
          id?: string
          message_count?: number | null
          recipient_id?: string
          sender_id?: string
          weight_norm?: number | null
        }
        Relationships: []
      }
      emails: {
        Row: {
          bcc_emails: string[] | null
          body: string | null
          cc_emails: string[] | null
          created_at: string
          date: string | null
          emotional_markers: string[] | null
          from_email: string
          from_name: string | null
          id: string
          is_analyzed: boolean | null
          message_clean: string | null
          message_id: string | null
          month: number | null
          polarity: number | null
          raw_content: string | null
          recipient: string | null
          recipient_list: string[] | null
          sender_id: string | null
          sentiment_category: string | null
          sentiment_score: number | null
          source_file: string | null
          subject: string | null
          thread_id: string | null
          thread_subject: string | null
          to_emails: string[] | null
          to_names: string[] | null
          topics: string[] | null
          year: number | null
        }
        Insert: {
          bcc_emails?: string[] | null
          body?: string | null
          cc_emails?: string[] | null
          created_at?: string
          date?: string | null
          emotional_markers?: string[] | null
          from_email: string
          from_name?: string | null
          id?: string
          is_analyzed?: boolean | null
          message_clean?: string | null
          message_id?: string | null
          month?: number | null
          polarity?: number | null
          raw_content?: string | null
          recipient?: string | null
          recipient_list?: string[] | null
          sender_id?: string | null
          sentiment_category?: string | null
          sentiment_score?: number | null
          source_file?: string | null
          subject?: string | null
          thread_id?: string | null
          thread_subject?: string | null
          to_emails?: string[] | null
          to_names?: string[] | null
          topics?: string[] | null
          year?: number | null
        }
        Update: {
          bcc_emails?: string[] | null
          body?: string | null
          cc_emails?: string[] | null
          created_at?: string
          date?: string | null
          emotional_markers?: string[] | null
          from_email?: string
          from_name?: string | null
          id?: string
          is_analyzed?: boolean | null
          message_clean?: string | null
          message_id?: string | null
          month?: number | null
          polarity?: number | null
          raw_content?: string | null
          recipient?: string | null
          recipient_list?: string[] | null
          sender_id?: string | null
          sentiment_category?: string | null
          sentiment_score?: number | null
          source_file?: string | null
          subject?: string | null
          thread_id?: string | null
          thread_subject?: string | null
          to_emails?: string[] | null
          to_names?: string[] | null
          topics?: string[] | null
          year?: number | null
        }
        Relationships: []
      }
      persons: {
        Row: {
          avg_sentiment: number | null
          community_id: number | null
          created_at: string
          email: string
          email_count_received: number | null
          email_count_sent: number | null
          id: string
          name: string | null
          updated_at: string
        }
        Insert: {
          avg_sentiment?: number | null
          community_id?: number | null
          created_at?: string
          email: string
          email_count_received?: number | null
          email_count_sent?: number | null
          id?: string
          name?: string | null
          updated_at?: string
        }
        Update: {
          avg_sentiment?: number | null
          community_id?: number | null
          created_at?: string
          email?: string
          email_count_received?: number | null
          email_count_sent?: number | null
          id?: string
          name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      processing_jobs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          job_type: string
          processed_items: number | null
          status: string
          total_items: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          job_type: string
          processed_items?: number | null
          status?: string
          total_items?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          job_type?: string
          processed_items?: number | null
          status?: string
          total_items?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      relationships: {
        Row: {
          created_at: string
          emails_a_to_b: number | null
          emails_b_to_a: number | null
          first_contact: string | null
          id: string
          last_contact: string | null
          person_a_id: string
          person_b_id: string
          sentiment_a_to_b: number | null
          sentiment_b_to_a: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          emails_a_to_b?: number | null
          emails_b_to_a?: number | null
          first_contact?: string | null
          id?: string
          last_contact?: string | null
          person_a_id: string
          person_b_id: string
          sentiment_a_to_b?: number | null
          sentiment_b_to_a?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          emails_a_to_b?: number | null
          emails_b_to_a?: number | null
          first_contact?: string | null
          id?: string
          last_contact?: string | null
          person_a_id?: string
          person_b_id?: string
          sentiment_a_to_b?: number | null
          sentiment_b_to_a?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "relationships_person_a_id_fkey"
            columns: ["person_a_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relationships_person_b_id_fkey"
            columns: ["person_b_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
