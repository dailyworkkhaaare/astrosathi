import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  AudioLines,
  Bell,
  Brain,
  CalendarDays,
  ChevronRight,
  FileText,
  Info,
  LogOut,
  MessageCircle,
  Palette,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { useRequireOnboarding } from "@/lib/require-auth";
import { AstroArt } from "@/components/AstroArt";
import { ConfirmDialog, Group, Toggle } from "@/components/settings/primitives";
import { clearSession, getSession, mockAuth } from "@/lib/auth";
import { getBirthProfile, type BirthProfile } from "@/lib/birth-profile";
import { useChartGatewayCacheControls, usePlanets } from "@/lib/queries";
import {
  getPreferences,
  loadPreferencesFromProfile,
  updatePreferences,
  APP_VERSION,
  type Preferences,
} from "@/lib/preferences";

export const Route = createFileRoute("/settings/")({
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
  useRequireOnboarding();
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

  const onSignOut = async () => {
    cache.clear();
    await mockAuth.signOut();
    navigate({ to: "/auth" });
  };

  const onMemoryOptInChange = (memory_opt_in: boolean) => {
    setPrefs(updatePreferences({ memory_opt_in }));
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

  const displayName =
    prefs.display_name || session?.name || birth?.name || t("settings.profile.nameFallback");
  const displayEmail = session?.email || t("settings.profile.emailFallback");

  return (
    <section className="mx-auto max-w-2xl space-y-7">
      <header className="motion-fade-up">
        <h1 className="large-title text-foreground">{t("settings.title")}</h1>
      </header>

      <Link
        to="/onboarding/birth"
        className="motion-fade-up tap-press flex min-h-[4.75rem] items-center gap-3.5 rounded-[1.25rem] bg-card px-4 py-3 shadow-[var(--as-elevation-1)] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {moonSign ? (
          <AstroArt kind="sign" name={moonSign} size={52} priority />
        ) : (
          <span
            aria-hidden="true"
            className="grid h-[3.25rem] w-[3.25rem] shrink-0 place-items-center rounded-full bg-accent/15 text-xl font-semibold text-accent"
          >
            {(displayName?.trim()?.[0] ?? "?").toUpperCase()}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[1.0625rem] font-semibold text-foreground">
            {displayName}
          </span>
          <span className="block truncate text-[0.8125rem] text-muted-foreground" dir="ltr">
            {displayEmail}
          </span>
        </span>
        <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-muted-foreground" />
      </Link>

      <div className="motion-fade-up overflow-hidden rounded-[0.875rem] bg-card shadow-[var(--as-elevation-1)]">
        <div className={ROWS}>
          <SettingsLink
            to="/onboarding/birth"
            icon={<CalendarDays size={17} />}
            label={t("settings.profile.editBirth")}
          />
          <SettingsLink
            to="/people"
            icon={<Users size={17} />}
            label={t("settings.profile.people")}
          />
          <SettingsLink
            to="/settings/memory"
            icon={<Brain size={17} />}
            label={t("settings.profile.memory")}
          />
          <div className="flex min-h-12 items-center gap-3.5 py-1 pl-4 pr-2">
            <IconTile>
              <Sparkles size={17} />
            </IconTile>
            <label htmlFor="pref-memory" className="min-w-0 flex-1 text-base text-foreground">
              {t("settings.prefs.memory")}
            </label>
            <Toggle
              id="pref-memory"
              ariaLabel={t("settings.prefs.memory")}
              checked={prefs.memory_opt_in}
              onChange={onMemoryOptInChange}
            />
          </div>
          <SettingsLink
            to="/settings/proactive"
            icon={<Bell size={17} />}
            label={t("settings.profile.proactive")}
          />
        </div>
      </div>

      <Group title={t("settings.experience.title")}>
        <div className={ROWS}>
          <SettingsLink
            to="/settings/preferences"
            icon={<Palette size={17} />}
            label={t("settings.prefs.title")}
          />
          <SettingsLink
            to="/settings/voice"
            icon={<AudioLines size={17} />}
            label={t("voice.settingsTitle")}
          />
          <SettingsLink
            to="/settings/whatsapp"
            icon={<MessageCircle size={17} />}
            label={t("settings.whatsapp.title")}
          />
        </div>
      </Group>

      <Group title={t("settings.legal.title")}>
        <div className={ROWS}>
          <SettingsLink
            to="/terms"
            icon={<FileText size={17} />}
            label={t("settings.legal.terms")}
          />
          <SettingsLink
            to="/privacy"
            icon={<ShieldCheck size={17} />}
            label={t("settings.legal.privacy")}
          />
          <div className="flex min-h-12 items-center gap-3.5 px-4">
            <IconTile>
              <Info size={17} />
            </IconTile>
            <span className="min-w-0 flex-1 text-base text-foreground">
              {t("settings.versionLabel")}
            </span>
            <span className="shrink-0 text-[0.9375rem] tabular-nums text-muted-foreground">
              {t("settings.version", { v: APP_VERSION })}
            </span>
          </div>
        </div>
      </Group>

      <Group title={t("settings.account.title")}>
        <div className={ROWS}>
          <button type="button" onClick={onSignOut} className={ROW_BUTTON}>
            <IconTile>
              <LogOut size={17} />
            </IconTile>
            <span className="min-w-0 flex-1 text-base text-foreground">
              {t("settings.account.signOut")}
            </span>
          </button>
          <button type="button" onClick={() => setConfirmDelete(true)} className={ROW_BUTTON}>
            <IconTile tone="warning">
              <Trash2 size={17} />
            </IconTile>
            <span className="min-w-0 flex-1 text-base text-destructive-strong">
              {t("settings.account.delete")}
            </span>
          </button>
        </div>
      </Group>
      <p className="-mt-5 px-4 text-xs leading-relaxed text-muted-foreground">
        {t("settings.account.localDataHint")}
      </p>

      {confirmDelete && (
        <ConfirmDialog
          title={t("settings.account.deleteTitle")}
          body={t("settings.account.deleteBody")}
          cancelLabel={t("settings.account.cancel")}
          confirmLabel={t("settings.account.confirm")}
          confirmTone="danger"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={onDelete}
        />
      )}
    </section>
  );
}

const ROWS = "list-hairline [--list-inset:3.75rem]";
const ROW_BUTTON =
  "tap-press flex min-h-12 w-full items-center gap-3.5 px-4 py-1.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";

function IconTile({ children, tone }: { children: ReactNode; tone?: "warning" }) {
  return (
    <span
      aria-hidden="true"
      className={
        "grid h-[1.875rem] w-[1.875rem] shrink-0 place-items-center rounded-[0.5rem] " +
        (tone === "warning"
          ? "bg-destructive/12 text-destructive-strong"
          : "bg-accent/12 text-accent")
      }
    >
      {children}
    </span>
  );
}

function SettingsLink({
  to,
  icon,
  label,
}: {
  to:
    | "/onboarding/birth"
    | "/people"
    | "/settings/memory"
    | "/settings/proactive"
    | "/settings/preferences"
    | "/settings/voice"
    | "/settings/whatsapp"
    | "/terms"
    | "/privacy";
  icon: ReactNode;
  label: string;
}) {
  return (
    <Link to={to} className={ROW_BUTTON}>
      <IconTile>{icon}</IconTile>
      <span className="min-w-0 flex-1 text-base text-foreground">{label}</span>
      <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-muted-foreground" />
    </Link>
  );
}
