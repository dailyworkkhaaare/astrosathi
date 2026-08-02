// Proactive nudges data layer.
// - user_proactive_nudges: owner RLS grants SELECT / UPDATE / DELETE only;
//   INSERT is done server-side by a background job. The client only ever
//   transitions a row from sent → acted or sent → dismissed. Both writes are
//   guarded with .eq("status","sent") so a double-tap can never clobber
//   another action.
// - user_proactive_settings: PK user_id; owner RLS grants INSERT too, so
//   upsert on user_id is correct (unlike profiles).

import { supabase } from "@/integrations/supabase/client";

// Kinds the current generator actually emits, in the order the settings
// screen renders their mute toggles. The other CHECK values on the column
// aren't produced yet and don't need a UI row here.
export const NUDGE_KINDS = [
  "dasha_change",
  "sade_sati_phase",
  "transit_alert",
  "life_event_followup",
] as const;
export type NudgeKind = (typeof NUDGE_KINDS)[number];

export type NudgePriority = "low" | "normal" | "high";
export type NudgeStatus = "pending" | "sent" | "dismissed" | "acted" | "suppressed" | "expired";

export type ProactiveNudge = {
  id: string;
  kind: string;
  topic: string | null;
  title: string;
  body: string;
  priority: NudgePriority;
  status: NudgeStatus;
  scheduled_for: string | null;
  sent_at: string | null;
  expires_at: string | null;
  created_at: string;
};

export type ProactiveSettings = {
  enabled: boolean;
  max_per_week: number;
  quiet_hours_start: number | null;
  quiet_hours_end: number | null;
  muted_kinds: string[];
};

export const PROACTIVE_SETTINGS_DEFAULTS: ProactiveSettings = {
  enabled: true,
  max_per_week: 3,
  quiet_hours_start: null,
  quiet_hours_end: null,
  muted_kinds: [],
};

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

const PRIORITY_RANK: Record<NudgePriority, number> = { high: 0, normal: 1, low: 2 };

// Lists only rows the background job has "released" (status='sent') and that
// haven't expired. Sorted priority-first (high → low), tie-break newest
// scheduled_for.
export async function listSentNudges(): Promise<ProactiveNudge[]> {
  const userId = await currentUserId();
  if (!userId) return [];
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("user_proactive_nudges")
    .select(
      "id, kind, topic, title, body, priority, status, scheduled_for, sent_at, expires_at, created_at",
    )
    .eq("user_id", userId)
    .eq("status", "sent")
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .order("scheduled_for", { ascending: false });
  if (error || !data) return [];
  const rows = data as ProactiveNudge[];
  return [...rows].sort((a, b) => {
    const pr = (PRIORITY_RANK[a.priority] ?? 3) - (PRIORITY_RANK[b.priority] ?? 3);
    if (pr !== 0) return pr;
    const at = a.scheduled_for ? Date.parse(a.scheduled_for) : 0;
    const bt = b.scheduled_for ? Date.parse(b.scheduled_for) : 0;
    return bt - at;
  });
}

export async function actOnNudge(id: string): Promise<{ error?: string }> {
  const { error } = await supabase
    .from("user_proactive_nudges")
    .update({ status: "acted", responded_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "sent");
  if (error) return { error: error.message };
  return {};
}

export async function dismissNudge(id: string): Promise<{ error?: string }> {
  const { error } = await supabase
    .from("user_proactive_nudges")
    .update({ status: "dismissed", responded_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "sent");
  if (error) return { error: error.message };
  return {};
}

export async function getProactiveSettings(): Promise<ProactiveSettings> {
  const userId = await currentUserId();
  if (!userId) return PROACTIVE_SETTINGS_DEFAULTS;
  const { data } = await supabase
    .from("user_proactive_settings")
    .select("enabled, max_per_week, quiet_hours_start, quiet_hours_end, muted_kinds")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return PROACTIVE_SETTINGS_DEFAULTS;
  return {
    enabled: data.enabled ?? PROACTIVE_SETTINGS_DEFAULTS.enabled,
    max_per_week: data.max_per_week ?? PROACTIVE_SETTINGS_DEFAULTS.max_per_week,
    quiet_hours_start: data.quiet_hours_start ?? null,
    quiet_hours_end: data.quiet_hours_end ?? null,
    muted_kinds: Array.isArray(data.muted_kinds) ? (data.muted_kinds as string[]) : [],
  };
}

export async function saveProactiveSettings(
  patch: Partial<ProactiveSettings>,
): Promise<{ error?: string }> {
  const userId = await currentUserId();
  if (!userId) return { error: "unauthenticated" };
  const { error } = await supabase.from("user_proactive_settings").upsert(
    {
      user_id: userId,
      ...patch,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) return { error: error.message };
  return {};
}
