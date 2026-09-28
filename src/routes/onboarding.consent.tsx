import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useId, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Brain,
  Check,
  ChevronDown,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { useRequireAuth } from "@/lib/require-auth";
import { OnboardingShell } from "@/components/OnboardingShell";
import { Button } from "@/components/ui/button";
import { triggerHaptic } from "@/lib/native-device";

import { saveConsent } from "@/lib/consent";

export const Route = createFileRoute("/onboarding/consent")({
  head: () => ({
    meta: [
      { title: "Eligibility & consent — AstroSaathi" },
      {
        name: "description",
        content:
          "Confirm age eligibility and review AstroSaathi's terms, privacy policy, and personalization preferences.",
      },
      { property: "og:title", content: "Eligibility & consent — AstroSaathi" },
      {
        property: "og:description",
        content: "Age eligibility, terms, and privacy consent for AstroSaathi.",
      },
    ],
  }),
  component: ConsentPage,
});

function ConsentPage() {
  useRequireAuth();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [age, setAge] = useState(false);
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [memory, setMemory] = useState(false);

  const requiredChoices = [age, terms, privacy];
  const completedRequired = requiredChoices.filter(Boolean).length;
  const canContinue = age && terms && privacy;

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const onContinue = async () => {
    if (!canContinue) return;
    setSaving(true);
    setSaveError(null);
    const res = await saveConsent({
      ageConfirmed: age,
      termsAccepted: terms,
      privacyAccepted: privacy,
      memoryOptIn: memory,
      locale: i18n.language,
    });
    setSaving(false);
    if (res.error) {
      void triggerHaptic("error");
      setSaveError(t("auth.errors.generic"));
      return;
    }
    void triggerHaptic("success");
    navigate({ to: "/onboarding/birth" });
  };

  return (
    <OnboardingShell
      step={1}
      eyebrow={t("consent.eyebrow")}
      title={t("consent.title")}
      subtitle={t("consent.body")}
    >
      <div className="space-y-7">
        <section className="rounded-lg border border-white/10 bg-[hsl(251_37%_15%)] p-5 text-white shadow-[var(--shadow-elevated)] sm:p-6">
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-[hsl(38_92%_72%)]">
              <LockKeyhole size={20} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-lg font-semibold tracking-tight">
                  {t("consent.trustTitle")}
                </h2>
                <span className="rounded-full border border-white/15 bg-white/[0.08] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/70">
                  {t("consent.requiredBadge")}
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-white/65 sm:text-sm">
                {t("consent.trustBody")}
              </p>
            </div>
          </div>

          <div className="mt-5" aria-live="polite">
            <div className="mb-2.5 flex items-center justify-between gap-4 text-xs">
              <span className="font-medium text-white/72">
                {t("consent.progressLabel", { done: completedRequired, total: 3 })}
              </span>
              <span className="font-semibold tabular-nums text-[hsl(38_92%_72%)]">
                {completedRequired}/3
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2" aria-hidden="true">
              {requiredChoices.map((complete, index) => (
                <span
                  key={index}
                  className={
                    "h-1.5 rounded-full transition-all duration-300 " +
                    (complete
                      ? "bg-accent"
                      : "bg-white/15")
                  }
                />
              ))}
            </div>
          </div>
        </section>

        <Group
          title={t("consent.requiredTitle")}
          icon={<ShieldCheck size={15} aria-hidden="true" />}
          badge={t("consent.requiredBadge")}
          help={t("consent.requiredHelp")}
        >
          <CheckboxRow
            checked={age}
            onChange={setAge}
            label={t("consent.ageLabel")}
            required
            icon={<UserCheck size={17} aria-hidden="true" />}
          />
          <CheckboxRow
            checked={terms}
            onChange={setTerms}
            label={t("consent.termsLabel")}
            required
            icon={<ShieldCheck size={17} aria-hidden="true" />}
            expandable={{
              summary: t("consent.termsSummary"),
              linkLabel: t("consent.termsLink"),
              href: "/terms",
            }}
          />
          <CheckboxRow
            checked={privacy}
            onChange={setPrivacy}
            label={t("consent.privacyLabel")}
            required
            icon={<LockKeyhole size={17} aria-hidden="true" />}
            expandable={{
              summary: t("consent.privacySummary"),
              linkLabel: t("consent.privacyLink"),
              href: "/privacy",
            }}
          />
        </Group>

        <Group
          title={t("consent.optionalTitle")}
          icon={<Sparkles size={15} aria-hidden="true" />}
          badge={t("consent.optionalBadge")}
        >
          <CheckboxRow
            checked={memory}
            onChange={setMemory}
            label={t("consent.memoryLabel")}
            help={t("consent.memoryHelp")}
            icon={<Brain size={17} aria-hidden="true" />}
            tone="optional"
            status={memory ? t("consent.memoryOn") : t("consent.memoryOff")}
          />
        </Group>

        <section className="rounded-lg border border-accent/20 bg-accent/[0.06] p-5">
          <div className="flex gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
              <Sparkles size={15} aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                {t("consent.disclosureTitle")}
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {t("consent.disclosureBody")}
              </p>
            </div>
          </div>
        </section>

        <div className="sticky bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-10 rounded-lg border border-border/80 bg-background/95 p-3 shadow-[var(--shadow-elevated)] backdrop-blur sm:p-4">
          <p className="mb-3 text-center text-xs leading-relaxed text-muted-foreground">
            {canContinue ? t("consent.readyHint") : t("consent.continueHint")}
          </p>
          <Button
            type="button"
            variant="primary"
            onClick={onContinue}
            disabled={!canContinue || saving}
            aria-disabled={!canContinue || saving}
            className="min-h-12 w-full"
          >
            {saving ? t("auth.loading") : t("common.continue")}
          </Button>
          {saveError && (
            <p role="alert" className="mt-3 text-center text-sm text-destructive-strong">
              {saveError}
            </p>
          )}
        </div>
      </div>
    </OnboardingShell>
  );
}

