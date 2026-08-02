import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowLeft, AudioLines } from "lucide-react";

import { useRequireOnboarding } from "@/lib/require-auth";
import {
  Divider,
  Group,
  SegmentedGroup,
  Toggle,
} from "@/components/settings/primitives";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useVoiceSettings, type SttLang } from "@/lib/voice/useVoice";

export const Route = createFileRoute("/settings/voice")({
  head: () => ({
    meta: [{ title: "Voice — AstroSaathi" }],
  }),
  component: VoiceSettingsPage,
});

const SPEAKER_OPTIONS = ["shubh", "aditya", "ritu", "priya", "neha"] as const;
const PACE_OPTIONS: { value: string; label: string }[] = [
  { value: "0.75", label: "0.75×" },
  { value: "1", label: "1×" },
  { value: "1.25", label: "1.25×" },
  { value: "1.5", label: "1.5×" },
];

function VoiceSettingsPage() {
  useRequireOnboarding();
  const { t } = useTranslation();
  const { settings, update } = useVoiceSettings();

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <div className="motion-fade-up flex items-center gap-2">
        <Link
          to="/settings"
          aria-label={t("settings.memory.back")}
          className="tap-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </Link>
        <h1 className="font-display text-2xl leading-tight tracking-tight text-foreground sm:text-3xl">
          {t("voice.settingsTitle")}
        </h1>
      </div>

      <Group
        title={t("voice.settingsTitle")}
        icon={<AudioLines size={14} aria-hidden="true" />}
        delay={1}
      >
        <div className="flex items-start justify-between gap-3 px-4 py-3 min-h-11">
          <div className="min-w-0">
            <label htmlFor="voice-input-enabled" className="block text-sm font-medium text-foreground">
              {t("voice.inputEnabled")}
            </label>
            <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
              {t("voice.inputEnabledHelp")}
            </p>
          </div>
          <Toggle
            id="voice-input-enabled"
            checked={settings.inputEnabled}
            onChange={(v) => update({ inputEnabled: v })}
          />
        </div>
        <Divider />
        <div className="flex flex-col gap-2 px-4 py-3 min-h-11 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <span className="text-sm font-medium text-foreground">{t("voice.sttLang")}</span>
            <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
              {t("voice.sttLangHelp")}
            </p>
          </div>
          <Select
            value={settings.sttLang}
            onValueChange={(v) => update({ sttLang: v as SttLang })}
          >
            <SelectTrigger className="h-10 w-full text-sm md:w-52" aria-label={t("voice.sttLang")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">{t("voice.sttLangOptions.auto")}</SelectItem>
              <SelectItem value="en">{t("voice.sttLangOptions.en")}</SelectItem>
              <SelectItem value="hi">{t("voice.sttLangOptions.hi")}</SelectItem>
              <SelectItem value="mr">{t("voice.sttLangOptions.mr")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Divider />
        <div className="flex flex-col gap-2 px-4 py-3 min-h-11 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <span className="text-sm font-medium text-foreground">{t("voice.speaker")}</span>
            <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
              {t("voice.speakerHelp")}
            </p>
          </div>
          <Select
            value={settings.speaker}
            onValueChange={(v) => update({ speaker: v })}
          >
            <SelectTrigger className="h-10 w-full text-sm md:w-52" aria-label={t("voice.speaker")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SPEAKER_OPTIONS.map((sp) => (
                <SelectItem key={sp} value={sp}>
                  {t(`voice.speakers.${sp}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Divider />
        <div className="flex flex-col gap-3 px-4 py-3 min-h-11">
          <div className="min-w-0">
            <span className="text-sm font-medium text-foreground">{t("voice.pace")}</span>
            <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
              {t("voice.paceHelp")}
            </p>
          </div>
          <SegmentedGroup<string>
            name="voice-pace"
            value={String(settings.pace)}
            onChange={(v) => update({ pace: Number(v) })}
            options={PACE_OPTIONS}
          />
        </div>
      </Group>

      <p className="motion-fade-up motion-delay-2 px-1 text-xs leading-relaxed text-muted-foreground">
        {t("voice.languageNote")}
      </p>
    </section>
  );
}
