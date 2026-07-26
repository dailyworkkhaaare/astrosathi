import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronRight,
  FileText,
  LogOut,
  Palette,
  ScrollText,
  Sparkles,
  Trash2,
  UserCircle,
} from "lucide-react";
import { useRequireAuth } from "@/lib/require-auth";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { clearSession, getSession, mockAuth } from "@/lib/auth";
import { getBirthProfile, type BirthProfile } from "@/lib/birth-profile";
import { useChartGatewayCacheControls, usePlanets } from "@/lib/queries";
import { APP_NAME } from "@/lib/brand";
import type { SignKey } from "@/lib/chart-types";
import {
  APP_VERSION,
  applyTheme,
  getPreferences,
  loadPreferencesFromProfile,
  updatePreferences,
  type AnswerLength,
  type Preferences,
  type Theme,
  type Tone,
} from "@/lib/preferences";

const SIGN_GLYPHS: Record<SignKey, string> = {
  aries: "♈",
  taurus: "♉",
  gemini: "♊",
  cancer: "♋",
  leo: "♌",
  virgo: "♍",
  libra: "♎",
  scorpio: "♏",
  sagittarius: "♐",
  capricorn: "♑",
  aquarius: "♒",
  pisces: "♓",
};

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — AstroSaathi" },
      {
        name: "description",
        content: "Manage your AstroSaathi profile, language, theme, guidance tone, and account.",
      },
      { property: "og:title", content: "Settings — AstroSaathi" },
      {
        property: "og:description",
        content: "Manage your AstroSaathi profile and preferences.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  useRequireAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const cache = useChartGatewayCacheControls();
  const planetsQuery = usePlanets();

  const [prefs, setPrefs] = useState<Preferences>(() => getPreferences());
  const [session, setSession] = useState(() => getSession());
  const [birth, setBirth] = useState<BirthProfile | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Load profile-backed prefs on mount.
  useEffect(() => {
    setPrefs(getPreferences());
    setSession(getSession());
    void getBirthProfile().then(setBirth);
    void loadPreferencesFromProfile().then(setPrefs);
  }, []);

  const update = (patch: Partial<Preferences>) => {
    const next = updatePreferences(patch);
    setPrefs(next);
    if (patch.theme) applyTheme(patch.theme);
  };

  const onSignOut = async () => {
    cache.clear();
    await mockAuth.signOut();
    navigate({ to: "/auth" });
  };

  const onDelete = () => {
    cache.clear();
    clearSession();
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem("astrosaathi.preferences");
      } catch {
        /* ignore */
      }
    }
    setConfirmDelete(false);
    navigate({ to: "/auth" });
  };

  const moonPlanet = planetsQuery.data?.planets?.find((p) => p.key === "moon");
  const moonSign = moonPlanet?.signKey ?? null;
  const moonGlyph = moonSign ? SIGN_GLYPHS[moonSign] : null;

  const displayName =
    prefs.display_name || session?.name || birth?.name || t("settings.profile.nameFallback");
  const displayEmail = session?.email || t("settings.profile.emailFallback");

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <div className="motion-fade-up">
        <h1 className="font-display text-3xl leading-tight tracking-tight text-foreground sm:text-4xl">
          {t("settings.title")}
        </h1>
      </div>

      {/* Profile */}
      <Group title={t("settings.profile.title")} icon={<UserCircle size={14} aria-hidden="true" />}>
        <div className="flex items-center gap-3 px-4 py-3 min-h-11">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent/15 text-primary">
            {moonGlyph ? (
              <span className="text-xl leading-none">{moonGlyph}</span>
            ) : (
              <span className="font-display text-lg">
                {(displayName?.trim()?.[0] ?? "?").toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-medium text-foreground">{displayName}</p>
            <p className="truncate text-sm text-muted-foreground" dir="ltr">
              {displayEmail}
            </p>
          </div>
        </div>
        <Divider />
        <button
          type="button"
          onClick={() => navigate({ to: "/onboarding/birth" })}
          className="tap-press flex w-full items-center justify-between px-4 py-3 min-h-11 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted focus:outline-none focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          <span>
            {t("settings.profile.editBirth")}
            <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
              {t("settings.profile.birthHint")}
            </span>
          </span>
          <ChevronRight size={16} aria-hidden="true" className="text-muted-foreground" />
        </button>
      </Group>

      {/* Preferences */}
      <Group title={t("settings.prefs.title")} icon={<Palette size={14} aria-hidden="true" />}>
        <Row label={t("settings.prefs.language")}>
          <LanguageSwitcher />
        </Row>
        <Divider />
        <Row label={t("settings.prefs.theme")}>
          <SegmentedGroup<Theme>
            name="theme"
            value={prefs.theme}
            onChange={(v) => update({ theme: v })}
            options={[
              { value: "light", label: t("settings.prefs.themeLight") },
              { value: "dark", label: t("settings.prefs.themeDark") },
              { value: "system", label: t("settings.prefs.themeSystem") },
            ]}
          />
        </Row>
        <Divider />
        <Row label={t("settings.prefs.tone")}>
          <SegmentedGroup<Tone>
            name="tone"
            value={prefs.tone}
            onChange={(v) => update({ tone: v })}
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
            onChange={(v) => update({ answer_length: v })}
            options={[
              { value: "concise", label: t("settings.prefs.lengthConcise") },
              { value: "balanced", label: t("settings.prefs.lengthBalanced") },
              { value: "detailed", label: t("settings.prefs.lengthDetailed") },
            ]}
          />
        </Row>
        <Divider />
        <div className="flex items-start justify-between gap-3 px-4 py-3 min-h-11">
          <div className="min-w-0">
            <label htmlFor="pref-memory" className="block text-sm font-medium text-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Sparkles size={13} aria-hidden="true" className="text-accent" />
                {t("settings.prefs.memory")}
              </span>
            </label>
            <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground truncate">
              {t("settings.prefs.memoryHelp")}
            </p>
          </div>
          <Toggle
            id="pref-memory"
            checked={prefs.memory_opt_in}
            onChange={(v) => update({ memory_opt_in: v })}
          />
        </div>
      </Group>

      {/* Legal & about */}
      <Group title={t("settings.legal.title")} icon={<ScrollText size={14} aria-hidden="true" />}>
        <LegalRow
          to="/terms"
          label={t("settings.legal.terms")}
          icon={<FileText size={14} aria-hidden="true" />}
        />
        <Divider />
        <LegalRow to="/privacy" label={t("settings.legal.privacy")} icon={<ShieldIcon />} />
        <Divider />
        <div className="px-4 py-2.5 text-center">
          <p className="text-xs font-medium text-foreground">{t("settings.about")}</p>
          <p className="mt-0.5 font-display italic text-xs text-muted-foreground">
            {t("settings.aboutBody")}
          </p>
        </div>
      </Group>

      {/* Account */}
      <Group title={t("settings.account.title")} icon={<LogOut size={14} aria-hidden="true" />}>
        <Button
          type="button"
          variant="ghost"
          onClick={onSignOut}
          className="w-full justify-start gap-2 h-auto px-4 py-3 min-h-11 font-medium text-foreground rounded-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <LogOut size={15} aria-hidden="true" className="text-muted-foreground" />
          {t("settings.account.signOut")}
        </Button>
        <Divider />
        <Button
          type="button"
          variant="ghost"
          onClick={() => setConfirmDelete(true)}
          className="w-full justify-start gap-2 h-auto px-4 py-3 min-h-11 font-medium text-foreground hover:bg-accent/10 rounded-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Trash2 size={15} aria-hidden="true" className="text-accent" />
          {t("settings.account.delete")}
        </Button>
      </Group>

      {confirmDelete && (
        <ConfirmDialog
          title={t("settings.account.deleteTitle")}
          body={t("settings.account.deleteBody")}
          cancelLabel={t("settings.account.cancel")}
          confirmLabel={t("settings.account.confirm")}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={onDelete}
        />
      )}
    </section>
  );
}

function Group({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="motion-fade-up">
      <h2 className="mb-2.5 flex items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {icon ? <span className="text-accent">{icon}</span> : null}
        {title}
      </h2>
      <div className="overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-[var(--shadow-soft)]">
        {children}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 px-4 py-3 min-h-11 md:flex-row md:items-center md:justify-between">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <div className="w-full md:w-auto">{children}</div>
    </div>
  );
}

function Divider() {
  return <div className="h-px bg-border" role="presentation" />;
}

function LegalRow({
  to,
  label,
  icon,
}: {
  to: "/terms" | "/privacy";
  label: string;
  icon?: ReactNode;
}) {
  return (
    <Link
      to={to}
      className="tap-press flex w-full items-center justify-between px-4 py-3 min-h-11 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted focus:outline-none focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
    >
      <span className="inline-flex items-center gap-2">
        {icon ? <span className="text-muted-foreground">{icon}</span> : null}
        {label}
      </span>
      <ChevronRight size={16} aria-hidden="true" className="text-muted-foreground" />
    </Link>
  );
}

function ShieldIcon() {
  // Kept as a tiny local helper so we don't need another lucide import above.
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3l8 3v6c0 4.5-3.3 8.4-8 9-4.7-.6-8-4.5-8-9V6l8-3z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SegmentedGroup<T extends string>({
  name,
  value,
  onChange,
  options,
}: {
  name: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div
      role="radiogroup"
      aria-label={name}
      className="flex w-full md:w-auto rounded-full border border-border bg-muted p-0.5"
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            className={`flex-1 md:flex-initial rounded-full px-3 py-1.5 min-h-[40px] md:min-h-0 text-xs font-medium transition-colors duration-[var(--motion-micro)] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              selected
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function Toggle({
  id,
  checked,
  onChange,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="grid place-items-center min-h-11 min-w-11 focus:outline-none"
    >
      <span
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-[var(--motion-micro)] focus-visible:ring-2 focus-visible:ring-ring ${
          checked ? "bg-primary" : "bg-muted-foreground/30"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-background shadow transition-transform duration-[var(--motion-micro)] ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}

function ConfirmDialog({
  title,
  body,
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: string;
  cancelLabel: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-4 sm:items-center"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="confirm-title" className="text-base font-semibold text-foreground">
          {title}
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        <div className="mt-5 flex gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            className="flex-1 border border-border bg-background"
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={onConfirm}
            className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
