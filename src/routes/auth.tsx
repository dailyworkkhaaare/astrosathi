import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ShieldCheck } from "lucide-react";

import { mockAuth, useAuthSession } from "@/lib/auth";
import { getOnboardingState, routeForOnboardingState } from "@/lib/birth-profile";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Starfield } from "@/components/Starfield";
import { BrandMark } from "@/components/BrandMark";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
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
      {
        property: "og:description",
        content: "Sign in or create your AstroSaathi account.",
      },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "forgot";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function AuthPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, loading: sessionLoading } = useAuthSession();
  const [mode, setMode] = useState<Mode>("signin");
  const [values, setValues] = useState({
    name: "",
    email: "",
    password: "",
    confirm: "",
  });
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
      if (!cancelled) {
        navigate({ to: routeForOnboardingState(state), replace: true });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [navigate, sessionLoading, user]);

  const set = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));

  const switchMode = (next: Mode) => {
    setMode(next);
    setErrors({});
    setFormError(null);
    setResetSent(false);
    setConfirmSent(null);
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (mode === "signup" && !values.name.trim()) {
      next.name = t("auth.errors.nameRequired");
    }
    if (!values.email.trim()) {
      next.email = t("auth.errors.emailRequired");
    } else if (!EMAIL_RE.test(values.email.trim())) {
      next.email = t("auth.errors.invalidEmail");
    }
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

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!validate()) return;
    setLoading(true);
    try {
      if (mode === "signin") {
        const res = await mockAuth.signIn(values.email.trim(), values.password);
        if ("error" in res) {
          setFormError(t(`auth.errors.${res.error}`, t("auth.errors.generic")));
        } else {
          const s = await getOnboardingState();
          navigate({ to: routeForOnboardingState(s) });
        }
      } else if (mode === "signup") {
        const res = await mockAuth.signUp(values.name.trim(), values.email.trim(), values.password);
        if ("error" in res) {
          setFormError(t(`auth.errors.${res.error}`, t("auth.errors.generic")));
        } else if (res.needsConfirmation) {
          setConfirmSent(values.email.trim());
        } else {
          const s = await getOnboardingState();
          navigate({ to: routeForOnboardingState(s) });
        }
      } else {
        const res = await mockAuth.resetPassword(values.email.trim());
        if ("error" in res) {
          setFormError(t(`auth.errors.${res.error}`, t("auth.errors.generic")));
        } else {
          setResetSent(true);
        }
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
      const res = await mockAuth.signInWithGoogle();
      if (res.error) {
        setFormError(t(`auth.errors.${res.error}`, t("auth.errors.generic")));
        setGoogleLoading(false);
        return;
      }
      if (res.redirected) return;
      const s = await getOnboardingState();
      navigate({ to: routeForOnboardingState(s) });
    } catch {
      setFormError(t("auth.errors.generic"));
      setGoogleLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen lg:grid lg:grid-cols-[1.1fr_1fr]">
      {/* Celestial column */}
      <aside className="relative isolate overflow-hidden bg-background text-foreground lg:min-h-screen">
        <Starfield density={60} className="lg:hidden" />
        <Starfield density={110} className="hidden lg:block" />

        {/* Mobile hero band */}
        <div className="relative flex flex-col items-center justify-center px-6 py-10 text-center lg:hidden">
          <Link
            to="/"
            className="inline-flex items-center rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:h-10 [&_svg]:w-10"
            aria-label={APP_NAME}
          >
            <BrandMark withWordmark={false} />
          </Link>
          <span className="font-display mt-2 text-3xl font-semibold tracking-tight text-on-night">
            {APP_NAME}
          </span>
        </div>

        {/* Desktop celestial layout */}
        <div className="relative hidden lg:flex lg:h-full lg:min-h-screen lg:flex-col lg:justify-center lg:px-14 lg:py-10">
          <Link
            to="/"
            className="inline-flex w-fit items-center rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <BrandMark />
          </Link>
          <h2 className="font-display mt-10 max-w-md text-4xl font-semibold leading-[1.05] text-on-night xl:text-5xl">
            {t("landing.title")}
          </h2>
        </div>
      </aside>

      {/* Form column */}
      <main className="relative flex min-h-screen flex-col bg-background px-4 py-6 md:px-6 lg:px-12">
        <div className="flex items-center justify-end gap-2">
          <ThemeToggle />
          <LanguageSwitcher />
        </div>
        <section className="motion-fade-up mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-8 lg:max-w-[420px]">
          <Card className="p-5 sm:p-6">
            {mode !== "forgot" && (
              <div
                role="tablist"
                aria-label={t("auth.title")}
                className="mb-6 grid grid-cols-2 rounded-full border border-border bg-muted p-1"
              >
                {(["signin", "signup"] as const).map((m) => (
                  <button
                    key={m}
                    role="tab"
                    aria-selected={mode === m}
                    type="button"
                    onClick={() => switchMode(m)}
                    className={`rounded-full py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      mode === m
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t(m === "signin" ? "auth.signInTab" : "auth.signUpTab")}
                  </button>
                ))}
              </div>
            )}

            <h1 className="font-display text-2xl font-semibold text-foreground sm:text-3xl">
              {t(
                mode === "signin"
                  ? "auth.signInTitle"
                  : mode === "signup"
                    ? "auth.signUpTitle"
                    : "auth.forgotTitle",
              )}
            </h1>
            {mode === "forgot" && (
              <p className="mt-2 text-sm text-muted-foreground">{t("auth.forgotSubtitle")}</p>
            )}

            {formError && (
              <div
                role="alert"
                className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive"
              >
                {formError}
              </div>
            )}

            {mode === "signup" && confirmSent ? (
              <div className="mt-6 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-foreground">
                <p className="font-medium">{t("auth.confirmEmailTitle")}</p>
                <p className="mt-1 text-muted-foreground">
                  {t("auth.confirmEmailBody", { email: confirmSent })}
                </p>
              </div>
            ) : mode === "forgot" && resetSent ? (
              <div className="mt-6 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-foreground">
                {t("auth.resetSent")}
              </div>
            ) : (
              <>
                {mode !== "forgot" && (
                  <div className="mt-6 space-y-3">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={onGoogle}
                      disabled={googleLoading}
                      className="h-12 w-full gap-3"
                    >
                      <GoogleLogo />
                      {googleLoading ? t("auth.loading") : t("auth.continueWithGoogle")}
                    </Button>
                    <div className="h-px w-full bg-border" aria-hidden="true" />
                  </div>
                )}
                <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
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
                          className="h-12 w-full rounded-xl border border-input bg-background px-3.5 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
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
                        className="h-12 w-full rounded-xl border border-input bg-background px-3.5 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
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
                            className="hidden text-sm font-medium text-primary hover:underline md:inline-block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
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
                          className="h-12 w-full rounded-xl border border-input bg-background px-3.5 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
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
                          className="h-12 w-full rounded-xl border border-input bg-background px-3.5 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      }
                    />
                  )}

                  <Button
                    type="submit"
                    variant="primary"
                    disabled={loading}
                    className="h-12 w-full"
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
            )}

            {mode === "signin" && (
              <div className="mt-6 text-center text-sm md:hidden">
                <button
                  type="button"
                  onClick={() => switchMode("forgot")}
                  className="font-medium text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                >
                  {t("auth.forgotLink")}
                </button>
              </div>
            )}
            {mode === "forgot" && (
              <div className="mt-6 text-center text-sm">
                <button
                  type="button"
                  onClick={() => switchMode("signin")}
                  className="font-medium text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                >
                  {t("auth.backToSignIn")}
                </button>
              </div>
            )}
          </Card>

          <div className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
            <ShieldCheck size={14} aria-hidden="true" className="shrink-0 text-muted-foreground" />
            <span>
              {t("auth.privacyNote")}{" "}
              <Link to="/privacy" className="font-medium text-accent hover:underline">
                {t("common.privacy")}
              </Link>
            </span>
          </div>
        </section>
      </main>
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
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="block text-sm font-medium text-foreground">
          {label}
        </label>
        {labelRight}
      </div>
      <div className="mt-1">{input}</div>
      {error && (
        <p className="mt-1 text-xs text-destructive" role="alert">
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
