// Reflection Journal data layer. Reads/writes `user_reflection_journal`
// (owner-only RLS via auth.uid() = user_id) and calls the `journal-context`
// edge function to stamp astrology context. Mirrors life-events.ts.

import { supabase } from "@/integrations/supabase/client";

export const MOODS = [
  "happy",
  "hopeful",
  "calm",
  "neutral",
  "confused",
  "anxious",
  "sad",
  "angry",
] as const;
export type Mood = (typeof MOODS)[number];

// The four moods that get the amber accent tint. Design.md bans red; the app's
// --color-destructive token is already amber, so these are the "please handle
// with care" moods — not error states.
export const DIFFICULT_MOODS: readonly Mood[] = ["confused", "anxious", "sad", "angry"];

export type SignRef = { sign_index: number; sign: string };
export type DashaLordRef = { id: number; name: string };

export type JournalAstroContext = {
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

export type ContextStatus = "pending" | "stamped" | "error";

export type JournalEntry = {
  id: string;
  user_id: string;
  entry_date: string;
  title: string | null;
  content: string;
  mood: Mood | null;
  tags: string[];
  astro_context: JournalAstroContext | Record<string, never>;
  context_status: ContextStatus;
  created_at: string;
  updated_at: string;
};

export type JournalEntryInput = {
  entry_date: string;
  content: string;
  title?: string | null;
  mood?: Mood | null;
  tags?: string[];
};

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function listEntries(): Promise<JournalEntry[]> {
  const userId = await currentUserId();
  if (!userId) return [];
  const { data, error } = await supabase
    .from("user_reflection_journal")
    .select("*")
    .eq("user_id", userId)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) {
    console.error("listEntries failed", error);
    return [];
  }
  return (data ?? []) as JournalEntry[];
}

export async function createEntry(
  input: JournalEntryInput,
): Promise<{ entry: JournalEntry | null; error?: string }> {
  const userId = await currentUserId();
  if (!userId) return { entry: null, error: "unauthenticated" };
  const content = input.content.trim();
  if (!content) return { entry: null, error: "content_required" };
  const { data, error } = await supabase
    .from("user_reflection_journal")
    .insert({
      user_id: userId,
      entry_date: input.entry_date,
      content,
      title: input.title?.trim() || null,
      mood: input.mood ?? null,
      tags: input.tags ?? [],
    })
    .select("*")
    .single();
  if (error) return { entry: null, error: error.message };
  return { entry: data as JournalEntry };
}

export async function updateEntry(
  id: string,
  patch: Partial<JournalEntryInput>,
): Promise<{ entry: JournalEntry | null; error?: string }> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ("entry_date" in patch && patch.entry_date) payload.entry_date = patch.entry_date;
  if ("content" in patch && patch.content !== undefined) {
    const trimmed = patch.content.trim();
    if (!trimmed) return { entry: null, error: "content_required" };
    payload.content = trimmed;
  }
  if ("title" in patch) payload.title = patch.title?.trim() || null;
  if ("mood" in patch) payload.mood = patch.mood ?? null;
  if ("tags" in patch) payload.tags = patch.tags ?? [];
  const { data, error } = await supabase
    .from("user_reflection_journal")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();
  if (error) return { entry: null, error: error.message };
  return { entry: data as JournalEntry };
}

export async function deleteEntry(id: string): Promise<{ error?: string }> {
  const { error } = await supabase.from("user_reflection_journal").delete().eq("id", id);
  if (error) return { error: error.message };
  return {};
}

export async function stampEntry(id: string, force?: boolean): Promise<{ error?: string }> {
  const { error } = await supabase.functions.invoke("journal-context", {
    body: { entry_id: id, ...(force ? { force: true } : {}) },
  });
  if (error) return { error: error.message };
  return {};
}
