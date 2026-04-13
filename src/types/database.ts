export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      ingredients: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          image_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          image_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          image_url?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      supplements: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          image_url: string | null;
          daily_target: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          image_url?: string | null;
          daily_target?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          image_url?: string | null;
          daily_target?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      supplement_logs: {
        Row: {
          id: string;
          supplement_id: string;
          user_id: string;
          taken_date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          supplement_id: string;
          user_id: string;
          taken_date?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          supplement_id?: string;
          user_id?: string;
          taken_date?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      recipes: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          spoonacular_id: number | null;
          youtube_video_id: string | null;
          youtube_url: string | null;
          thumbnail_url: string | null;
          source: "suggested" | "searched" | "custom";
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          spoonacular_id?: number | null;
          youtube_video_id?: string | null;
          youtube_url?: string | null;
          thumbnail_url?: string | null;
          source?: "suggested" | "searched" | "custom";
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          spoonacular_id?: number | null;
          youtube_video_id?: string | null;
          youtube_url?: string | null;
          thumbnail_url?: string | null;
          source?: "suggested" | "searched" | "custom";
          created_at?: string;
        };
        Relationships: [];
      };
      recipe_ingredients: {
        Row: {
          id: string;
          recipe_id: string;
          name: string;
          sort_order: number;
        };
        Insert: {
          id?: string;
          recipe_id: string;
          name: string;
          sort_order?: number;
        };
        Update: {
          id?: string;
          recipe_id?: string;
          name?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      meal_plan_entries: {
        Row: {
          id: string;
          user_id: string;
          recipe_id: string;
          date: string;
          meal_type: "breakfast" | "lunch" | "dinner" | "snack";
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          recipe_id: string;
          date: string;
          meal_type: "breakfast" | "lunch" | "dinner" | "snack";
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          recipe_id?: string;
          date?: string;
          meal_type?: "breakfast" | "lunch" | "dinner" | "snack";
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Ingredient = Database["public"]["Tables"]["ingredients"]["Row"];
export type Supplement = Database["public"]["Tables"]["supplements"]["Row"];
export type Recipe = Database["public"]["Tables"]["recipes"]["Row"];
export type RecipeIngredient =
  Database["public"]["Tables"]["recipe_ingredients"]["Row"];
export type MealPlanEntry =
  Database["public"]["Tables"]["meal_plan_entries"]["Row"];
export type SupplementLog =
  Database["public"]["Tables"]["supplement_logs"]["Row"];
