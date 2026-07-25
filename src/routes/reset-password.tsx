import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

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
    <section className="mx-auto max-w-md">
      <h1 className="font-display text-2xl font-semibold text-foreground sm:text-3xl">
        {t("auth.reset.title")}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("auth.reset.subtitle")}</p>

      {!ready && !done && (
        <p className="mt-6 text-sm text-muted-foreground">{t("auth.callback.loading")}</p>
      )}

      {done ? (
        <div className="mt-6 rounded-md border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-foreground">
          {t("auth.reset.done")}
        </div>
      ) : ready ? (
        <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
          {error && (
            <div
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </div>
          )}
          <div>
            <label htmlFor="new-password" className="block text-sm font-medium text-foreground">
              {t("auth.reset.newPassword")}
            </label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label htmlFor="confirm-password" className="block text-sm font-medium text-foreground">
              {t("auth.confirmPassword")}
            </label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary px-4 py-3 text-base font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {loading ? t("auth.loading") : t("auth.reset.cta")}
          </button>
        </form>
      ) : null}
    </section>
  );
}
