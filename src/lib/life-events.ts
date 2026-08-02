// Life Timeline data layer. Reads/writes `user_life_events` (owner-only RLS
// already grants the authenticated user access via auth.uid() = user_id) and
// calls the `life-event-context` edge function to stamp astrology context.
// Mirrors the plain-async, {error}-returning style of birth-profile.ts.

import { supabase } from "@/integrations/supabase/client";

export const CATEGORIES = [
  "career",
  "health",
  "marriage",
  "relationships",
  "finance",
  "children",
  "education",
  "travel",
  "property",
  "business",
  "spirituality",
  "family",
  "other",
] as const;
export type LifeEventCategory = (typeof CATEGORIES)[number];

export const PRECISIONS = ["exact", "month", "year", "approx"] as const;
export type DatePrecision = (typeof PRECISIONS)[number];

export const VALENCES = ["positive", "negative", "neutral", "mixed"] as const;
export type Valence = (typeof VALENCES)[number];

export type DashaLordRef = { id: number; name: string };
export type SignRef = { sign_index: number; sign: string };

export type AstroContext = {
  version: 1;
  computed_at: string;
  engine: string;
  time_known: boolean;
  natal_moon: SignRef;
  dasha: {
    maha: DashaLordRef | null;
    antar: DashaLordRef | null;
    pratyantar: DashaLordRef | null;
  };
  transits: { saturn: SignRef; jupiter: SignRef };
  sade_sati: { active: boolean; phase: "rising" | "peak" | "setting" | null };
};

export type LifeEvent = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  category: LifeEventCategory;
  event_date: string;
  date_precision: DatePrecision;
  valence: Valence | null;
  source: string;
  confidence: string | null;
  source_conversation_id: string | null;
  astro_context: AstroContext | Record<string, never>;
  created_at: string;
  updated_at: string;
};

export type LifeEventInput = {
  title: string;
  description?: string | null;
  category: LifeEventCategory;
  event_date: string;
  date_precision: DatePrecision;
  valence?: Valence | null;
};

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function listLifeEvents(): Promise<LifeEvent[]> {
  const userId = await currentUserId();
  if (!userId) return [];
  const { data, error } = await supabase
    .from("user_life_events")
    .select("*")
    .eq("user_id", userId)
    .order("event_date", { ascending: true });
  if (error) {
    console.error("listLifeEvents failed", error);
    return [];
  }
  return (data ?? []) as LifeEvent[];
}

export async function createLifeEvent(
  input: LifeEventInput,
): Promise<{ event: LifeEvent | null; error?: string }> {
  const userId = await currentUserId();
  if (!userId) return { event: null, error: "unauthenticated" };
  const { data, error } = await supabase
    .from("user_life_events")
    .insert({
      user_id: userId,
      title: input.title,
      description: input.description ?? null,
      category: input.category,
      event_date: input.event_date,
      date_precision: input.date_precision,
      valence: input.valence ?? null,
      source: "user",
      astro_context: {},
    })
    .select("*")
    .single();
  if (error) return { event: null, error: error.message };
  return { event: data as LifeEvent };
}

export async function updateLifeEvent(
  id: string,
  patch: Partial<LifeEventInput>,
): Promise<{ event: LifeEvent | null; error?: string }> {
  const { data, error } = await supabase
    .from("user_life_events")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) return { event: null, error: error.message };
  return { event: data as LifeEvent };
}

export async function deleteLifeEvent(id: string): Promise<{ error?: string }> {
  const { error } = await supabase.from("user_life_events").delete().eq("id", id);
  if (error) return { error: error.message };
  return {};
}

export async function stampLifeEvent(id: string, force?: boolean): Promise<{ error?: string }> {
  const { error } = await supabase.functions.invoke("life-event-context", {
    body: { event_id: id, ...(force ? { force: true } : {}) },
  });
  if (error) return { error: error.message };
  return {};
}
