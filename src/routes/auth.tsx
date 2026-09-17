import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { Languages, LockKeyhole, Orbit, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { BrandMark } from "@/components/BrandMark";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { LoadingState } from "@/components/states/LoadingState";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { mockAuth, useAuthSession } from "@/lib/auth";
import { getOnboardingState, routeForOnboardingState } from "@/lib/birth-profile";
import { APP_NAME } from "@/lib/brand";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in or sign up — AstroSaathi" },
      {
        name: "description",
        content:
          "Sign in or create your AstroSaathi account to receive personalized Vedic astrology guidance.",
      },
      { property: "og:title", content: "Sign in — AstroSaathi" },
      { property: "og:description", content: "Sign in or create your AstroSaathi account." },
    ],
  }),
  component: AuthRoute,
});

type Mode = "signin" | "signup" | "forgot";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INPUT_CLASS =
  "h-12 w-full rounded-xl border border-input bg-background/80 px-3.5 text-foreground shadow-sm transition-[border-color,box-shadow,background-color] duration-[var(--motion-micro)] placeholder:text-muted-foreground/60 hover:border-primary/30 focus:border-primary/50 focus:bg-background focus:outline-none focus:ring-2 focus:ring-ring";

function AuthRoute() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return pathname === "/auth" ? <AuthPage /> : <Outlet />;
}

function AuthPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, loading: sessionLoading } = useAuthSession();
  const [mode, setMode] = useState<Mode>("signin");
  const [values, setValues] = useState({ name: "", email: "", password: "", confirm: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [confirmSent, setConfirmSent] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    if (sessionLoading || !user) return;
    let cancelled = false;
    void getOnboardingState().then((state) => {
      if (!cancelled) navigate({ to: routeForOnboardingState(state), replace: true });
    });
    return () => {
      cancelled = true;
    };
  }, [navigate, sessionLoading, user]);

  const set = (key: keyof typeof values) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));

  const switchMode = (next: Mode) => {
    setMode(next);
    setErrors({});
    setFormError(null);
    setResetSent(false);
    setConfirmSent(null);
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (mode === "signup" && !values.name.trim()) next.name = t("auth.errors.nameRequired");
    if (!values.email.trim()) next.email = t("auth.errors.emailRequired");
    else if (!EMAIL_RE.test(values.email.trim())) next.email = t("auth.errors.invalidEmail");
    if (mode !== "forgot") {
      if (!values.password) next.password = t("auth.errors.passwordRequired");
      else if (values.password.length < 8) next.password = t("auth.errors.passwordShort");
    }
    if (mode === "signup" && values.password !== values.confirm) {
      next.confirm = t("auth.errors.confirmMismatch");
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    if (!validate()) return;
    setLoading(true);
    try {
      if (mode === "signin") {
        const result = await mockAuth.signIn(values.email.trim(), values.password);
        if ("error" in result)
          setFormError(t(`auth.errors.${result.error}`, t("auth.errors.generic")));
        else {
          const state = await getOnboardingState();
          navigate({ to: routeForOnboardingState(state) });
        }
      } else if (mode === "signup") {
        const result = await mockAuth.signUp(
          values.name.trim(),
          values.email.trim(),
          values.password,
        );
        if ("error" in result)
          setFormError(t(`auth.errors.${result.error}`, t("auth.errors.generic")));
        else if (result.needsConfirmation) setConfirmSent(values.email.trim());
        else {
          const state = await getOnboardingState();
          navigate({ to: routeForOnboardingState(state) });
        }
      } else {
        const result = await mockAuth.resetPassword(values.email.trim());
        if ("error" in result)
          setFormError(t(`auth.errors.${result.error}`, t("auth.errors.generic")));
        else setResetSent(true);
      }
    } catch {
      setFormError(t("auth.errors.generic"));
    } finally {
      setLoading(false);
    }
  };

  const onGoogle = async () => {
    setFormError(null);
    setGoogleLoading(true);
    try {
      const result = await mockAuth.signInWithGoogle();
      if (result.error) {
        setFormError(t(`auth.errors.${result.error}`, t("auth.errors.generic")));
        setGoogleLoading(false);
        return;
      }
      if (result.redirected) return;
      const state = await getOnboardingState();
      navigate({ to: routeForOnboardingState(state) });
    } catch {
      setFormError(t("auth.errors.generic"));
      setGoogleLoading(false);
    }
  };

  if (sessionLoading || user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingState />
      </div>
    );
  }

  const modeSubtitle =
    mode === "signin"
      ? t("auth.signInSubtitle")
      : mode === "signup"
        ? t("auth.signUpSubtitle")
        : t("auth.forgotSubtitle");

  return (
    <main className="min-h-dvh w-full bg-background p-3 text-foreground sm:p-5 lg:p-6">
      <div className="mx-auto grid min-h-[calc(100dvh-1.5rem)] w-full max-w-[88rem] overflow-hidden rounded-[2rem] border border-border/70 bg-card/75 shadow-[var(--shadow-elevated)] backdrop-blur sm:min-h-[calc(100dvh-2.5rem)] lg:grid-cols-[0.9fr_1.1fr]">
        <AuthStory t={t} />

        <section className="relative flex flex-col bg-background/75 px-5 pb-8 pt-5 sm:px-10 lg:px-[clamp(3rem,6vw,6rem)]">
          <div className="flex items-center justify-end gap-2">
            <ThemeToggle />
            <LanguageSwitcher />
          </div>
          <div className="motion-fade-up mx-auto flex w-full max-w-[29rem] flex-1 flex-col justify-center py-7 sm:py-10">
            {mode !== "forgot" && <AuthTabs mode={mode} switchMode={switchMode} t={t} />}

            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">
              {t(mode === "forgot" ? "auth.recoveryEyebrow" : "auth.formEyebrow")}
            </p>
            <h1 className="font-display mt-3 text-balance text-3xl font-semibold leading-tight tracking-[-0.02em] text-foreground sm:text-4xl">
              {t(
                mode === "signin"
                  ? "auth.signInTitle"
                  : mode === "signup"
                    ? "auth.signUpTitle"
                    : "auth.forgotTitle",
              )}
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{modeSubtitle}</p>

            {formError && (
              <div
                role="alert"
                className="mt-5 rounded-xl border border-destructive/40 bg-destructive/10 px-3.5 py-3 text-sm text-destructive-strong"
              >
                {formError}
              </div>
            )}

            {mode === "signup" && confirmSent ? (
              <SuccessMessage
                title={t("auth.confirmEmailTitle")}
                body={t("auth.confirmEmailBody", { email: confirmSent })}
              />
            ) : mode === "forgot" && resetSent ? (
              <SuccessMessage title={t("auth.resetSentTitle")} body={t("auth.resetSent")} />
            ) : (
              <AuthForm
                mode={mode}
                values={values}
                errors={errors}
                loading={loading}
                googleLoading={googleLoading}
                set={set}
                switchMode={switchMode}
                onGoogle={onGoogle}
                onSubmit={onSubmit}
                t={t}
              />
            )}

            {mode === "forgot" && (
              <div className="mt-6 text-center text-sm">
                <button
                  type="button"
                  onClick={() => switchMode("signin")}
                  className="rounded-sm font-semibold text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {t("auth.backToSignIn")}
                </button>
              </div>
            )}

            <div className="mt-7 flex items-start justify-center gap-2 text-center text-xs leading-5 text-muted-foreground">
              <ShieldCheck size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-accent" />
              <span>
                {t("auth.privacyNote")}{" "}
                <Link to="/privacy" className="font-semibold text-primary hover:underline">
                  {t("common.privacy")}
                </Link>
              </span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

type Translation = ReturnType<typeof useTranslation>["t"];

function AuthTabs({
  mode,
  switchMode,
  t,
}: {
  mode: Mode;
  switchMode: (mode: Mode) => void;
  t: Translation;
}) {
  return (
    <div
      role="tablist"
      aria-label={t("auth.title")}
      className="mb-8 grid grid-cols-2 rounded-full border border-border/80 bg-muted/70 p-1 shadow-inner"
    >
      {(["signin", "signup"] as const).map((item) => (
        <button
          key={item}
          role="tab"
          aria-selected={mode === item}
          type="button"
          onClick={() => switchMode(item)}
          className={`tap-press min-h-10 rounded-full px-4 text-sm font-semibold transition-[background-color,color,box-shadow] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${mode === item ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          {t(item === "signin" ? "auth.signInTab" : "auth.signUpTab")}
        </button>
      ))}
    </div>
  );
}

function AuthForm({
  mode,
  values,
  errors,
  loading,
  googleLoading,
  set,
  switchMode,
  onGoogle,
  onSubmit,
  t,
}: {
  mode: Mode;
  values: { name: string; email: string; password: string; confirm: string };
  errors: Record<string, string>;
  loading: boolean;
  googleLoading: boolean;
  set: (
    key: "name" | "email" | "password" | "confirm",
  ) => (event: React.ChangeEvent<HTMLInputElement>) => void;
  switchMode: (mode: Mode) => void;
  onGoogle: () => Promise<void>;
  onSubmit: (event: FormEvent) => Promise<void>;
  t: Translation;
}) {
  return (
    <>
      {mode !== "forgot" && (
        <div className="mt-6">
          <Button
            type="button"
            variant="secondary"
            onClick={onGoogle}
            disabled={googleLoading}
            className="h-12 w-full gap-3 border-border/80 bg-background shadow-sm"
          >
            <GoogleLogo />
            {googleLoading ? t("auth.loading") : t("auth.continueWithGoogle")}
          </Button>
          <div className="my-5 flex items-center gap-3" aria-hidden="true">
            <span className="h-px flex-1 bg-border" />
            <span className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {t("auth.orEmail")}
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>
        </div>
      )}

      <form
        className={mode === "forgot" ? "mt-6 space-y-4" : "space-y-4"}
        onSubmit={onSubmit}
        noValidate
      >
        {mode === "signup" && (
          <Field
            id="name"
            label={t("auth.name")}
            error={errors.name}
            input={
              <input
                id="name"
                type="text"
                autoComplete="name"
                value={values.name}
                onChange={set("name")}
                className={INPUT_CLASS}
              />
            }
          />
        )}
        <Field
          id="email"
          label={t("auth.email")}
          error={errors.email}
          input={
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={values.email}
              onChange={set("email")}
              className={INPUT_CLASS}
            />
          }
        />
        {mode !== "forgot" && (
          <Field
            id="password"
            label={t("auth.password")}
            labelRight={
              mode === "signin" ? (
                <button
                  type="button"
                  onClick={() => switchMode("forgot")}
                  className="tap-press -my-2 inline-flex min-h-10 items-center rounded-md px-2 text-xs font-semibold text-primary hover:bg-muted hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {t("auth.forgotLink")}
                </button>
              ) : undefined
            }
            error={errors.password}
            input={
              <input
                id="password"
                type="password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={values.password}
                onChange={set("password")}
                className={INPUT_CLASS}
              />
            }
          />
        )}
        {mode === "signup" && (
          <Field
            id="confirm"
            label={t("auth.confirmPassword")}
            error={errors.confirm}
            input={
              <input
                id="confirm"
                type="password"
                autoComplete="new-password"
                value={values.confirm}
                onChange={set("confirm")}
                className={INPUT_CLASS}
              />
            }
          />
        )}
        <Button
          type="submit"
          variant="primary"
          disabled={loading}
          className="h-12 w-full text-base"
        >
          {loading
            ? t("auth.loading")
            : t(
                mode === "signin"
                  ? "auth.signInCta"
                  : mode === "signup"
                    ? "auth.signUpCta"
                    : "auth.sendReset",
              )}
        </Button>
      </form>
    </>
  );
}

function AuthStory({ t }: { t: Translation }) {
  const benefits = [
    { key: "Chart", icon: Orbit },
    { key: "Privacy", icon: LockKeyhole },
    { key: "Language", icon: Languages },
  ] as const;
  return (
    <aside
      className="relative isolate flex min-h-[17rem] flex-col overflow-hidden px-6 py-7 text-on-night sm:min-h-[22rem] sm:px-10 sm:py-9 lg:min-h-full lg:px-14 lg:py-12"
      style={{ background: "var(--gradient-night)" }}
    >
      <AuthCosmos />
      <Link
        to="/"
        className="relative inline-flex w-fit items-center gap-2 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={APP_NAME}
      >
        <BrandMark withWordmark={false} className="h-8 w-8" />
        <span className="text-lg font-semibold tracking-tight text-on-night">{APP_NAME}</span>
      </Link>
      <div className="relative my-auto max-w-lg py-9 lg:py-14">
        <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-accent">
          <Sparkles className="h-4 w-4" aria-hidden />
          {t("auth.heroEyebrow")}
        </p>
        <h2 className="font-display-hero mt-5 max-w-[10ch] text-balance text-4xl font-semibold leading-[1.02] sm:text-5xl lg:text-6xl">
          {t("auth.heroTitle")}
        </h2>
        <p className="mt-5 max-w-md text-sm leading-6 text-on-night-muted sm:text-base sm:leading-7">
          {t("auth.heroBody")}
        </p>
      </div>
      <div className="relative hidden grid-cols-3 gap-3 border-t border-white/10 pt-5 sm:grid">
        {benefits.map(({ key, icon: Icon }) => (
          <div
            key={key}
            className="rounded-xl border border-white/10 bg-white/[0.045] p-3 backdrop-blur-sm"
          >
            <Icon className="h-4 w-4 text-accent" aria-hidden />
            <p className="mt-3 text-xs font-semibold text-on-night">{t(`auth.benefit${key}`)}</p>
          </div>
        ))}
      </div>
    </aside>
  );
}

function AuthCosmos() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute -right-24 -top-20 h-80 w-80 rounded-full bg-[oklch(0.55_0.22_302/0.2)] blur-3xl" />
      <div className="absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-[oklch(0.69_0.16_75/0.12)] blur-3xl" />
      <svg
        className="absolute -right-24 top-[13%] h-[28rem] w-[28rem] opacity-45"
        viewBox="0 0 440 440"
      >
        <circle cx="220" cy="220" r="164" fill="none" stroke="white" strokeOpacity=".11" />
        <circle cx="220" cy="220" r="112" fill="none" stroke="white" strokeOpacity=".08" />
        <ellipse
          cx="220"
          cy="220"
          rx="176"
          ry="66"
          fill="none"
          stroke="white"
          strokeOpacity=".08"
          transform="rotate(-28 220 220)"
        />
        <circle cx="220" cy="56" r="4" fill="currentColor" className="text-accent" />
        <circle cx="371" cy="279" r="3" fill="white" fillOpacity=".7" />
      </svg>
    </div>
  );
}

function SuccessMessage({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-6 rounded-2xl border border-primary/25 bg-primary/[0.06] p-5 text-sm text-foreground shadow-[var(--shadow-soft)]">
      <div className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground">
        <ShieldCheck className="h-4 w-4" aria-hidden />
      </div>
      <p className="mt-4 font-semibold">{title}</p>
      <p className="mt-1.5 leading-6 text-muted-foreground">{body}</p>
    </div>
  );
}

function Field({
  id,
  label,
  labelRight,
  error,
  input,
}: {
  id: string;
  label: string;
  labelRight?: ReactNode;
  error?: string;
  input: ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="block text-sm font-semibold text-foreground">
          {label}
        </label>
        {labelRight}
      </div>
      <div className="mt-1.5">{input}</div>
      {error && (
        <p className="mt-1.5 text-xs text-destructive-strong" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden focusable="false">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
