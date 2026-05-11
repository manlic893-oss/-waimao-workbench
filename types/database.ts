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
export type CustomerStatus = "new" | "follow" | "sample" | "closed" | "lost";
export type TaskCategory = "inquiry" | "rfq" | "product" | "other" | "relationship";

export interface Database {
  public: {
    Tables: {
      customers: {
        Row: {
          id: string;
          name: string;
          country: string | null;
          source: CustomerSource | null;
          grade: CustomerGrade | null;
          status: CustomerStatus | null;
          whatsapp: string | null;
          email: string | null;
          product: string | null;
          next_follow_date: string | null;
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
          source?: CustomerSource | null;
          grade?: CustomerGrade | null;
          status?: CustomerStatus | null;
          whatsapp?: string | null;
          email?: string | null;
          product?: string | null;
          next_follow_date?: string | null;
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
          content: string;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          customer_id: string;
          content: string;
          created_at?: string;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["customer_logs"]["Insert"]>;
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
          date: string;
          inquiry_count: number;
          rfq_sent: number;
          new_products: number;
          orders_closed: number;
          notes: string | null;
          created_at: string;
          created_by: string | null;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          date: string;
          inquiry_count?: number;
          rfq_sent?: number;
          new_products?: number;
          orders_closed?: number;
          notes?: string | null;
          created_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["daily_stats"]["Insert"]>;
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
export type DailyTask = Database["public"]["Tables"]["daily_tasks"]["Row"];
export type DailyStat = Database["public"]["Tables"]["daily_stats"]["Row"];
