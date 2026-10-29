import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { CalendarClock, Moon, Orbit, Sparkles, type LucideIcon } from "lucide-react";

import { useRequireOnboarding } from "@/lib/require-auth";
import { cn } from "@/lib/utils";
import {
  Group,
  IconTile,
  SettingsBackHeader,
  Toggle,
  VALUE_TRIGGER,
} from "@/components/settings/primitives";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProactiveSettings, useSaveProactiveSettings } from "@/lib/queries";
import { NUDGE_KINDS, PROACTIVE_SETTINGS_DEFAULTS, type ProactiveSettings } from "@/lib/proactive";
import {
  getDeviceNotificationPermission,
  requestDeviceNotificationPermission,
  triggerHaptic,
  type DeviceNotificationPermission,
} from "@/lib/native-device";

export const Route = createFileRoute("/settings/proactive")({
  head: () => ({
    meta: [{ title: "Guidance settings — AstroSaathi" }],
  }),
  component: ProactiveSettingsPage,
});

// Cap options for max_per_week. All within the DB's 0..21 CHECK.
const FREQUENCY_OPTIONS = [0, 1, 2, 3, 5, 7] as const;
const HOURS = Array.from({ length: 24 }, (_, i) => i);
// A sentinel we translate to null server-side. Radix Select never accepts
// value="" (throws), so we use a literal "off" here and convert on write.
const QUIET_OFF = "off";

// Same icon vocabulary the /nudges feed uses per kind, so the same idea
// reads consistently in both places.
const KIND_ICON: Record<string, LucideIcon> = {
  dasha_change: Orbit,
  sade_sati_phase: Moon,
  transit_alert: Sparkles,
  life_event_followup: CalendarClock,
};

