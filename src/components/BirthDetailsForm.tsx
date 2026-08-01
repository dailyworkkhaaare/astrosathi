import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Check, MapPin, Search } from "lucide-react";

import type { Gender } from "@/lib/birth-profile";
import { searchPlaces, type PlaceHit } from "@/lib/geocode";

export type PlaceCoords = { latitude: number; longitude: number; timezone: string };

export type BirthDetailsValue = {
  name: string;
  gender: Gender | null | undefined;
  dob: string;
  time: string;
  timeUnknown: boolean;
  place: string;
  placeCoords: PlaceCoords | null;
};

export type BirthDetailsErrors = Partial<
  Record<"name" | "gender" | "dob" | "time" | "place", string>
>;

// Shared birth-details fields (name/gender/dob/time/place) used by onboarding
// and by the People (related charts) forms. Fully controlled: the caller owns
// validation, submission and the `value`/`errors` state; this component only
// renders inputs and the place-search combobox (which owns its own transient
// search-result state internally).
export function BirthDetailsForm({
  value,
  onChange,
  errors,
  todayMax,
}: {
  value: BirthDetailsValue;
  onChange: (patch: Partial<BirthDetailsValue>) => void;
  errors: BirthDetailsErrors;
  todayMax: string;
}) {
  const { t } = useTranslation();
  const [placeResults, setPlaceResults] = useState<PlaceHit[]>([]);
  const [placeOpen, setPlaceOpen] = useState(false);
  const [placeLoading, setPlaceLoading] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = value.place.trim();
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
  }, [value.place]);

  const genderOptions: { value: Gender; label: string }[] = [
    { value: "male", label: t("birth.genderMale") },
    { value: "female", label: t("birth.genderFemale") },
  ];

  return (
    <>
      <Field id="name" label={t("birth.name")} error={errors.name}>
        <input
          id="name"
          type="text"
          autoComplete="name"
          value={value.name}
          onChange={(e) => onChange({ name: e.target.value })}
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
            const selected = value.gender === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onChange({ gender: opt.value })}
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
          onClick={() => onChange({ gender: null })}
          aria-pressed={value.gender === null}
          className={`mt-2 text-xs underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm ${
            value.gender === null ? "text-foreground font-medium" : "text-muted-foreground"
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
            max={todayMax}
            value={value.dob}
            onChange={(e) => onChange({ dob: e.target.value })}
            className={inputCls}
          />
        </Field>

        <Field id="time" label={t("birth.time")} error={errors.time}>
          <input
            id="time"
            type="time"
            value={value.time}
            onChange={(e) => onChange({ time: e.target.value })}
            disabled={value.timeUnknown}
            aria-disabled={value.timeUnknown}
            className={`${inputCls} disabled:cursor-not-allowed disabled:bg-muted/50 disabled:text-muted-foreground`}
          />
        </Field>
      </div>

      <div className="-mt-3">
        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-foreground">
          <div className="relative flex h-5 w-5 shrink-0 items-center justify-center">
            <input
              type="checkbox"
              checked={value.timeUnknown}
              onChange={(e) => {
                onChange({
                  timeUnknown: e.target.checked,
                  ...(e.target.checked ? { time: "" } : {}),
                });
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
              value={value.place}
              onChange={(e) => {
                onChange({ place: e.target.value, placeCoords: null });
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
                    aria-selected={value.place === r.label}
                    className="flex cursor-pointer items-center gap-2.5 px-4 py-3 text-sm min-h-11 hover:bg-muted/80 transition-colors"
                    onMouseDown={(ev) => {
                      ev.preventDefault();
                      onChange({
                        place: r.label,
                        placeCoords: {
                          latitude: r.latitude,
                          longitude: r.longitude,
                          timezone: r.timezone,
                        },
                      });
                      setPlaceOpen(false);
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
    </>
  );
}

export const inputCls =
  "w-full h-12 rounded-xl border border-input bg-background/60 px-3.5 py-3 text-foreground transition-colors placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-accent/60";

export function Field({
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
        <p role="alert" className="mt-1 text-xs text-destructive-strong">
          {error}
        </p>
      ) : help ? (
        <p className="mt-1 text-xs text-muted-foreground">{help}</p>
      ) : null}
    </div>
  );
}
