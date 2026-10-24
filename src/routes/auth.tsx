import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { OnboardingShell } from "@/components/OnboardingShell";
import { LoadingState } from "@/components/states/LoadingState";
import { Button } from "@/components/ui/button";
import { mockAuth, useAuthSession } from "@/lib/auth";
import { getOnboardingState, routeForOnboardingState } from "@/lib/birth-profile";

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
  "h-11 bg-transparent text-[1.0625rem] text-foreground placeholder:text-muted-foreground/70 focus:outline-none -mx-2 w-[calc(100%+1rem)] rounded-md px-2 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";

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

  const done = (mode === "signup" && !!confirmSent) || (mode === "forgot" && resetSent);

  return (
    <main className="min-h-dvh w-full bg-background px-4 pt-[calc(var(--as-safe-top)+0.75rem)] text-foreground sm:px-6 md:pt-12">
      <OnboardingShell
        step={2}
        title={t(
          mode === "signin"
            ? "auth.signInTitle"
            : mode === "signup"
              ? "auth.signUpTitle"
              : "auth.forgotTitle",
        )}
        subtitle={modeSubtitle}
        onBack={() =>
          mode === "forgot" ? switchMode("signin") : void navigate({ to: "/language" })
        }
        footer={
          done ? undefined : (
            <>
              <Button
                type="submit"
                form="auth-form"
                variant="primary"
                disabled={loading}
                className="min-h-[3.375rem] w-full rounded-full text-[1.0625rem] font-semibold"
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
              <p className="mt-3 flex items-start justify-center gap-1.5 text-center text-xs leading-5 text-muted-foreground">
                <ShieldCheck size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-accent" />
                <span>
                  {t("auth.privacyNote")}{" "}
                  <Link
                    to="/privacy"
                    className="font-semibold text-foreground underline-offset-2 hover:underline"
                  >
                    {t("common.privacy")}
                  </Link>
                </span>
              </p>
            </>
          )
        }
      >
        {mode !== "forgot" && <AuthTabs mode={mode} switchMode={switchMode} t={t} />}

        {formError && (
          <div
            role="alert"
            className="mb-4 rounded-[0.875rem] border border-destructive/40 bg-destructive/10 px-3.5 py-3 text-sm text-destructive-strong"
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
            googleLoading={googleLoading}
            set={set}
            switchMode={switchMode}
            onGoogle={onGoogle}
            onSubmit={onSubmit}
            t={t}
          />
        )}

        {mode === "forgot" && (
          <div className="mt-6 text-center text-[0.9375rem]">
            <button
              type="button"
              onClick={() => switchMode("signin")}
              className="tap-press inline-flex min-h-11 items-center rounded-md px-2 font-semibold text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t("auth.backToSignIn")}
            </button>
          </div>
        )}
      </OnboardingShell>
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
      className="mb-6 grid grid-cols-2 rounded-[0.625rem] bg-foreground/[0.07] p-0.5"
    >
      {(["signin", "signup"] as const).map((item) => (
        <button
          key={item}
          role="tab"
          aria-selected={mode === item}
          type="button"
          onClick={() => switchMode(item)}
          className={`min-h-9 rounded-[0.5rem] px-4 text-[0.9375rem] font-semibold transition-[background-color,color,box-shadow] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${mode === item ? "bg-surface-raised text-foreground shadow-[var(--as-elevation-1)]" : "text-muted-foreground hover:text-foreground"}`}
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
            className="min-h-[3.375rem] w-full gap-3 rounded-full border-border/80 bg-surface-raised text-[1.0625rem] font-semibold"
          >
            <GoogleLogo />
            {googleLoading ? t("auth.loading") : t("auth.continueWithGoogle")}
          </Button>
          <div className="my-5 flex items-center gap-3" aria-hidden="true">
            <span className="h-px flex-1 bg-border" />
            <span className="text-[0.8125rem] text-muted-foreground">{t("auth.orEmail")}</span>
            <span className="h-px flex-1 bg-border" />
          </div>
        </div>
      )}

      <form id="auth-form" onSubmit={onSubmit} noValidate>
        <div className="list-hairline grid grid-cols-[auto_minmax(0,1fr)] overflow-hidden rounded-[0.875rem] bg-card shadow-[var(--as-elevation-1)]">
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
                  enterKeyHint="next"
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
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint={mode === "forgot" ? "send" : "next"}
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
              error={errors.password}
              input={
                <input
                  id="password"
                  type="password"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  enterKeyHint={mode === "signup" ? "next" : "done"}
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
                  enterKeyHint="done"
                  value={values.confirm}
                  onChange={set("confirm")}
                  className={INPUT_CLASS}
                />
              }
            />
          )}
        </div>
        <FieldErrors errors={errors} />
        {mode === "signin" && (
          <div className="mt-1 flex justify-end">
            <button
              type="button"
              onClick={() => switchMode("forgot")}
              className="tap-press inline-flex min-h-11 items-center rounded-md px-2 text-[0.9375rem] font-medium text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t("auth.forgotLink")}
            </button>
          </div>
        )}
      </form>
    </>
  );
}

function SuccessMessage({ title, body }: { title: string; body: string }) {
  return (
    <div
      className="rounded-[1.25rem] bg-card p-5 text-sm text-foreground shadow-[var(--as-elevation-1)]"
      role="status"
    >
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
  error,
  input,
}: {
  id: string;
  label: string;
  error?: string;
  input: ReactNode;
}) {
  return (
    <div
      className="col-span-2 grid min-h-[3.125rem] grid-cols-subgrid items-center gap-x-4 px-4 data-[invalid]:bg-destructive/10"
      data-invalid={error ? "" : undefined}
    >
      <label htmlFor={id} className="max-w-[10rem] text-[1.0625rem] leading-tight text-foreground">
        {label}
      </label>
      <div className="min-w-0">{input}</div>
    </div>
  );
}

/** Field errors read in form order below the grouped rows, each its own alert. */
function FieldErrors({ errors }: { errors: Record<string, string> }) {
  const messages = ["name", "email", "password", "confirm"]
    .map((key) => errors[key])
    .filter(Boolean);
  if (messages.length === 0) return null;
  return (
    <div className="mt-2 space-y-1 px-4">
      {messages.map((message) => (
        <p key={message} className="text-[0.8125rem] text-destructive-strong" role="alert">
          {message}
        </p>
      ))}
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
