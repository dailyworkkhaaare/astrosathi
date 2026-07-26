import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Check, MapPin, Search, Sparkles } from "lucide-react";
import { useRequireAuth } from "@/lib/require-auth";
import { OnboardingShell } from "@/components/OnboardingShell";
import { Button } from "@/components/ui/button";

import { supabase } from "@/integrations/supabase/client";
import {
  getBirthProfile,
  saveBirthProfile,
  type Gender,
  type BirthProfile,
} from "@/lib/birth-profile";
import { searchPlaces, type PlaceHit } from "@/lib/geocode";
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

  const [name, setName] = useState("");
  // null = "Prefer not to say" (saved as null in DB).
  // undefined = user has not chosen yet.
  const [gender, setGender] = useState<Gender | null | undefined>(undefined);
  const [dob, setDob] = useState("");
  const [time, setTime] = useState("");
  const [timeUnknown, setTimeUnknown] = useState(false);
  const [place, setPlace] = useState("");
  const [placeCoords, setPlaceCoords] = useState<{
    latitude: number;
    longitude: number;
    timezone: string;
  } | null>(null);
  const [placeResults, setPlaceResults] = useState<PlaceHit[]>([]);
  const [placeOpen, setPlaceOpen] = useState(false);
  const [placeLoading, setPlaceLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getBirthProfile().then((existing) => {
      if (cancelled || !existing) return;
      originalRef.current = existing;
      setName(existing.name);
      setGender(existing.gender);
      setDob(existing.dob);
      setTime(existing.birth_time ?? "");
      setTimeUnknown(existing.time_unknown);
      setPlace(existing.place_label);
      if (existing.latitude != null && existing.longitude != null) {
        setPlaceCoords({
          latitude: existing.latitude,
          longitude: existing.longitude,
          timezone: existing.birth_timezone ?? "Asia/Kolkata",
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = place.trim();
    if (q.length < 2) {
      setPlaceResults([]);
      setPlaceLoading(false);
      return;
    }
    setPlaceLoading(true);
    debounceRef.current = setTimeout(async () => {
      const results = await searchPlaces(q);
      setPlaceResults(results);
      setPlaceLoading(false);
      setPlaceOpen(true);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [place]);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = t("birth.errors.nameRequired");
    if (!dob) e.dob = t("birth.errors.dobRequired");
    else if (dob > today) e.dob = t("birth.errors.dobFuture");
    if (!timeUnknown && !time) e.time = t("birth.errors.timeRequired");
    if (!place.trim() || !placeCoords) e.place = t("birth.errors.placeRequired");
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    const [res] = await Promise.all([
      saveBirthProfile({
        name: name.trim(),
        gender: gender ?? null,
        dob,
        birth_time: timeUnknown ? null : time,
        time_unknown: timeUnknown,
        place_label: place.trim(),
        latitude: placeCoords?.latitude ?? null,
        longitude: placeCoords?.longitude ?? null,
        birth_timezone: placeCoords?.timezone ?? null,
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
    const savedTime = timeUnknown ? null : time ? time.slice(0, 5) : null;
    const prevTime =
      prev && !prev.time_unknown && prev.birth_time ? prev.birth_time.slice(0, 5) : null;
    const birthDataChanged =
      !prev ||
      prev.name !== name.trim() ||
      (prev.gender ?? null) !== (gender ?? null) ||
      prev.dob !== dob ||
      prev.time_unknown !== timeUnknown ||
      prevTime !== savedTime ||
      (prev.latitude ?? null) !== (placeCoords?.latitude ?? null) ||
      (prev.longitude ?? null) !== (placeCoords?.longitude ?? null) ||
      (prev.birth_timezone ?? null) !== (placeCoords?.timezone ?? null);

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

  const genderOptions: { value: Gender; label: string }[] = [
    { value: "male", label: t("birth.genderMale") },
    { value: "female", label: t("birth.genderFemale") },
  ];

  if (submitting) {
    return (
      <OnboardingShell
        step={2}
        eyebrow={t("birth.title")}
        title={t("birth.castingTitle")}
        subtitle={t("birth.castingSubtitle", { place: place.trim(), date: dob })}
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
        <Field id="name" label={t("birth.name")} error={errors.name}>
          <input
            id="name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputCls}
          />
        </Field>

        <Field
          id="gender"
          label={t("birth.gender")}
          error={errors.gender}
          help={t("birth.genderHelp", "Used for your Feng Shui Kua directions.")}
        >
          <div role="radiogroup" aria-label={t("birth.gender")} className="grid grid-cols-2 gap-2">
            {genderOptions.map((opt) => {
              const selected = gender === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setGender(opt.value)}
                  className={`tap-press rounded-xl border px-4 py-3 min-h-11 text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    selected
                      ? "border-accent/60 bg-accent/10 text-accent font-semibold"
                      : "border-border bg-card text-foreground hover:bg-card"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setGender(null)}
            aria-pressed={gender === null}
            className={`mt-2 text-xs underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm ${
              gender === null ? "text-foreground font-medium" : "text-muted-foreground"
            }`}
          >
            {t("birth.genderPreferNotToSay", "Prefer not to say")}
          </button>
        </Field>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field id="dob" label={t("birth.date")} error={errors.dob}>
            <input
              id="dob"
              type="date"
              max={today}
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              className={inputCls}
            />
          </Field>

          <Field id="time" label={t("birth.time")} error={errors.time}>
            <input
              id="time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              disabled={timeUnknown}
              aria-disabled={timeUnknown}
              className={`${inputCls} disabled:cursor-not-allowed disabled:bg-muted/50 disabled:text-muted-foreground`}
            />
          </Field>
        </div>

        <div className="-mt-3">
          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-foreground">
            <div className="relative flex h-5 w-5 shrink-0 items-center justify-center">
              <input
                type="checkbox"
                checked={timeUnknown}
                onChange={(e) => {
                  setTimeUnknown(e.target.checked);
                  if (e.target.checked) {
                    setTime("");
                    setErrors((prev) => {
                      const { time: _t, ...rest } = prev;
                      void _t;
                      return rest;
                    });
                  }
                }}
                className="peer h-5 w-5 shrink-0 appearance-none rounded-md border border-input bg-background/60 cursor-pointer transition-colors checked:border-primary checked:bg-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <Check
                size={12}
                className="pointer-events-none absolute hidden text-primary-foreground peer-checked:block"
                aria-hidden="true"
              />
            </div>
            <span>{t("birth.timeUnknown")}</span>
          </label>
        </div>

        <Field id="place" label={t("birth.place")} error={errors.place} help={t("birth.placeHelp")}>
          <div className="relative">
            <div className="relative flex items-center">
              <Search
                size={18}
                className="pointer-events-none absolute left-3.5 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                id="place"
                type="text"
                autoComplete="off"
                role="combobox"
                aria-expanded={placeOpen && placeResults.length > 0}
                aria-autocomplete="list"
                value={place}
                onChange={(e) => {
                  setPlace(e.target.value);
                  setPlaceCoords(null);
                  setPlaceOpen(true);
                }}
                onFocus={() => {
                  if (placeResults.length > 0) setPlaceOpen(true);
                }}
                onBlur={() => {
                  setTimeout(() => setPlaceOpen(false), 150);
                }}
                className={`${inputCls} pl-10`}
                dir="ltr"
              />
            </div>
            {placeOpen && (placeLoading || placeResults.length > 0) ? (
              <ul
                role="listbox"
                className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-border bg-popover text-popover-foreground shadow-lg"
              >
                {placeLoading && placeResults.length === 0 ? (
                  <li className="px-4 py-3 text-sm text-muted-foreground">…</li>
                ) : (
                  placeResults.map((r) => (
                    <li
                      key={`${r.latitude},${r.longitude},${r.label}`}
                      role="option"
                      aria-selected={place === r.label}
                      className="flex cursor-pointer items-center gap-2.5 px-4 py-3 text-sm min-h-11 hover:bg-muted/80 transition-colors"
                      onMouseDown={(ev) => {
                        ev.preventDefault();
                        setPlace(r.label);
                        setPlaceCoords({
                          latitude: r.latitude,
                          longitude: r.longitude,
                          timezone: r.timezone,
                        });
                        setPlaceOpen(false);
                        setErrors((prev) => {
                          const { place: _p, ...rest } = prev;
                          void _p;
                          return rest;
                        });
                      }}
                    >
                      <MapPin
                        size={16}
                        className="shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <span className="truncate">{r.label}</span>
                    </li>
                  ))
                )}
              </ul>
            ) : null}
          </div>
        </Field>

        <Button type="submit" variant="primary" disabled={submitting} className="mt-2 h-12 w-full">
          {submitting ? t("auth.loading") : t("common.continue")}
        </Button>
      </form>
    </OnboardingShell>
  );
}

const inputCls =
  "w-full h-12 rounded-xl border border-input bg-background/60 px-3.5 py-3 text-foreground transition-colors placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-accent/60";

function Field({
  id,
  label,
  error,
  help,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  help?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      <div className="mt-1">{children}</div>
      {error ? (
        <p role="alert" className="mt-1 text-xs text-destructive">
          {error}
        </p>
      ) : help ? (
        <p className="mt-1 text-xs text-muted-foreground">{help}</p>
      ) : null}
    </div>
  );
}
