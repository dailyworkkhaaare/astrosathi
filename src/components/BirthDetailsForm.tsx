import { useEffect, useId, useRef, useState, type ReactNode } from "react";
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
  section = "all",
  variant = "stacked",
}: {
  value: BirthDetailsValue;
  onChange: (patch: Partial<BirthDetailsValue>) => void;
  errors: BirthDetailsErrors;
  todayMax: string;
  section?: "all" | "identity" | "birth";
  /** "grouped" draws native inset-grouped rows (onboarding); People keeps "stacked". */
  variant?: "stacked" | "grouped";
}) {
  const { t } = useTranslation();
  const [placeResults, setPlaceResults] = useState<PlaceHit[]>([]);
  const [placeOpen, setPlaceOpen] = useState(false);
  const [placeLoading, setPlaceLoading] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (section === "identity") {
      setPlaceResults([]);
      setPlaceLoading(false);
      return;
    }
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
  }, [section, value.place]);

  const genderOptions: { value: Gender; label: string }[] = [
    { value: "male", label: t("birth.genderMale") },
    { value: "female", label: t("birth.genderFemale") },
  ];

  const selectPlace = (r: PlaceHit) => {
    onChange({
      place: r.label,
      placeCoords: { latitude: r.latitude, longitude: r.longitude, timezone: r.timezone },
    });
    setPlaceOpen(false);
  };

  if (variant === "grouped") {
    return (
      <GroupedBirthFields
        value={value}
        onChange={onChange}
        errors={errors}
        todayMax={todayMax}
        section={section}
        genderOptions={genderOptions}
        place={{
          open: placeOpen,
          setOpen: setPlaceOpen,
          loading: placeLoading,
          results: placeResults,
          select: selectPlace,
        }}
      />
    );
  }

  return (
    <>
      {(section === "all" || section === "identity") && (
        <>
          <Field id="name" label={t("birth.name")} error={errors.name}>
            <input
              id="name"
              type="text"
              autoComplete="name"
              autoCapitalize="words"
              enterKeyHint="next"
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
            <div
              role="radiogroup"
              aria-label={t("birth.gender")}
              className="grid grid-cols-2 gap-2"
            >
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
        </>
      )}

      {(section === "all" || section === "birth") && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field id="dob" label={t("birth.date")} error={errors.dob}>
              <input
                id="dob"
                type="date"
                max={todayMax}
                enterKeyHint="next"
                value={value.dob}
                onChange={(e) => onChange({ dob: e.target.value })}
                className={inputCls}
              />
            </Field>

            <Field id="time" label={t("birth.time")} error={errors.time}>
              <input
                id="time"
                type="time"
                enterKeyHint="next"
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

          <Field
            id="place"
            label={t("birth.place")}
            error={errors.place}
            help={t("birth.placeHelp")}
          >
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
                  enterKeyHint="done"
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
            {value.placeCoords ? (
              <p
                className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"
                aria-live="polite"
              >
                <MapPin size={14} className="shrink-0 text-accent" aria-hidden="true" />
                {t("birth.timezoneResolved", { timezone: value.placeCoords.timezone })}
              </p>
            ) : null}
          </Field>
        </>
      )}
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

type PlaceSearch = {
  open: boolean;
  setOpen: (open: boolean) => void;
  loading: boolean;
  results: PlaceHit[];
  select: (hit: PlaceHit) => void;
};

const groupCls =
  "list-hairline grid grid-cols-[auto_minmax(0,1fr)] overflow-hidden rounded-[0.875rem] bg-card shadow-[var(--as-elevation-1)]";
const groupedInputCls =
  "h-11 bg-transparent text-[1.0625rem] text-foreground placeholder:text-muted-foreground/70 focus:outline-none disabled:cursor-not-allowed disabled:text-muted-foreground -mx-2 w-[calc(100%+1rem)] rounded-md px-2 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";

