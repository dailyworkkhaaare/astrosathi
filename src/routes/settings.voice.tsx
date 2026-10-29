import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Square, Volume2 } from "lucide-react";

import { useRequireOnboarding } from "@/lib/require-auth";
import {
  Group,
  Row,
  SegmentedGroup,
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
import { langToBCP47, useReadAloud, useVoiceSettings, type SttLang } from "@/lib/voice/useVoice";

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
const PREVIEW_ID = "voice-settings-preview";

function VoiceSettingsPage() {
  useRequireOnboarding();
  const { t, i18n } = useTranslation();
  const { settings, update } = useVoiceSettings();
  const [previewError, setPreviewError] = useState<string | null>(null);
  const readAloud = useReadAloud({
    onError: () => setPreviewError(t("voice.previewError")),
  });
  const previewLoading = readAloud.loadingId === PREVIEW_ID;
  const previewPlaying = readAloud.playingId === PREVIEW_ID;

  const previewVoice = () => {
    setPreviewError(null);
    void readAloud.play(
      PREVIEW_ID,
      t("voice.previewText"),
      langToBCP47(i18n.language, settings.sttLang),
      { speaker: settings.speaker, pace: settings.pace },
    );
  };

  return (
    <section className="mx-auto max-w-2xl space-y-7">
      <SettingsBackHeader
        title={t("voice.settingsTitle")}
        backLabel={t("settings.memory.back")}
        subtitle={t("voice.settingsHint")}
      />

      <Group title={t("voice.groupInput")} footer={t("voice.inputEnabledHelp")} delay={1}>
        <div className="list-hairline">
          <div className="flex min-h-11 items-center justify-between gap-3 py-1.5 pl-4 pr-2">
            <label
              htmlFor="voice-input-enabled"
              className="min-w-0 text-[1.0625rem] leading-snug text-foreground"
            >
              {t("voice.inputEnabled")}
            </label>
            <Toggle
              id="voice-input-enabled"
              ariaLabel={t("voice.inputEnabled")}
              checked={settings.inputEnabled}
              onChange={(v) => update({ inputEnabled: v })}
            />
          </div>
          <div className="flex min-h-11 items-center justify-between gap-3 pl-4 pr-3">
            <span className="shrink-0 text-[1.0625rem] text-foreground">{t("voice.sttLang")}</span>
            <Select
              value={settings.sttLang}
              onValueChange={(v) => update({ sttLang: v as SttLang })}
            >
              <SelectTrigger className={VALUE_TRIGGER} aria-label={t("voice.sttLang")}>
                <SelectValue>
                  {settings.sttLang === "auto"
                    ? t("voice.sttLangAuto")
                    : t(`voice.sttLangOptions.${settings.sttLang}`)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">{t("voice.sttLangOptions.auto")}</SelectItem>
                <SelectItem value="en">{t("voice.sttLangOptions.en")}</SelectItem>
                <SelectItem value="hi">{t("voice.sttLangOptions.hi")}</SelectItem>
                <SelectItem value="mr">{t("voice.sttLangOptions.mr")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Group>

      <Group title={t("voice.groupOutput")} footer={t("voice.previewHint")} delay={2}>
        <div className="list-hairline">
          <div className="flex min-h-11 items-center justify-between gap-3 pl-4 pr-3">
            <span className="shrink-0 text-[1.0625rem] text-foreground">{t("voice.speaker")}</span>
            <Select value={settings.speaker} onValueChange={(v) => update({ speaker: v })}>
              <SelectTrigger className={VALUE_TRIGGER} aria-label={t("voice.speaker")}>
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
          <Row label={t("voice.pace")}>
            <SegmentedGroup<string>
              name="voice-pace"
              value={String(settings.pace)}
              onChange={(v) => update({ pace: Number(v) })}
              options={PACE_OPTIONS}
            />
          </Row>
          <button
            type="button"
            onClick={previewVoice}
            disabled={previewLoading}
            aria-pressed={previewPlaying}
            className="tap-press flex min-h-11 w-full items-center gap-2.5 px-4 text-left text-[1.0625rem] text-accent transition-colors hover:bg-foreground/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-wait disabled:opacity-70"
          >
            {previewLoading ? (
              <Loader2 size={18} aria-hidden="true" className="motion-safe:animate-spin" />
            ) : previewPlaying ? (
              <Square size={16} aria-hidden="true" />
            ) : (
              <Volume2 size={18} aria-hidden="true" />
            )}
            {previewLoading
              ? t("voice.previewLoading")
              : previewPlaying
                ? t("voice.previewStop")
                : t("voice.previewPlay")}
          </button>
        </div>
      </Group>

      {previewError && (
        <p role="alert" className="-mt-4 px-4 text-[0.8125rem] text-destructive-strong">
          {previewError}
        </p>
      )}

      <p className="motion-fade-up motion-delay-3 px-4 text-[0.8125rem] leading-snug text-muted-foreground">
        {t("voice.languageNote")}
      </p>
    </section>
  );
}
