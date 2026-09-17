import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { KeyRound, Orbit, ShieldCheck } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

import { AuthTransitionPage } from "@/components/auth/AuthTransitionPage";
import { StateFrame } from "@/components/states/StateFrame";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [{ title: "Reset password — AstroSaathi" }],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Wait briefly for the recovery session to hydrate from the URL.
    const t0 = setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      setReady(Boolean(data.session));
    }, 300);
    return () => clearTimeout(t0);
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError(t("auth.errors.passwordShort"));
      return;
    }
    if (password !== confirm) {
      setError(t("auth.errors.confirmMismatch"));
      return;
    }
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) {
      setError(t("auth.errors.generic"));
      return;
    }
    setDone(true);
    setTimeout(() => navigate({ to: "/home", replace: true }), 900);
  };

  return (
    <AuthTransitionPage>
      {!ready && !done && (
        <StateFrame
          scope="panel"
          tone="loading"
          role="status"
          live="polite"
          busy
          title={t("auth.reset.verifyingTitle")}
          description={t("auth.reset.verifyingBody")}
          icon={
            <>
              <Orbit className="h-6 w-6" strokeWidth={1.6} />
              <span className="as-state-orbit-dot absolute left-1/2 top-1/2 size-1.5 rounded-full bg-current shadow-[0_0_10px_currentColor]" />
            </>
          }
          className="border-white/15 bg-background/95 shadow-2xl backdrop-blur-xl"
        />
      )}

      {done ? (
        <div
          role="status"
          aria-live="polite"
          className="motion-local-enter w-full rounded-[1.75rem] border border-white/15 bg-background/95 p-7 text-center text-foreground shadow-2xl backdrop-blur-xl sm:p-10"
        >
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
            <ShieldCheck className="h-6 w-6" aria-hidden />
          </div>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.22em] text-accent">
            {t("auth.reset.eyebrow")}
          </p>
          <h1 className="font-display mt-3 text-3xl font-semibold text-foreground sm:text-4xl">
            {t("auth.reset.doneTitle")}
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
            {t("auth.reset.done")}
          </p>
        </div>
      ) : ready ? (
        <section className="motion-local-enter w-full rounded-[1.75rem] border border-white/15 bg-background/95 p-6 text-foreground shadow-2xl backdrop-blur-xl sm:p-9">
          <div className="grid h-12 w-12 place-items-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
            <KeyRound className="h-5 w-5" aria-hidden />
          </div>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.22em] text-accent">
            {t("auth.reset.eyebrow")}
          </p>
          <h1 className="font-display mt-3 text-3xl font-semibold text-foreground sm:text-4xl">
            {t("auth.reset.title")}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("auth.reset.subtitle")}</p>

          <form className="mt-7 space-y-4" onSubmit={onSubmit} noValidate>
            {error && (
              <div
                role="alert"
                className="rounded-xl border border-destructive/40 bg-destructive/10 px-3.5 py-3 text-sm text-destructive-strong"
              >
                {error}
              </div>
            )}
            <div>
              <label htmlFor="new-password" className="block text-sm font-semibold text-foreground">
                {t("auth.reset.newPassword")}
              </label>
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 h-12 w-full rounded-xl border border-input bg-background/80 px-3.5 text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label
                htmlFor="confirm-password"
                className="block text-sm font-semibold text-foreground"
              >
                {t("auth.confirmPassword")}
              </label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="mt-1.5 h-12 w-full rounded-xl border border-input bg-background/80 px-3.5 text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <Button type="submit" disabled={loading} className="h-12 w-full text-base">
              {loading ? t("auth.loading") : t("auth.reset.cta")}
            </Button>
          </form>
          <div className="mt-6 flex items-start gap-2 border-t border-border/70 pt-5 text-xs leading-5 text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
            <span>{t("auth.reset.secureNote")}</span>
          </div>
        </section>
      ) : null}
    </AuthTransitionPage>
  );
}
