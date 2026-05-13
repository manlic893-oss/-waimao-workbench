export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type CustomerSource =
  | "阿里国际站"
  | "RFQ"
  | "展会"
  | "独立站"
  | "社媒"
  | "老客户介绍"
  | "其他";

export type CustomerGrade = "A" | "B" | "C";
export type CustomerStatus =
  | "no_reply_inquiry"
  | "no_reply_quote"
  | "no_reply_followup"
  | "pending_quote"
  | "catalog_sent"
  | "price_negotiation"
  | "pending_recommend"
  | "pending_drawing"
  | "pending_sample"
  | "sample_sent"
  | "no_order"
  | "pending_factory"
  | "factory_done"
  | "pending_order"
  | "closed"
  | "lost";
export type TaskCategory = "inquiry" | "rfq" | "product" | "other" | "relationship" | "data" | "development";
export type FixedTaskCategory = "daily" | "weekly";
export type KnowledgeArticleCategory = "sales_skills" | "trade_knowledge" | "tools" | "other";

export interface Database {
  public: {
    Tables: {
      customers: {
        Row: {
          id: string;
          name: string;
          country: string | null;
          address: string | null;
          phone: string | null;
          source: CustomerSource | null;
          grade: CustomerGrade | null;
          status: CustomerStatus | null;
          whatsapp: string | null;
          email: string | null;
          product: string | null;
          next_follow_date: string | null;
          assigned_to: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          country?: string | null;
          address?: string | null;
          phone?: string | null;
          source?: CustomerSource | null;
          grade?: CustomerGrade | null;
          status?: CustomerStatus | null;
          whatsapp?: string | null;
          email?: string | null;
          product?: string | null;
          next_follow_date?: string | null;
          assigned_to?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["customers"]["Insert"]>;
      };
      customer_logs: {
        Row: {
          id: string;
          customer_id: string;
          user_id: string | null;
          content: string;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          customer_id: string;
          user_id?: string | null;
          content: string;
          created_at?: string;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["customer_logs"]["Insert"]>;
      };
      fixed_tasks: {
        Row: {
          id: string;
          category: FixedTaskCategory;
          weekday: number | null;
          title: string;
          task_category: TaskCategory;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          category: FixedTaskCategory;
          weekday?: number | null;
          title: string;
          task_category: TaskCategory;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["fixed_tasks"]["Insert"]>;
      };
      daily_task_records: {
        Row: {
          id: string;
          user_id: string | null;
          date: string;
          fixed_task_id: string | null;
          title: string;
          category: TaskCategory;
          done: boolean;
          removed: boolean;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          date: string;
          fixed_task_id?: string | null;
          title: string;
          category: TaskCategory;
          done?: boolean;
          removed?: boolean;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["daily_task_records"]["Insert"]>;
      };
      daily_tasks: {
        Row: {
          id: string;
          date: string;
          category: TaskCategory;
          title: string;
          done: boolean;
          is_template: boolean;
          template_key: string | null;
          created_at: string;
          created_by: string | null;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          date: string;
          category: TaskCategory;
          title: string;
          done?: boolean;
          is_template?: boolean;
          template_key?: string | null;
          created_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["daily_tasks"]["Insert"]>;
      };
      daily_stats: {
        Row: {
          id: string;
          user_id: string | null;
          date: string;
          inquiry_count: number;
          rfq_sent: number;
          new_products: number;
          orders_closed: number;
          notes: string | null;
          ai_summary: string | null;
          submitted_at: string | null;
          created_at: string;
          created_by: string | null;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          date: string;
          inquiry_count?: number;
          rfq_sent?: number;
          new_products?: number;
          orders_closed?: number;
          notes?: string | null;
          ai_summary?: string | null;
          submitted_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["daily_stats"]["Insert"]>;
      };
      product_knowledge: {
        Row: {
          id: string;
          product_name: string;
          category: string | null;
          specs: string | null;
          price_range: string | null;
          moq: string | null;
          material: string | null;
          lead_time: string | null;
          notes: string | null;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          product_name: string;
          category?: string | null;
          specs?: string | null;
          price_range?: string | null;
          moq?: string | null;
          material?: string | null;
          lead_time?: string | null;
          notes?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["product_knowledge"]["Insert"]>;
      };
      alibaba_title_generations: {
        Row: {
          id: string;
          user_id: string | null;
          image_path: string;
          sku: string | null;
          confirmed_material: string | null;
          confirmed_size: string | null;
          confirmed_usage: string | null;
          reference_text: string | null;
          forbidden_words: string[];
          product_identification: string | null;
          possible_material: string | null;
          shape_or_style: string | null;
          recommended_keywords: string[];
          keywords_to_avoid: string[];
          titles: Json;
          recommended_title: string | null;
          reason: string | null;
          risk_check: string[];
          confirmed_title: string | null;
          status: "generated" | "confirmed";
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          image_path: string;
          sku?: string | null;
          confirmed_material?: string | null;
          confirmed_size?: string | null;
          confirmed_usage?: string | null;
          reference_text?: string | null;
          forbidden_words?: string[];
          product_identification?: string | null;
          possible_material?: string | null;
          shape_or_style?: string | null;
          recommended_keywords?: string[];
          keywords_to_avoid?: string[];
          titles?: Json;
          recommended_title?: string | null;
          reason?: string | null;
          risk_check?: string[];
          confirmed_title?: string | null;
          status?: "generated" | "confirmed";
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["alibaba_title_generations"]["Insert"]>;
      };
      quick_quote_replies: {
        Row: {
          id: string;
          user_id: string | null;
          title: string;
          items: Json;
          packaging: string;
          production_time: string;
          air_shipping_cost: number;
          air_shipping_time: string;
          sea_shipping_cost: number;
          sea_shipping_time: string;
          product_total: number;
          air_total: number;
          sea_total: number;
          quote_text: string;
          internal_note: string | null;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          title: string;
          items?: Json;
          packaging: string;
          production_time: string;
          air_shipping_cost?: number;
          air_shipping_time: string;
          sea_shipping_cost?: number;
          sea_shipping_time: string;
          product_total?: number;
          air_total?: number;
          sea_total?: number;
          quote_text: string;
          internal_note?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["quick_quote_replies"]["Insert"]>;
      };
      knowledge_articles: {
        Row: {
          id: string;
          user_id: string | null;
          title: string;
          url: string | null;
          content: string | null;
          summary: string | null;
          tags: string[] | null;
          category: KnowledgeArticleCategory | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          title: string;
          url?: string | null;
          content?: string | null;
          summary?: string | null;
          tags?: string[] | null;
          category?: KnowledgeArticleCategory | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["knowledge_articles"]["Insert"]>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type Customer = Database["public"]["Tables"]["customers"]["Row"];
export type CustomerLog = Database["public"]["Tables"]["customer_logs"]["Row"];
export type FixedTask = Database["public"]["Tables"]["fixed_tasks"]["Row"];
export type DailyTaskRecord = Database["public"]["Tables"]["daily_task_records"]["Row"];
export type DailyTask = Database["public"]["Tables"]["daily_tasks"]["Row"];
export type DailyStat = Database["public"]["Tables"]["daily_stats"]["Row"];
export type DailyReportHistoryItem = DailyStat;
export type ProductKnowledge = Database["public"]["Tables"]["product_knowledge"]["Row"];
export type AlibabaTitleGeneration = Database["public"]["Tables"]["alibaba_title_generations"]["Row"];
export type QuickQuoteReply = Database["public"]["Tables"]["quick_quote_replies"]["Row"];
export type KnowledgeArticle = Database["public"]["Tables"]["knowledge_articles"]["Row"];