function GroupedBirthFields({
  value,
  onChange,
  errors,
  todayMax,
  section,
  genderOptions,
  place,
}: {
  value: BirthDetailsValue;
  onChange: (patch: Partial<BirthDetailsValue>) => void;
  errors: BirthDetailsErrors;
  todayMax: string;
  section: "all" | "identity" | "birth";
  genderOptions: { value: Gender; label: string }[];
  place: PlaceSearch;
}) {
  const { t } = useTranslation();
  const genderLabelId = useId();
  const showIdentity = section === "all" || section === "identity";
  const showBirth = section === "all" || section === "birth";
  // Inline list, so it only shows while the field is focused (a saved place
  // re-searches on load and must not push the layout around).
  const [placeFocused, setPlaceFocused] = useState(false);
  const placeExpanded = placeFocused && place.open && (place.loading || place.results.length > 0);

  return (
    <div className="space-y-6">
      {showIdentity && (
        <>
          <div>
            <div className={groupCls}>
              <GroupRow id="name" label={t("birth.name")} invalid={!!errors.name}>
                <input
                  id="name"
                  type="text"
                  autoComplete="name"
                  autoCapitalize="words"
                  enterKeyHint="next"
                  value={value.name}
                  onChange={(e) => onChange({ name: e.target.value })}
                  className={groupedInputCls}
                />
              </GroupRow>
            </div>
            <GroupErrors messages={[errors.name]} />
          </div>

          <div>
            <p
              id={genderLabelId}
              className="px-4 pb-2 text-[0.8125rem] font-semibold text-muted-foreground"
            >
              {t("birth.gender")}
            </p>
            <div
              role="radiogroup"
              aria-labelledby={genderLabelId}
              className="grid grid-cols-2 rounded-[0.625rem] bg-foreground/[0.07] p-0.5"
            >
              {genderOptions.map((opt) => {
                const selected = value.gender === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => onChange({ gender: opt.value })}
                    className={`min-h-11 rounded-[0.5rem] px-4 text-[0.9375rem] font-semibold transition-[background-color,color,box-shadow] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      selected
                        ? "bg-surface-raised text-foreground shadow-[var(--as-elevation-1)]"
                        : "text-muted-foreground hover:text-foreground"
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
              className={`tap-press mt-1 inline-flex min-h-11 items-center gap-1.5 rounded-md px-4 text-[0.875rem] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                value.gender === null ? "font-semibold text-accent" : "text-muted-foreground"
              }`}
            >
              {value.gender === null ? <Check size={14} aria-hidden="true" /> : null}
              {t("birth.genderPreferNotToSay", "Prefer not to say")}
            </button>
            <GroupErrors messages={[errors.gender]} />
          </div>
        </>
      )}

      {showBirth && (
        <>
          <div>
            <div className={groupCls}>
              <GroupRow id="dob" label={t("birth.date")} invalid={!!errors.dob}>
                <input
                  id="dob"
                  type="date"
                  max={todayMax}
                  enterKeyHint="next"
                  value={value.dob}
                  onChange={(e) => onChange({ dob: e.target.value })}
                  className={groupedInputCls}
                />
              </GroupRow>
              <GroupRow id="time" label={t("birth.time")} invalid={!!errors.time}>
                <input
                  id="time"
                  type="time"
                  enterKeyHint="next"
                  value={value.time}
                  onChange={(e) => onChange({ time: e.target.value })}
                  disabled={value.timeUnknown}
                  aria-disabled={value.timeUnknown}
                  className={groupedInputCls}
                />
              </GroupRow>
              <label className="col-span-2 flex min-h-[3.125rem] cursor-pointer items-center gap-3 px-4 py-1.5">
                <span className="min-w-0 flex-1 text-[0.9375rem] leading-snug text-foreground">
                  {t("birth.timeUnknown")}
                </span>
                <span className="relative inline-flex h-[1.9375rem] w-[3.1875rem] shrink-0">
                  <input
                    type="checkbox"
                    checked={value.timeUnknown}
                    onChange={(e) =>
                      onChange({
                        timeUnknown: e.target.checked,
                        ...(e.target.checked ? { time: "" } : {}),
                      })
                    }
                    className="peer absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-full bg-foreground/[0.16] transition-colors duration-[var(--motion-micro)] checked:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card motion-reduce:transition-none"
                  />
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute left-0.5 top-0.5 h-[1.6875rem] w-[1.6875rem] rounded-full bg-white shadow-[var(--as-elevation-1)] transition-transform duration-[var(--motion-micro)] peer-checked:translate-x-5 motion-reduce:transition-none"
                  />
                </span>
              </label>
            </div>
            <GroupErrors messages={[errors.dob, errors.time]} />
            {value.timeUnknown ? (
              <p className="px-4 pt-2 text-xs leading-relaxed text-muted-foreground">
                {t("birth.timeUnknownNote")}
              </p>
            ) : null}
          </div>

          <div>
            <div className={groupCls}>
              <GroupRow id="place" label={t("birth.place")} invalid={!!errors.place}>
                <input
                  id="place"
                  type="text"
                  autoComplete="off"
                  enterKeyHint="done"
                  role="combobox"
                  aria-expanded={placeExpanded}
                  aria-autocomplete="list"
                  value={value.place}
                  onChange={(e) => {
                    onChange({ place: e.target.value, placeCoords: null });
                    place.setOpen(true);
                  }}
                  onFocus={() => {
                    setPlaceFocused(true);
                    if (place.results.length > 0) place.setOpen(true);
                  }}
                  onBlur={() => {
                    setTimeout(() => {
                      setPlaceFocused(false);
                      place.setOpen(false);
                    }, 150);
                  }}
                  className={groupedInputCls}
                  dir="ltr"
                />
              </GroupRow>
            </div>
            {placeExpanded ? (
              <ul
                role="listbox"
                aria-label={t("birth.place")}
                className="list-hairline mt-2 max-h-72 overflow-auto rounded-[0.875rem] bg-popover text-popover-foreground shadow-[var(--as-elevation-2)] [--list-inset:2.75rem]"
              >
                {place.loading && place.results.length === 0 ? (
                  <li className="px-4 py-3 text-sm text-muted-foreground">…</li>
                ) : (
                  place.results.map((r) => (
                    <li
                      key={`${r.latitude},${r.longitude},${r.label}`}
                      role="option"
                      aria-selected={value.place === r.label}
                      className="flex min-h-11 cursor-pointer items-center gap-3 px-4 py-3 text-[0.9375rem] transition-colors hover:bg-foreground/[0.05]"
                      onMouseDown={(ev) => {
                        ev.preventDefault();
                        place.select(r);
                      }}
                    >
                      <MapPin size={16} className="shrink-0 text-accent" aria-hidden="true" />
                      <span className="truncate">{r.label}</span>
                    </li>
                  ))
                )}
              </ul>
            ) : null}
            <GroupErrors messages={[errors.place]} />
            {value.placeCoords ? (
              <p
                className="flex items-center gap-1.5 px-4 pt-2 text-xs text-muted-foreground"
                aria-live="polite"
              >
                <MapPin size={13} className="shrink-0 text-accent" aria-hidden="true" />
                {t("birth.timezoneResolved", { timezone: value.placeCoords.timezone })}
              </p>
            ) : errors.place ? null : (
              <p className="px-4 pt-2 text-xs leading-relaxed text-muted-foreground">
                {t("birth.placeHelp")}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function GroupRow({
  id,
  label,
  invalid,
  children,
}: {
  id: string;
  label: string;
  invalid?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className="col-span-2 grid min-h-[3.125rem] grid-cols-subgrid items-center gap-x-4 px-4 data-[invalid]:bg-destructive/10"
      data-invalid={invalid ? "" : undefined}
    >
      <label htmlFor={id} className="max-w-[10rem] text-[1.0625rem] leading-tight text-foreground">
        {label}
      </label>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function GroupErrors({ messages }: { messages: (string | undefined)[] }) {
  const shown = messages.filter(Boolean);
  if (shown.length === 0) return null;
  return (
    <div className="space-y-1 px-4 pt-2">
      {shown.map((message) => (
        <p key={message} role="alert" className="text-[0.8125rem] text-destructive-strong">
          {message}
        </p>
      ))}
    </div>
  );
}
