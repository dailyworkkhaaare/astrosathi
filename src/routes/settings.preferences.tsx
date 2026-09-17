import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Check, Languages, Palette, SlidersHorizontal } from "lucide-react";

import { Divider, Group, Row, SegmentedGroup } from "@/components/settings/primitives";
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
    <section className="mx-auto max-w-2xl space-y-6">
      <header className="motion-fade-up">
        <Link
          to="/settings"
          aria-label={t("settings.memory.back")}
          className="tap-press mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </Link>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
          {t("settings.preferences.eyebrow")}
        </p>
        <h1 className="font-display text-3xl leading-tight tracking-tight text-foreground sm:text-4xl">
          {t("settings.preferences.title")}
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
          {t("settings.preferences.subtitle")}
        </p>
      </header>

      <Group
        title={t("settings.preferences.languageTitle")}
        icon={<Languages size={14} aria-hidden="true" />}
        delay={1}
      >
        <div className="px-4 pb-4 pt-3">
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t("settings.preferences.languageHint")}
          </p>
          <div
            className="mt-3 grid gap-2 sm:grid-cols-3"
            role="radiogroup"
            aria-label={t("settings.prefs.language")}
          >
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
                  className={`tap-press flex min-h-11 items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    selected
                      ? "border-primary/60 bg-primary/10 text-foreground"
                      : "border-border bg-background text-muted-foreground hover:border-primary/30 hover:text-foreground"
                  }`}
                >
                  <span>{t(`languages.${option}`)}</span>
                  <span
                    aria-hidden="true"
                    className={`grid h-5 w-5 place-items-center rounded-full border ${
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-transparent"
                    }`}
                  >
                    <Check size={12} strokeWidth={3} />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </Group>

      <Group
        title={t("settings.preferences.appearanceTitle")}
        icon={<Palette size={14} aria-hidden="true" />}
        delay={2}
      >
        <div className="px-4 pb-3 pt-3">
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t("settings.preferences.themeHint")}
          </p>
        </div>
        <Divider />
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
        icon={<SlidersHorizontal size={14} aria-hidden="true" />}
        delay={3}
      >
        <div className="px-4 pb-3 pt-3">
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t("settings.preferences.guidanceHint")}
          </p>
        </div>
        <Divider />
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
    </section>
  );
}
