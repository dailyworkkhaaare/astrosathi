// CRUD for public.related_charts — the "People" feature (saved charts for
// people other than the signed-in user: family, partner, etc). Mirrors the
// shape of birth-profile.ts but keyed by row id, not by user_id, since a
// user can have up to 10 saved people (enforced by a DB trigger; guarded
// client-side too so the add button can disable before the round trip).

import { supabase } from "@/integrations/supabase/client";
import type { Gender } from "@/lib/birth-profile";

export const RELATED_CHARTS_LIMIT = 10;

export type Relation =
  | "wife"
  | "husband"
  | "partner"
  | "father"
  | "mother"
  | "brother"
  | "sister"
  | "son"
  | "daughter"
  | "grandmother"
  | "grandfather"
  | "other";

export const RELATIONS: Relation[] = [
  "wife",
  "husband",
  "partner",
  "father",
  "mother",
  "brother",
  "sister",
  "son",
  "daughter",
  "grandmother",
  "grandfather",
  "other",
];

export type RelatedChart = {
  id: string;
  relation: Relation;
  full_name: string;
  gender: Gender | null;
  birth_date: string;
  birth_time: string | null; // HH:mm or null
  birth_time_known: boolean;
  birth_place_label: string;
  latitude: number | null;
  longitude: number | null;
  birth_timezone: string;
  created_at: string;
};

export type RelatedChartInput = {
  relation: Relation;
  full_name: string;
  gender: Gender | null;
  birth_date: string;
  birth_time: string | null;
  birth_time_known: boolean;
  birth_place_label: string;
  latitude: number | null;
  longitude: number | null;
  birth_timezone: string;
};

const SELECT_COLUMNS =
  "id, relation, full_name, gender, birth_date, birth_time, birth_time_known, birth_place_label, latitude, longitude, birth_timezone, created_at";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromRow(row: any): RelatedChart {
  return {
    id: row.id,
    relation: row.relation,
    full_name: row.full_name ?? "",
    gender: row.gender === "male" || row.gender === "female" ? row.gender : null,
    birth_date: row.birth_date ?? "",
    birth_time: row.birth_time ? String(row.birth_time).slice(0, 5) : null,
    birth_time_known: row.birth_time_known !== false,
    birth_place_label: row.birth_place_label ?? "",
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    birth_timezone: row.birth_timezone ?? "Asia/Kolkata",
    created_at: row.created_at,
  };
}

export async function listRelatedCharts(): Promise<{ data: RelatedChart[]; error?: string }> {
  const { data, error } = await supabase
    .from("related_charts")
    .select(SELECT_COLUMNS)
    .order("created_at", { ascending: true });
  if (error) return { data: [], error: error.message };
  return { data: (data ?? []).map(fromRow) };
}

export async function getRelatedChart(
  id: string,
): Promise<{ data: RelatedChart | null; error?: string }> {
  const { data, error } = await supabase
    .from("related_charts")
    .select(SELECT_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) return { data: null, error: error.message };
  return { data: data ? fromRow(data) : null };
}

// DB error code raised by the 10-per-user trigger (surfaced verbatim so the
// caller can show a friendly limit message instead of a raw Postgres error).
const LIMIT_ERROR_CODE = "related_charts_limit_reached";

export async function createRelatedChart(
  input: RelatedChartInput,
): Promise<{ data: RelatedChart | null; error?: string; limitReached?: boolean }> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return { data: null, error: "unauthenticated" };

  const { data, error } = await supabase
    .from("related_charts")
    .insert({
      user_id: userId,
      relation: input.relation,
      full_name: input.full_name.trim(),
      gender: input.gender,
      birth_date: input.birth_date,
      birth_time: input.birth_time_known ? input.birth_time : null,
      birth_time_known: input.birth_time_known,
      birth_place_label: input.birth_place_label.trim(),
      latitude: input.latitude,
      longitude: input.longitude,
      birth_timezone: input.birth_timezone,
    })
    .select(SELECT_COLUMNS)
    .single();

  if (error) {
    const limitReached = error.message.includes(LIMIT_ERROR_CODE) || error.code === "P0001";
    return { data: null, error: error.message, limitReached };
  }
  return { data: fromRow(data) };
}

