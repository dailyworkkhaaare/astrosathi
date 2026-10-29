import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";

import {
  Divider,
  Group,
  Row,
  SegmentedGroup,
  SettingsBackHeader,
  Toggle,
} from "@/components/settings/primitives";
import { SUPPORTED_LANGUAGES, setLanguage, type SupportedLanguage } from "@/i18n";
import { useRequireOnboarding } from "@/lib/require-auth";
import {
  applyTheme,
  getPreferences,
  loadPreferencesFromProfile,
  updatePreferences,
  type AnswerLength,
  type Preferences,
  type Theme,
  type Tone,
} from "@/lib/preferences";

export const Route = createFileRoute("/settings/preferences")({
  head: () => ({ meta: [{ title: "Experience preferences — AstroSaathi" }] }),
  component: PreferencesPage,
});

function PreferencesPage() {
  useRequireOnboarding();
  const { t, i18n } = useTranslation();
  const [prefs, setPrefs] = useState<Preferences>(() => getPreferences());
  const language = i18n.language.split("-")[0] as SupportedLanguage;
  const currentLanguage = SUPPORTED_LANGUAGES.includes(language) ? language : "en";

  useEffect(() => {
    setPrefs(getPreferences());
    void loadPreferencesFromProfile().then(setPrefs);
  }, []);

  const update = (patch: Partial<Preferences>) => {
    const next = updatePreferences(patch);
    setPrefs(next);
    if (patch.theme) applyTheme(patch.theme);
  };

  return (
    <section className="mx-auto max-w-2xl space-y-7">
      <SettingsBackHeader
        title={t("settings.prefs.title")}
        backLabel={t("settings.memory.back")}
        subtitle={t("settings.preferences.subtitle")}
      />

      <Group
        title={t("settings.preferences.languageTitle")}
        footer={t("settings.preferences.languageHint")}
        delay={1}
      >
        <div role="radiogroup" aria-label={t("settings.prefs.language")} className="list-hairline">
          {SUPPORTED_LANGUAGES.map((option) => {
            const selected = option === currentLanguage;
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setLanguage(option)}
                lang={option}
                className="tap-press flex min-h-11 w-full items-center justify-between gap-3 px-4 py-2 text-left text-[1.0625rem] text-foreground transition-colors hover:bg-foreground/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <span>{t(`languages.${option}`)}</span>
                {selected ? (
                  <Check size={20} strokeWidth={2.5} aria-hidden="true" className="text-accent" />
                ) : null}
              </button>
            );
          })}
        </div>
      </Group>

      <Group
        title={t("settings.preferences.appearanceTitle")}
        footer={t("settings.preferences.themeHint")}
        delay={2}
      >
        <Row label={t("settings.prefs.theme")}>
          <SegmentedGroup<Theme>
            name="theme"
            value={prefs.theme}
            onChange={(theme) => update({ theme })}
            options={[
              { value: "light", label: t("settings.prefs.themeLight") },
              { value: "dark", label: t("settings.prefs.themeDark") },
              { value: "system", label: t("settings.prefs.themeSystem") },
            ]}
          />
        </Row>
      </Group>

      <Group
        title={t("settings.preferences.guidanceTitle")}
        footer={t("settings.preferences.guidanceHint")}
        delay={3}
      >
        <Row label={t("settings.prefs.tone")}>
          <SegmentedGroup<Tone>
            name="tone"
            value={prefs.tone}
            onChange={(tone) => update({ tone })}
            options={[
              { value: "calm", label: t("settings.prefs.toneCalm") },
              { value: "direct", label: t("settings.prefs.toneDirect") },
              { value: "supportive", label: t("settings.prefs.toneSupportive") },
            ]}
          />
        </Row>
        <Divider />
        <Row label={t("settings.prefs.length")}>
          <SegmentedGroup<AnswerLength>
            name="length"
            value={prefs.answer_length}
            onChange={(answer_length) => update({ answer_length })}
            options={[
              { value: "concise", label: t("settings.prefs.lengthConcise") },
              { value: "balanced", label: t("settings.prefs.lengthBalanced") },
              { value: "detailed", label: t("settings.prefs.lengthDetailed") },
            ]}
          />
        </Row>
      </Group>

      <Group
        title={t("settings.preferences.feedbackTitle")}
        footer={t("settings.prefs.hapticsHint")}
        delay={4}
      >
        <div className="flex min-h-11 items-center justify-between gap-3 py-1.5 pl-4 pr-2">
          <label htmlFor="pref-haptics" className="min-w-0 text-[1.0625rem] text-foreground">
            {t("settings.prefs.haptics")}
          </label>
          <Toggle
            id="pref-haptics"
            ariaLabel={t("settings.prefs.haptics")}
            checked={prefs.haptics_enabled}
            onChange={(haptics_enabled) => update({ haptics_enabled })}
          />
        </div>
      </Group>
    </section>
  );
}
