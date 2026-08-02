import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

import { useRequireOnboarding } from "@/lib/require-auth";
import { cn } from "@/lib/utils";
import { Divider, Group, Row, Toggle } from "@/components/settings/primitives";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProactiveSettings, useSaveProactiveSettings } from "@/lib/queries";
import {
  NUDGE_KINDS,
  PROACTIVE_SETTINGS_DEFAULTS,
  type ProactiveSettings,
} from "@/lib/proactive";

export const Route = createFileRoute("/settings/proactive")({
  head: () => ({
    meta: [{ title: "Proactive nudges — AstroSaathi" }],
  }),
  component: ProactiveSettingsPage,
});

// Cap options for max_per_week. All within the DB's 0..21 CHECK.
const FREQUENCY_OPTIONS = [0, 1, 2, 3, 5, 7] as const;
const HOURS = Array.from({ length: 24 }, (_, i) => i);
// A sentinel we translate to null server-side. Radix Select never accepts
// value="" (throws), so we use a literal "off" here and convert on write.
const QUIET_OFF = "off";

function ProactiveSettingsPage() {
  useRequireOnboarding();
  const { t } = useTranslation();
  const settingsQuery = useProactiveSettings();
  const saveMutation = useSaveProactiveSettings();

  // Local optimistic state mirror. TanStack Query is the source of truth on
  // load / after invalidation, but writes flow through here so the UI reacts
  // instantly (matching settings.memory.tsx's onToggle/onChange pattern).
  const [local, setLocal] = useState<ProactiveSettings>(PROACTIVE_SETTINGS_DEFAULTS);

  useEffect(() => {
    if (settingsQuery.data) setLocal(settingsQuery.data);
  }, [settingsQuery.data]);

  const persist = async (patch: Partial<ProactiveSettings>, prev: ProactiveSettings) => {
    const res = await saveMutation.mutateAsync(patch);
    if (res.error) {
      setLocal(prev);
      toast.error(t("settings.proactive.toasts.error"));
    } else {
      toast.success(t("settings.proactive.toasts.saved"));
    }
  };

  const onToggleEnabled = (checked: boolean) => {
    const prev = local;
    setLocal((s) => ({ ...s, enabled: checked }));
    void persist({ enabled: checked }, prev);
  };

  const onChangeFrequency = (value: string) => {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0 || n > 21) return;
    const prev = local;
    setLocal((s) => ({ ...s, max_per_week: n }));
    void persist({ max_per_week: n }, prev);
  };

  const onChangeQuiet = (side: "start" | "end", value: string) => {
    const prev = local;
    if (value === QUIET_OFF) {
      // Clear both, so "either null → off" invariant holds.
      setLocal((s) => ({ ...s, quiet_hours_start: null, quiet_hours_end: null }));
      void persist({ quiet_hours_start: null, quiet_hours_end: null }, prev);
      return;
    }
    const h = Number(value);
    if (!Number.isInteger(h) || h < 0 || h > 23) return;
    if (side === "start") {
      setLocal((s) => ({ ...s, quiet_hours_start: h }));
      void persist({ quiet_hours_start: h }, prev);
    } else {
      setLocal((s) => ({ ...s, quiet_hours_end: h }));
      void persist({ quiet_hours_end: h }, prev);
    }
  };

  const onToggleKind = (kind: string, includeIt: boolean) => {
    const prev = local;
    const nextMuted = includeIt
      ? local.muted_kinds.filter((k) => k !== kind)
      : Array.from(new Set([...local.muted_kinds, kind]));
    setLocal((s) => ({ ...s, muted_kinds: nextMuted }));
    void persist({ muted_kinds: nextMuted }, prev);
  };

  const disabled = !local.enabled;

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <div className="motion-fade-up flex items-center gap-2">
        <Link
          to="/settings"
          aria-label={t("settings.proactive.back")}
          className="tap-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </Link>
        <h1 className="font-display text-2xl leading-tight tracking-tight text-foreground sm:text-3xl">
          {t("settings.proactive.title")}
        </h1>
      </div>

      {/* Master toggle */}
      <Group title={t("settings.proactive.enabled")} delay={1}>
        <div className="flex items-start justify-between gap-3 px-4 py-3 min-h-11">
          <div className="min-w-0">
            <label htmlFor="proactive-enabled" className="block text-sm font-medium text-foreground">
              {t("settings.proactive.enabled")}
            </label>
            <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
              {t("settings.proactive.enabledHint")}
            </p>
          </div>
          <Toggle
            id="proactive-enabled"
            checked={local.enabled}
            onChange={onToggleEnabled}
          />
        </div>
      </Group>

      <div className={cn("space-y-6 transition-opacity", disabled && "pointer-events-none opacity-50")}>
        {/* Frequency cap */}
        <Group title={t("settings.proactive.frequency")} delay={2}>
          <div className="flex flex-col gap-3 px-4 py-3 min-h-11">
            <p className="text-xs leading-snug text-muted-foreground">
              {t("settings.proactive.frequencyHint")}
            </p>
            <Select value={String(local.max_per_week)} onValueChange={onChangeFrequency}>
              <SelectTrigger
                className="h-11 w-full text-sm sm:w-56"
                aria-label={t("settings.proactive.frequency")}
                disabled={disabled}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FREQUENCY_OPTIONS.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n === 0
                      ? t("settings.proactive.frequencyOff")
                      : t("settings.proactive.frequencyPerWeek", { n })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Group>

        {/* Quiet hours */}
        <Group title={t("settings.proactive.quietHours")} delay={3}>
          <div className="flex flex-col gap-3 px-4 py-3 min-h-11">
            <p className="text-xs leading-snug text-muted-foreground">
              {t("settings.proactive.quietHint")}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <QuietHourSelect
                label={t("settings.proactive.quietStart")}
                value={local.quiet_hours_start}
                disabled={disabled}
                onChange={(v) => onChangeQuiet("start", v)}
              />
              <QuietHourSelect
                label={t("settings.proactive.quietEnd")}
                value={local.quiet_hours_end}
                disabled={disabled}
                onChange={(v) => onChangeQuiet("end", v)}
              />
            </div>
          </div>
        </Group>

        {/* Muted kinds */}
        <Group title={t("settings.proactive.mutedKinds")} delay={4}>
          {NUDGE_KINDS.map((kind, i) => {
            const included = !local.muted_kinds.includes(kind);
            return (
              <div key={kind}>
                <Row label={t(`settings.proactive.kinds.${kind}`)}>
                  <Toggle
                    id={`proactive-kind-${kind}`}
                    checked={included}
                    onChange={(v) => onToggleKind(kind, v)}
                  />
                </Row>
                {i < NUDGE_KINDS.length - 1 && <Divider />}
              </div>
            );
          })}
          <div className="px-4 pb-3 pt-1">
            <p className="text-[11px] text-muted-foreground">
              {t("settings.proactive.mutedKindsHint")}
            </p>
          </div>
        </Group>
      </div>
    </section>
  );
}

function QuietHourSelect({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: number | null;
  disabled: boolean;
  onChange: (v: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      <Select value={value == null ? QUIET_OFF : String(value)} onValueChange={onChange}>
        <SelectTrigger className="h-11 w-full text-sm" aria-label={label} disabled={disabled}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={QUIET_OFF}>{t("settings.proactive.quietOff")}</SelectItem>
          {HOURS.map((h) => (
            <SelectItem key={h} value={String(h)}>
              {t("settings.proactive.quietFormat", { h: String(h).padStart(2, "0") })}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