export async function updateRelatedChart(
  id: string,
  input: RelatedChartInput,
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from("related_charts")
    .update({
      relation: input.relation,
      full_name: input.full_name.trim(),
      gender: input.gender,
      birth_date: input.birth_date,
      birth_time: input.birth_time_known ? input.birth_time : null,
      birth_time_known: input.birth_time_known,
      birth_place_label: input.birth_place_label.trim(),
      latitude: input.latitude,
      longitude: input.longitude,
      birth_timezone: input.birth_timezone,
    })
    .eq("id", id);
  if (error) return { error: error.message };
  return {};
}

export async function deleteRelatedChart(id: string): Promise<{ error?: string }> {
  const { error } = await supabase.from("related_charts").delete().eq("id", id);
  if (error) return { error: error.message };
  return {};
}

// ---------- person-charts response shape ----------
// Mirrors supabase/functions/person-charts/index.ts's `bundle` envelope.

export type PersonChartsSignInfo = { sign: number; name: string } | null;

export type PersonChartsBasic = {
  ascendant: PersonChartsSignInfo;
  moon:
    | (NonNullable<PersonChartsSignInfo> & {
        nakshatra: { index: number; name: string; pada: number } | null;
      })
    | null;
  sun: PersonChartsSignInfo;
};

export type PersonChartsVarga = {
  svg: string;
  chart_style: string;
  provider: string;
  asc_sign: number;
  positions: Array<{ key: string; sign: number; house: number }>;
};

export type PersonChartsBundle = {
  version: string;
  provider: string;
  provider_version: string;
  related_chart_id: string;
  person: {
    full_name: string;
    relation: Relation;
    gender: Gender | null;
    birth_date: string;
    birth_time: string | null;
    birth_time_known: boolean;
    birth_place_label: string;
    birth_timezone: string;
  };
  basic: PersonChartsBasic;
  // Prokerala-shaped natal payload; feed to mapPlanets() from lib/charts.ts.
  natal: unknown;
  charts: Record<string, PersonChartsVarga>;
};

// ---------- compatibility response shape ----------
// Mirrors supabase/functions/compatibility/index.ts's `bundle` envelope.

export const COMPAT_RELATIONS: Relation[] = ["wife", "husband", "partner"];

export type CompatibilityPerson = {
  name: string;
  gender: Gender | null;
  moon_sign: number;
  moon_sign_name: string;
  moon_nakshatra_index: number;
  moon_nakshatra: string;
  asc_sign: number;
  asc_sign_name: string;
};

export type CompatibilityKuta = {
  name: string;
  got: number;
  max: number;
  boy?: string;
  girl?: string;
  relationship?: string;
};

export type CompatibilityGunaMilan = {
  total: number;
  max: number;
  kutas: CompatibilityKuta[];
  verdict: "excellent" | "very_good" | "good" | "average" | "needs_care";
};

export type CompatibilityMangalPerson = {
  mars_house_from_lagna: number;
  mars_house_from_moon: number;
  manglik_from_lagna: boolean;
  manglik_from_moon: boolean;
  manglik: boolean;
};

export type CompatibilityMangal = {
  self: CompatibilityMangalPerson;
  partner: CompatibilityMangalPerson;
  verdict: "both_manglik_balanced" | "none_manglik" | "one_manglik";
};

export type CompatibilitySynastryOverlay = {
  planet: string;
  sign: number;
  sign_name: string;
  house: number;
};

export type CompatibilitySynastry = {
  partner_planets_in_self_houses: CompatibilitySynastryOverlay[];
  self_planets_in_partner_houses: CompatibilitySynastryOverlay[];
  highlights: string[];
};

export type CompatibilityBundle = {
  version: string;
  provider: string;
  provider_version: string;
  related_chart_id: string;
  assumed_gender: boolean;
  groom_is: "self" | "partner";
  self: CompatibilityPerson;
  partner: CompatibilityPerson & { related_chart_id: string; relation: Relation };
  guna_milan: CompatibilityGunaMilan;
  mangal: CompatibilityMangal;
  synastry: CompatibilitySynastry;
};
