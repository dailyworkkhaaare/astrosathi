// Memory & Privacy settings — CRUD over profiles.memory_* / preferences,
// user_topic_memory, user_emotional_state, and the legacy flat user_memory
// table. All queries are user-scoped and rely on owner RLS; the client only
// ever sees the signed-in user's own rows.

import { supabase } from "@/integrations/supabase/client";

export type Retention = "forever" | "days_30" | "chat" | "never";

export type MemoryTopic =
  | "career"
  | "health"
  | "marriage"
  | "relationships"
  | "finance"
  | "children"
  | "education"
  | "travel"
  | "property"
  | "business"
  | "spirituality"
  | "family"
  | "other";

export const MEMORY_TOPICS: MemoryTopic[] = [
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
];

export type TopicMemory = {
  id: string;
  topic: MemoryTopic;
  summary: string | null;
  data: unknown;
  confidence: number | null;
  retention: Retention;
  expires_at: string | null;
  updated_at: string;
};

export type EmotionalState = {
  state: {
    mood?: string;
    sensitivities?: string[];
    guidance?: string[];
    note?: string;
  } | null;
  expires_at: string | null;
  updated_at: string;
};

export type MemoryProfile = {
  memory_enabled: boolean;
  memory_default_retention: Retention;
  preferences: Record<string, unknown>;
};

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function getMemoryProfile(): Promise<MemoryProfile | null> {
  const userId = await currentUserId();
  if (!userId) return null;
  const { data } = await supabase
    .from("profiles")
    .select("memory_enabled, memory_default_retention, preferences")
    .eq("user_id", userId)
    .maybeSingle();
  return {
    memory_enabled: !!data?.memory_enabled,
    memory_default_retention: (data?.memory_default_retention as Retention | null) ?? "forever",
    preferences: (data?.preferences as Record<string, unknown> | null) ?? {},
  };
}

// Profile rows are created by a signup trigger; RLS on `profiles` only
// grants UPDATE to the owner (no client-side INSERT), so this matches the
// plain .update() pattern used everywhere else in the app (preferences.ts,
// consent.ts, birth-profile.ts) rather than upsert.
export async function updateMemoryProfile(patch: {
  memory_enabled?: boolean;
  memory_default_retention?: Retention;
  preferences?: Record<string, unknown>;
}): Promise<{ error?: string }> {
  const userId = await currentUserId();
  if (!userId) return { error: "unauthenticated" };
  const { error } = await supabase.from("profiles").update(patch).eq("user_id", userId);
  if (error) return { error: error.message };
  return {};
}

export async function resetLearnedPreferences(): Promise<{ error?: string }> {
  return updateMemoryProfile({ preferences: {} });
}

// Lists EVERY topic-memory row for the user, including retention='never' and
// expired rows — the astrologer-chat edge function deliberately hides those
// from the LLM, but this screen is exactly where the user manages them.
export async function listTopicMemories(): Promise<TopicMemory[]> {
  const userId = await currentUserId();
  if (!userId) return [];
  const { data, error } = await supabase
    .from("user_topic_memory")
    .select("id, topic, summary, data, confidence, retention, expires_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error || !data) return [];
  return data as TopicMemory[];
}

export function retentionToPatch(retention: Retention): {
  retention: Retention;
  expires_at: string | null;
} {
  switch (retention) {
    case "forever":
      return { retention, expires_at: null };
    case "days_30":
      return { retention, expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() };
    case "chat":
      return { retention, expires_at: null };
    case "never":
      return { retention, expires_at: new Date().toISOString() };
  }
}

export async function updateTopicMemoryRetention(
  id: string,
  retention: Retention,
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from("user_topic_memory")
    .update(retentionToPatch(retention))
    .eq("id", id);
  if (error) return { error: error.message };
  return {};
}

export async function deleteTopicMemory(id: string): Promise<{ error?: string }> {
  const { error } = await supabase.from("user_topic_memory").delete().eq("id", id);
  if (error) return { error: error.message };
  return {};
}

async function deleteAllTopicMemories(): Promise<{ error?: string }> {
  const userId = await currentUserId();
  if (!userId) return { error: "unauthenticated" };
  const { error } = await supabase.from("user_topic_memory").delete().eq("user_id", userId);
  if (error) return { error: error.message };
  return {};
}

export async function getEmotionalState(): Promise<EmotionalState | null> {
  const userId = await currentUserId();
  if (!userId) return null;
  const { data } = await supabase
    .from("user_emotional_state")
    .select("state, expires_at, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  return data as EmotionalState;
}

export async function clearEmotionalState(): Promise<{ error?: string }> {
  const userId = await currentUserId();
  if (!userId) return { error: "unauthenticated" };
  const { error } = await supabase.from("user_emotional_state").delete().eq("user_id", userId);
  if (error) return { error: error.message };
  return {};
}

// user_memory was originally service-role-only; owner RLS may not be in
// place for every project. Fail soft here — a read/write error just means
// "no legacy facts to show", not a broken screen.
async function getLegacyFacts(): Promise<string | null> {
  const userId = await currentUserId();
  if (!userId) return null;
  const { data, error } = await supabase
    .from("user_memory")
    .select("facts")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return null;
  return data?.facts ?? null;
}

async function clearLegacyFacts(): Promise<{ error?: string }> {
  const userId = await currentUserId();
  if (!userId) return { error: "unauthenticated" };
  const { error } = await supabase.from("user_memory").update({ facts: null }).eq("user_id", userId);
  if (error) return { error: error.message };
  return {};
}

export async function exportMemoryData(): Promise<Record<string, unknown>> {
  const [profile, topics, emotional, facts] = await Promise.all([
    getMemoryProfile(),
    listTopicMemories(),
    getEmotionalState(),
    getLegacyFacts(),
  ]);
  return {
    profile: profile
      ? {
          memory_enabled: profile.memory_enabled,
          preferences: profile.preferences,
          memory_default_retention: profile.memory_default_retention,
        }
      : null,
    topic_memories: topics,
    emotional_state: emotional,
    legacy_facts: facts,
  };
}

// Deletes all topic memories + the emotional state row, and clears legacy
// facts (fails soft if that table isn't RLS-enabled yet). Does NOT touch
// profiles.preferences — see resetLearnedPreferences for that.
export async function deleteAllMemories(): Promise<{ error?: string; legacyFailed?: boolean }> {
  const [topicsRes, emotionalRes] = await Promise.all([deleteAllTopicMemories(), clearEmotionalState()]);
  if (topicsRes.error) return { error: topicsRes.error };
  if (emotionalRes.error) return { error: emotionalRes.error };
  const legacyRes = await clearLegacyFacts();
  return { legacyFailed: !!legacyRes.error };
}
