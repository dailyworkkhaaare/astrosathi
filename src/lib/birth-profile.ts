// Birth profile — backed by Supabase `birth_profiles` (one row per user).
// Onboarding state lives on `profiles.onboarding_state`.

import { supabase } from "@/integrations/supabase/client";

// DB CHECK constraint on birth_profiles.gender only accepts 'male', 'female' or null.
export type Gender = "male" | "female";

export type BirthProfile = {
  name: string;
  gender: Gender | null;
  dob: string; // ISO date YYYY-MM-DD
  birth_time: string | null; // HH:mm or null
  time_unknown: boolean;
  place_label: string;
  latitude: number | null;
  longitude: number | null;
  birth_timezone: string | null;
};

export type OnboardingState = "consent_pending" | "birth_pending" | "ready";

const DEFAULT_TZ = "Asia/Kolkata";

const APP_TO_DB_LOCALE: Record<string, string> = {
  mr: "mr-IN",
  hi: "hi-IN",
  en: "en-IN",
};
const DB_TO_APP_LOCALE: Record<string, string> = {
  "mr-IN": "mr",
  "hi-IN": "hi",
  "en-IN": "en",
};

export function appToDbLocale(l: string | undefined | null): string {
  if (!l) return "mr-IN";
  return APP_TO_DB_LOCALE[l] ?? (l.includes("-") ? l : "mr-IN");
}

export function dbToAppLocale(l: string | undefined | null): string {
  if (!l) return "mr";
  return DB_TO_APP_LOCALE[l] ?? l.split("-")[0] ?? "mr";
}

export async function getBirthProfile(): Promise<BirthProfile | null> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return null;
  const { data } = await supabase
    .from("birth_profiles")
    .select(
      "full_name, gender, birth_date, birth_time, birth_time_known, birth_place_label, latitude, longitude, birth_timezone",
    )
    .eq("user_id", userId)
    .maybeSingle();
  if (!data || !data.full_name) return null;
  return {
    name: data.full_name ?? "",
    gender: data.gender === "male" || data.gender === "female" ? (data.gender as Gender) : null,
    dob: data.birth_date ?? "",
    birth_time: data.birth_time ? String(data.birth_time).slice(0, 5) : null,
    time_unknown: data.birth_time_known === false,
    place_label: data.birth_place_label ?? "",
    latitude: data.latitude ?? null,
    longitude: data.longitude ?? null,
    birth_timezone: data.birth_timezone ?? null,
  };
}

export async function saveBirthProfile(input: BirthProfile): Promise<{ error?: string }> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return { error: "unauthenticated" };

  const { error } = await supabase.from("birth_profiles").upsert(
    {
      user_id: userId,
      full_name: input.name.trim(),
      // DB CHECK: only 'male' | 'female' | null are accepted.
      gender: input.gender === "male" || input.gender === "female" ? input.gender : null,
      birth_date: input.dob,
      birth_time: input.time_unknown ? null : input.birth_time,
      birth_time_known: !input.time_unknown,
      birth_place_label: input.place_label.trim(),
      latitude: input.latitude,
      longitude: input.longitude,
      birth_timezone: input.birth_timezone ?? DEFAULT_TZ,
    },
    { onConflict: "user_id" },
  );
  if (error) return { error: error.message };

  const { error: pErr } = await supabase
    .from("profiles")
    .update({ onboarding_state: "ready", display_name: input.name.trim() })
    .eq("user_id", userId);
  if (pErr) return { error: pErr.message };
  return {};
}

export async function getOnboardingState(): Promise<OnboardingState> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return "consent_pending";
  // The signup trigger populates the profile row asynchronously — retry briefly.
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data } = await supabase
      .from("profiles")
      .select("onboarding_state")
      .eq("user_id", userId)
      .maybeSingle();
    if (data?.onboarding_state) return data.onboarding_state as OnboardingState;
    await new Promise((r) => setTimeout(r, 200));
  }
  return "consent_pending";
}

export function routeForOnboardingState(s: OnboardingState): string {
  switch (s) {
    case "consent_pending":
      return "/onboarding/consent";
    case "birth_pending":
      return "/onboarding/birth";
    case "ready":
    default:
      return "/home";
  }
}
