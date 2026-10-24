import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { ShieldCheck, Sparkles } from "lucide-react";
import { useRequireAuth } from "@/lib/require-auth";
import { AstroArt } from "@/components/AstroArt";
import { OnboardingShell } from "@/components/OnboardingShell";
import { Button } from "@/components/ui/button";
import { BirthDetailsForm, type BirthDetailsValue } from "@/components/BirthDetailsForm";

import { supabase } from "@/integrations/supabase/client";
import { GRAHA_ART } from "@/lib/astro-art";
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
  const { t, i18n } = useTranslation();
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
      <CastingCeremony
        title={t("birth.castingTitle")}
        subtitle={t("birth.castingSubtitle", {
          place: form.place.trim(),
          date: formatBirthDate(form.dob, i18n.language),
        })}
      />
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

// Twelve house ticks between the inner (r96) and outer (r130) rings.
const HOUSE_TICKS = Array.from({ length: 12 }, (_, i) => {
  const a = (i * Math.PI) / 6;
  const point = (r: number) =>
    `${(140 + r * Math.cos(a)).toFixed(1)} ${(140 + r * Math.sin(a)).toFixed(1)}`;
  return `M${point(104)} L${point(122)}`;
});

// Grahas sit on the outer ring, 40° apart, starting at the top.
const GRAHA_SIZE = 40;
const GRAHA_SLOTS = GRAHA_ART.map((name, i) => {
  const a = (i * 2 * Math.PI) / GRAHA_ART.length;
  return {
    name,
    left: 140 + 130 * Math.sin(a) - GRAHA_SIZE / 2,
    top: 140 - 130 * Math.cos(a) - GRAHA_SIZE / 2,
    delay: 500 + i * 160,
  };
});

function formatBirthDate(dob: string, locale: string) {
  try {
    return new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${dob}T00:00:00Z`));
  } catch {
    return dob;
  }
}

function CastingCeremony({ title, subtitle }: { title: string; subtitle: string }) {
  const { t } = useTranslation();

  return (
    <main
      className="motion-ceremonial relative flex min-h-dvh w-full flex-col items-center justify-center gap-9 overflow-hidden bg-background px-8 pb-[calc(var(--as-safe-bottom)+2rem)] pt-[calc(var(--as-safe-top)+2rem)] text-center text-foreground"
      role="status"
      aria-live="polite"
    >
      <div
        className="pointer-events-none absolute left-1/2 top-[calc(50%-4.5rem)] h-[26rem] w-[26rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--accent)_16%,transparent)_0%,transparent_62%)]"
        aria-hidden="true"
      />
      <div className="relative h-[280px] w-[280px] text-accent" aria-hidden="true">
        <svg viewBox="0 0 280 280" className="absolute inset-0 h-full w-full overflow-visible">
          <circle className="as-casting-ring as-casting-ring--outer" cx="140" cy="140" r="130" />
          <circle className="as-casting-ring as-casting-ring--middle" cx="140" cy="140" r="96" />
          <g stroke="currentColor" strokeOpacity="0.35" strokeWidth="1">
            {HOUSE_TICKS.map((d) => (
              <path key={d} d={d} />
            ))}
          </g>
          <path
            className="as-casting-line"
            d="M90 170 L118 112 L150 138 L186 96 M150 138 L164 190"
          />
          <g fill="currentColor">
            <circle cx="90" cy="170" r="3.5" />
            <circle cx="118" cy="112" r="4.5" className="text-foreground" fill="currentColor" />
            <circle cx="150" cy="138" r="3" />
            <circle cx="186" cy="96" r="4" />
            <circle cx="164" cy="190" r="3" />
          </g>
        </svg>
        <div className="as-graha-ring absolute inset-0">
          {GRAHA_SLOTS.map((slot) => (
            <span
              key={slot.name}
              className="absolute"
              style={
                {
                  left: slot.left,
                  top: slot.top,
                  width: GRAHA_SIZE,
                  height: GRAHA_SIZE,
                  "--as-graha-delay": `${slot.delay}ms`,
                } as CSSProperties
              }
            >
              <AstroArt
                kind="graha"
                name={slot.name}
                size={GRAHA_SIZE}
                priority
                className="as-graha-pop block"
              />
            </span>
          ))}
        </div>
      </div>

      <div className="relative flex max-w-sm flex-col items-center gap-2.5">
        <h1 className="large-title text-foreground">{title}</h1>
        <p className="text-[0.9375rem] leading-snug text-muted-foreground">{subtitle}</p>
      </div>

      <p className="relative flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <span
          className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent motion-reduce:animate-none"
          aria-hidden="true"
        />
        {t("birth.castingStatus")}
      </p>
    </main>
  );
}