function Group({
  title,
  icon,
  badge,
  help,
  children,
}: {
  title: string;
  icon?: ReactNode;
  badge?: string;
  help?: string;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-start justify-between gap-4 px-1">
        <div>
          <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-foreground">
            {icon ? <span className="text-accent">{icon}</span> : null}
            {title}
          </h2>
          {help ? (
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{help}</p>
          ) : null}
        </div>
        {badge ? (
          <span className="shrink-0 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="space-y-2.5">{children}</div>
    </section>
  );
}

function CheckboxRow({
  checked,
  onChange,
  label,
  required,
  help,
  icon,
  tone = "required",
  status,
  expandable,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  required?: boolean;
  help?: string;
  icon?: ReactNode;
  tone?: "required" | "optional";
  status?: string;
  expandable?: { summary: string; linkLabel: string; href: "/terms" | "/privacy" };
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const helpId = useId();
  const detailsId = useId();
  const optional = tone === "optional";

  return (
    <div
      className={
        "group rounded-lg border px-4 py-4 transition-all duration-[var(--motion-micro)] sm:px-5 " +
        (checked
          ? optional
            ? "border-primary/35 bg-primary/[0.06] shadow-[var(--shadow-soft)]"
            : "border-accent/45 bg-accent/[0.06] shadow-[var(--shadow-soft)]"
          : optional
            ? "border-border bg-card hover:border-primary/30"
            : "border-border bg-card hover:border-accent/30")
      }
    >
      <label className="flex cursor-pointer items-start gap-3.5">
        <span
          className={
            "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors " +
            (checked
              ? optional
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-accent/30 bg-accent/10 text-accent"
              : "border-border bg-muted/45 text-muted-foreground")
          }
          aria-hidden="true"
        >
          {icon}
        </span>
        <span className="min-w-0 flex-1 pt-0.5">
          <span className="flex flex-wrap items-start justify-between gap-2">
            <span className="text-sm font-medium leading-snug text-foreground">{label}</span>
            {status ? (
              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
                {status}
              </span>
            ) : null}
          </span>
          {help ? (
            <span
              id={helpId}
              className="mt-1.5 block text-xs leading-relaxed text-muted-foreground"
            >
              {help}
            </span>
          ) : null}
        </span>
        <span className="relative mt-1 flex h-6 w-6 shrink-0 items-center justify-center">
          <input
            type="checkbox"
            checked={checked}
            onChange={(event) => {
              const next = event.target.checked;
              void triggerHaptic(next ? "selection" : "light");
              onChange(next);
            }}
            className="peer h-6 w-6 cursor-pointer appearance-none rounded-lg border border-input bg-background transition-all checked:border-primary checked:bg-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-required={required || undefined}
            aria-describedby={help ? helpId : undefined}
          />
          <Check
            size={14}
            strokeWidth={2.5}
            className="pointer-events-none absolute scale-75 text-primary-foreground opacity-0 transition-all peer-checked:scale-100 peer-checked:opacity-100"
            aria-hidden="true"
          />
        </span>
      </label>

      {expandable ? (
        <div className="ml-[3.25rem] mt-2.5 border-t border-border/65 pt-2.5">
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            className="inline-flex items-center gap-1.5 rounded-md text-xs font-semibold text-primary transition-colors hover:text-primary/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-expanded={open}
            aria-controls={detailsId}
          >
            {open ? t("consent.readLess") : t("consent.readMore")}
            <ChevronDown
              size={14}
              className={`transition-transform ${open ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>
          {open ? (
            <div
              id={detailsId}
              className="mt-2.5 space-y-2 text-xs leading-relaxed text-muted-foreground"
            >
              <p>{expandable.summary}</p>
              <Link
                to={expandable.href}
                className="inline-block rounded-sm font-semibold text-primary underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {expandable.linkLabel}
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
