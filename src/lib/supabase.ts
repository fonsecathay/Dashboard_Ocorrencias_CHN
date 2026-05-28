import { createClient } from "@supabase/supabase-js";
import type { AppState } from "@/lib/dashboard-data";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

export const isSupabaseConfigured = Boolean(supabase);

export async function saveRemoteState(state: AppState, key: string): Promise<string> {
  if (!supabase) throw new Error("Supabase não está configurado.");

  const updatedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("dashboard_state")
    .upsert({ id: key, state, updated_at: updatedAt }, { onConflict: "id" });

  if (error) {
    throw error;
  }

  return updatedAt;
}

export async function loadRemoteState(key: string): Promise<{ state: AppState; updatedAt: string } | null> {
  if (!supabase) throw new Error("Supabase não está configurado.");

  const { data, error } = await supabase
    .from("dashboard_state")
    .select("state, updated_at")
    .eq("id", key)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw error;
  }

  if (!data) return null;
  return { state: data.state as AppState, updatedAt: data.updated_at };
}
