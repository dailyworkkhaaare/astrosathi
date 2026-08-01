import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";
import { useRequireAuth } from "@/lib/require-auth";
import { OnboardingShell } from "@/components/OnboardingShell";
import { Button } from "@/components/ui/button";
import { BirthDetailsForm, type BirthDetailsValue } from "@/components/BirthDetailsForm";

import { supabase } from "@/integrations/supabase/client";
import { getBirthProfile, saveBirthProfile, type BirthProfile } from "@/lib/birth-profile";
import { useChartGatewayCacheControls } from "@/lib/queries";

export const Route = createFileRoute("/onboarding/birth")({
  head: () => ({
    meta: [
      { title: "Birth details — AstroSaathi" },
      {
        name: "description",
        content:
          "Share your birth details so AstroSaathi can generate your Vedic chart and personalized guidance.",
      },
      { property: "og:title", content: "Birth details — AstroSaathi" },
      {
        property: "og:description",
        content: "Your birth details help build an accurate Vedic chart.",
      },
    ],
  }),
  component: BirthPage,
});

function BirthPage() {
  useRequireAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const cache = useChartGatewayCacheControls();
  // Snapshot of the profile as loaded, so on save we can tell whether anything
  // that actually feeds chart/report generation changed and skip a wasteful
  // regeneration + cache churn on a pure no-op resave.
  const originalRef = useRef<BirthProfile | null>(null);

  const today = useMemo(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }, []);

  // null = "Prefer not to say" (saved as null in DB).
  // undefined = user has not chosen yet.
  const [form, setForm] = useState<BirthDetailsValue>({
    name: "",
    gender: undefined,
    dob: "",
    time: "",
    timeUnknown: false,
    place: "",
    placeCoords: null,
  });
  const updateForm = (patch: Partial<BirthDetailsValue>) =>
    setForm((prev) => ({ ...prev, ...patch }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getBirthProfile().then((existing) => {
      if (cancelled || !existing) return;
      originalRef.current = existing;
      setForm({
        name: existing.name,
        gender: existing.gender,
        dob: existing.dob,
        time: existing.birth_time ?? "",
        timeUnknown: existing.time_unknown,
        place: existing.place_label,
        placeCoords:
          existing.latitude != null && existing.longitude != null
            ? {
                latitude: existing.latitude,
                longitude: existing.longitude,
                timezone: existing.birth_timezone ?? "Asia/Kolkata",
              }
            : null,
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = t("birth.errors.nameRequired");
    if (!form.dob) e.dob = t("birth.errors.dobRequired");
    else if (form.dob > today) e.dob = t("birth.errors.dobFuture");
    if (!form.timeUnknown && !form.time) e.time = t("birth.errors.timeRequired");
    if (!form.place.trim() || !form.placeCoords) e.place = t("birth.errors.placeRequired");
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    const [res] = await Promise.all([
      saveBirthProfile({
        name: form.name.trim(),
        gender: form.gender ?? null,
        dob: form.dob,
        birth_time: form.timeUnknown ? null : form.time,
        time_unknown: form.timeUnknown,
        place_label: form.place.trim(),
        latitude: form.placeCoords?.latitude ?? null,
        longitude: form.placeCoords?.longitude ?? null,
        birth_timezone: form.placeCoords?.timezone ?? null,
      }),
      new Promise((resolve) => setTimeout(resolve, 1000)),
    ]);

    if (res.error) {
      setSubmitting(false);
      setErrors((prev) => ({
        ...prev,
        name: t("birth.errors.saveFailed", "Could not save. Please try again."),
      }));
      return;
    }
    // Only regenerate + disturb the cache when something that actually feeds
    // chart/report generation changed. A pure no-op resave (same details) must
    // do NOTHING here — no prime-charts fan-out, no cache churn — and just move
    // on. This is exactly what was needlessly firing 31 gateway jobs on save.
    const prev = originalRef.current;
    const savedTime = form.timeUnknown ? null : form.time ? form.time.slice(0, 5) : null;
    const prevTime =
      prev && !prev.time_unknown && prev.birth_time ? prev.birth_time.slice(0, 5) : null;
    const birthDataChanged =
      !prev ||
      prev.name !== form.name.trim() ||
      (prev.gender ?? null) !== (form.gender ?? null) ||
      prev.dob !== form.dob ||
      prev.time_unknown !== form.timeUnknown ||
      prevTime !== savedTime ||
      (prev.latitude ?? null) !== (form.placeCoords?.latitude ?? null) ||
      (prev.longitude ?? null) !== (form.placeCoords?.longitude ?? null) ||
      (prev.birth_timezone ?? null) !== (form.placeCoords?.timezone ?? null);

    if (birthDataChanged) {
      // Eagerly pre-generate ALL charts/reports in the background so the whole
      // app and the AI have this person's full picture up front. Changed birth
      // data yields new input-hashes, so chart-gateway regenerates and
      // overwrites both chart_artifacts and chart_facts. Fire-and-forget — it
      // must never block the onboarding flow.
      void supabase.functions.invoke("prime-charts", { body: {} });
      // Soft-invalidate (mark stale) instead of clear() so we don't wipe the
      // persisted cache and unleash a herd of refetches that race the
      // background prime-charts run. Active views refetch fresh data; the rest
      // stays warm until next viewed.
      cache.invalidate();
    }
    navigate({ to: "/home" });
  };

  if (submitting) {
    return (
      <OnboardingShell
        step={2}
        eyebrow={t("birth.title")}
        title={t("birth.castingTitle")}
        subtitle={t("birth.castingSubtitle", { place: form.place.trim(), date: form.dob })}
      >
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-accent/40 bg-accent/10">
            <Sparkles className="h-8 w-8 text-accent animate-pulse" />
          </div>
        </div>
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell
      step={2}
      eyebrow={t("birth.title")}
      title={t("birth.title")}
      subtitle={t("birth.subtitle")}
    >
      <form className="space-y-6" onSubmit={onSubmit} noValidate>
        <BirthDetailsForm value={form} onChange={updateForm} errors={errors} todayMax={today} />

        <Button type="submit" variant="primary" disabled={submitting} className="mt-2 h-12 w-full">
          {submitting ? t("auth.loading") : t("common.continue")}
        </Button>
      </form>
    </OnboardingShell>
  );
}
