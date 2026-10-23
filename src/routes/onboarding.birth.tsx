import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { ShieldCheck, Sparkles } from "lucide-react";
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
  const [stage, setStage] = useState<"identity" | "birth">("identity");

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

  const validate = (scope: "identity" | "all" = "all"): boolean => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = t("birth.errors.nameRequired");
    if (scope === "identity") {
      setErrors(e);
      return Object.keys(e).length === 0;
    }
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

  const continueToBirthDetails = () => {
    if (validate("identity")) {
      setStage("birth");
    }
  };

  if (submitting) {
    return (
      <main className={MAIN_CLASS}>
        <OnboardingShell
          step={5}
          showBack={false}
          eyebrow={t("birth.title")}
          title={t("birth.castingTitle")}
          subtitle={t("birth.castingSubtitle", { place: form.place.trim(), date: form.dob })}
        >
          <CastingCeremony />
        </OnboardingShell>
      </main>
    );
  }

  const identity = stage === "identity";

  return (
    <main className={MAIN_CLASS}>
      <OnboardingShell
        step={identity ? 4 : 5}
        eyebrow={identity ? t("birth.stageIdentity") : t("birth.stageBirth")}
        title={t("birth.title")}
        // From identity, back leaves the page (consent, or Settings when editing).
        onBack={identity ? undefined : () => setStage("identity")}
        subtitle={identity ? t("birth.identitySubtitle") : t("birth.subtitle")}
        footer={
          identity ? (
            <Button
              type="submit"
              form="birth-identity-form"
              variant="primary"
              className="min-h-[3.375rem] w-full rounded-full text-[1.0625rem] font-semibold"
            >
              {t("birth.continueToBirth")}
            </Button>
          ) : (
            <Button
              type="submit"
              form="birth-form"
              variant="primary"
              disabled={submitting}
              className="min-h-[3.375rem] w-full rounded-full border border-[var(--as-color-solar-saffron-600)] bg-[var(--as-color-action-warm)] px-6 text-[1.0625rem] font-semibold text-[var(--as-color-action-warm-text)] shadow-[var(--as-elevation-glow)] hover:brightness-100 hover:saturate-[1.08]"
            >
              <Sparkles size={18} aria-hidden="true" />
              {submitting ? t("auth.loading") : t("birth.calculateChart")}
            </Button>
          )
        }
      >
        {identity ? (
          <form
            id="birth-identity-form"
            onSubmit={(ev) => {
              ev.preventDefault();
              continueToBirthDetails();
            }}
            noValidate
          >
            <BirthDetailsForm
              value={form}
              onChange={updateForm}
              errors={errors}
              todayMax={today}
              section="identity"
              variant="grouped"
            />
            <p className="px-4 pt-4 text-xs leading-relaxed text-muted-foreground">
              {t("birth.identityWhy")}
            </p>
          </form>
        ) : (
          <form id="birth-form" onSubmit={onSubmit} noValidate>
            <BirthDetailsForm
              value={form}
              onChange={updateForm}
              errors={errors}
              todayMax={today}
              section="birth"
              variant="grouped"
            />
            {errors.name ? (
              <p role="alert" className="px-4 pt-3 text-[0.8125rem] text-destructive-strong">
                {errors.name}
              </p>
            ) : null}
            <p className="mt-6 flex gap-2 px-4 text-xs leading-relaxed text-muted-foreground">
              <ShieldCheck size={15} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
              {t("birth.privacyNote")}
            </p>
          </form>
        )}
      </OnboardingShell>
    </main>
  );
}

const MAIN_CLASS =
  "min-h-dvh w-full bg-background px-4 pt-[calc(var(--as-safe-top)+0.75rem)] text-foreground sm:px-6 md:pt-12";

function CastingCeremony() {
  const { t } = useTranslation();

  return (
    <div
      className="motion-ceremonial flex min-h-[52dvh] flex-col items-center justify-center py-10 text-center"
      role="status"
      aria-live="polite"
    >
      <div className="relative grid h-60 w-60 place-items-center text-accent" aria-hidden="true">
        <div className="absolute inset-5 rounded-full border border-accent/15 bg-accent/[0.04] shadow-[var(--as-elevation-glow)]" />
        <svg viewBox="0 0 240 240" className="absolute inset-0 h-full w-full overflow-visible">
          <circle className="as-casting-ring as-casting-ring--outer" cx="120" cy="120" r="104" />
          <circle className="as-casting-ring as-casting-ring--middle" cx="120" cy="120" r="72" />
          <path
            className="as-casting-orbit"
            d="M34 120C66 80 174 80 206 120C174 160 66 160 34 120Z"
          />
          <path
            className="as-casting-orbit as-casting-orbit--tilted"
            d="M34 120C66 80 174 80 206 120C174 160 66 160 34 120Z"
          />
          <circle className="as-casting-star" cx="120" cy="16" r="3" />
          <circle className="as-casting-star as-casting-star--late" cx="206" cy="120" r="3" />
          <circle className="as-casting-star as-casting-star--last" cx="120" cy="224" r="3" />
        </svg>
        <div className="relative grid h-16 w-16 place-items-center rounded-full border border-accent/40 bg-accent/10">
          <Sparkles className="h-7 w-7" />
        </div>
      </div>
      <p className="mt-6 max-w-xs text-sm leading-relaxed text-muted-foreground">
        {t("birth.castingDetail")}
      </p>
      <div className="mt-5 flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
        {t("birth.castingStatus")}
      </div>
    </div>
  );
}
