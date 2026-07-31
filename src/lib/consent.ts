// Consent receipts — writes to Supabase `consent_receipts` and advances
// the user's `birth_profiles.onboarding_state` to `birth`.

import { supabase } from "@/integrations/supabase/client";
import { appToDbLocale } from "@/lib/birth-profile";

export type ConsentInput = {
  ageConfirmed: boolean;
  termsAccepted: boolean;
  privacyAccepted: boolean;
  memoryOptIn: boolean;
  locale: string;
};

const POLICY_VERSION = "2026-01";

export async function saveConsent(input: ConsentInput): Promise<{ error?: string }> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return { error: "unauthenticated" };

  const rows = [
    {
      user_id: userId,
      consent_type: "age_eligibility",
      granted: !!input.ageConfirmed,
      policy_version: POLICY_VERSION,
    },
    {
      user_id: userId,
      consent_type: "terms",
      granted: !!input.termsAccepted,
      policy_version: POLICY_VERSION,
    },
    {
      user_id: userId,
      consent_type: "privacy",
      granted: !!input.privacyAccepted,
      policy_version: POLICY_VERSION,
    },
    {
      user_id: userId,
      consent_type: "long_term_memory",
      granted: !!input.memoryOptIn,
      policy_version: POLICY_VERSION,
    },
  ];

  const { error } = await supabase.from("consent_receipts").insert(rows);
  if (error) return { error: error.message };

  const profilePatch: Record<string, unknown> = {
    onboarding_state: "birth_pending",
    memory_enabled: !!input.memoryOptIn,
  };
  if (input.locale) profilePatch.locale = appToDbLocale(input.locale);

  const { error: upErr } = await supabase
    .from("profiles")
    .upsert({ user_id: userId, ...profilePatch }, { onConflict: "user_id" });
  if (upErr) return { error: upErr.message };

  return {};
}