function ProactiveSettingsPage() {
  useRequireOnboarding();
  const { t } = useTranslation();
  const settingsQuery = useProactiveSettings();
  const saveMutation = useSaveProactiveSettings();

  // Local optimistic state mirror. TanStack Query is the source of truth on
  // load / after invalidation, but writes flow through here so the UI reacts
  // instantly (matching settings.memory.tsx's onToggle/onChange pattern).
  const [local, setLocal] = useState<ProactiveSettings>(PROACTIVE_SETTINGS_DEFAULTS);
  const [notificationPermission, setNotificationPermission] =
    useState<DeviceNotificationPermission>("unavailable");
  const [requestingNotificationPermission, setRequestingNotificationPermission] = useState(false);

  useEffect(() => {
    if (settingsQuery.data) setLocal(settingsQuery.data);
  }, [settingsQuery.data]);

  useEffect(() => {
    let active = true;
    void getDeviceNotificationPermission().then((permission) => {
      if (active) setNotificationPermission(permission);
    });
    return () => {
      active = false;
    };
  }, []);

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

  const onEnableDeviceAlerts = async () => {
    setRequestingNotificationPermission(true);
    const permission = await requestDeviceNotificationPermission();
    setNotificationPermission(permission);
    setRequestingNotificationPermission(false);
    if (permission === "granted") {
      void triggerHaptic("success");
      toast.success(t("settings.proactive.toasts.alertsEnabled"));
    } else if (permission === "denied") {
      void triggerHaptic("warning");
      toast.message(t("settings.proactive.toasts.alertsBlocked"));
    }
  };

  const disabled = !local.enabled;
  const quietHoursActive = local.quiet_hours_start != null && local.quiet_hours_end != null;
  const formatHour = (hour: number) =>
    t("settings.proactive.quietFormat", { h: String(hour).padStart(2, "0") });
  const mutedKindCount = NUDGE_KINDS.filter((kind) => local.muted_kinds.includes(kind)).length;

  return (
    <section className="mx-auto max-w-2xl space-y-7">
      <SettingsBackHeader
        title={t("settings.proactive.title")}
        backLabel={t("settings.memory.back")}
        subtitle={t("settings.proactive.enabledHint")}
      />

      <div className="space-y-2">
        <Group footer={t("settings.proactive.enabledDetail")} delay={1}>
          <div className="flex min-h-11 items-center justify-between gap-3 py-1.5 pl-4 pr-2">
            <label
              htmlFor="proactive-enabled"
              className="min-w-0 text-[1.0625rem] leading-snug text-foreground"
            >
              {t("settings.proactive.enabled")}
            </label>
            <Toggle
              id="proactive-enabled"
              ariaLabel={t("settings.proactive.enabled")}
              checked={local.enabled}
              onChange={onToggleEnabled}
            />
          </div>
        </Group>
        {saveMutation.isPending && (
          <p
            role="status"
            aria-live="polite"
            className="px-4 text-[0.8125rem] text-muted-foreground"
          >
            {t("settings.proactive.saving")}
          </p>
        )}
      </div>

      {disabled && (
        <p className="-mt-3 px-4 text-[0.8125rem] leading-snug text-muted-foreground">
          {t("settings.proactive.controlsPaused")}
        </p>
      )}

      <div
        aria-disabled={disabled || undefined}
        className={cn(
          "space-y-7 transition-opacity motion-reduce:transition-none",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        <Group
          title={t("settings.proactive.deviceAlerts")}
          footer={t(`settings.proactive.deviceAlertHint.${notificationPermission}`)}
          delay={2}
        >
          <div className="flex min-h-11 items-center justify-between gap-3 py-1.5 pl-4 pr-2">
            <span className="min-w-0 text-[1.0625rem] leading-snug text-foreground">
              {t(`settings.proactive.deviceAlertStatus.${notificationPermission}`)}
            </span>
            {notificationPermission === "prompt" ? (
              <button
                type="button"
                disabled={requestingNotificationPermission}
                onClick={() => void onEnableDeviceAlerts()}
                className="tap-press inline-flex min-h-11 shrink-0 items-center rounded-full px-3 text-[0.9375rem] font-semibold text-accent transition-colors hover:bg-accent/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              >
                {requestingNotificationPermission
                  ? t("settings.proactive.deviceAlertsRequesting")
                  : t("settings.proactive.deviceAlertsEnable")}
              </button>
            ) : null}
          </div>
        </Group>

        <Group
          title={t("settings.proactive.frequency")}
          footer={
            local.max_per_week === 0
              ? t("settings.proactive.frequencyStatusOff")
              : t("settings.proactive.frequencyStatus", { n: local.max_per_week })
          }
          delay={2}
        >
          <div className="flex min-h-11 items-center justify-between gap-3 pl-4 pr-3">
            <span className="shrink-0 text-[1.0625rem] text-foreground">
              {t("settings.proactive.frequencyLabel")}
            </span>
            <Select value={String(local.max_per_week)} onValueChange={onChangeFrequency}>
              <SelectTrigger
                className={VALUE_TRIGGER}
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

        <Group
          title={t("settings.proactive.quietHours")}
          footer={
            quietHoursActive
              ? t("settings.proactive.quietStatusActive", {
                  start: formatHour(local.quiet_hours_start!),
                  end: formatHour(local.quiet_hours_end!),
                })
              : t("settings.proactive.quietHint")
          }
          delay={3}
        >
          <div className="list-hairline">
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
        </Group>

        <Group
          title={t("settings.proactive.mutedKinds")}
          footer={
            mutedKindCount === 0
              ? t("settings.proactive.mutedKindsHint")
              : t("settings.proactive.mutedKindsStatusMuted", { n: mutedKindCount })
          }
          delay={4}
        >
          <div className="list-hairline [--list-inset:3.75rem]">
            {NUDGE_KINDS.map((kind) => {
              const included = !local.muted_kinds.includes(kind);
              const Icon = KIND_ICON[kind];
              return (
                <div key={kind} className="flex min-h-11 items-center gap-3 py-1.5 pl-4 pr-2">
                  <IconTile>
                    <Icon size={17} />
                  </IconTile>
                  <label
                    htmlFor={`proactive-kind-${kind}`}
                    className="min-w-0 flex-1 text-[1.0625rem] leading-snug text-foreground"
                  >
                    {t(`settings.proactive.kinds.${kind}`)}
                  </label>
                  <Toggle
                    id={`proactive-kind-${kind}`}
                    ariaLabel={t(`settings.proactive.kinds.${kind}`)}
                    checked={included}
                    onChange={(v) => onToggleKind(kind, v)}
                  />
                </div>
              );
            })}
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
    <div className="flex min-h-11 items-center justify-between gap-3 pl-4 pr-3">
      <span className="shrink-0 text-[1.0625rem] text-foreground">{label}</span>
      <Select value={value == null ? QUIET_OFF : String(value)} onValueChange={onChange}>
        <SelectTrigger className={VALUE_TRIGGER} aria-label={label} disabled={disabled}>
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
