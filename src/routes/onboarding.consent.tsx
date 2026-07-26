import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronDown, ShieldCheck, Sparkles, UserCheck } from "lucide-react";
import { useRequireAuth } from "@/lib/require-auth";
import { OnboardingShell } from "@/components/OnboardingShell";
import { Button } from "@/components/ui/button";

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
      setSaveError(t("auth.errors.generic"));
      return;
    }
    navigate({ to: "/onboarding/birth" });
  };

  return (
    <OnboardingShell
      step={1}
      eyebrow={t("consent.title")}
      title={t("consent.title")}
      subtitle={t("consent.body")}
    >
      <div className="space-y-6">
        <Group title={t("consent.ageTitle")} icon={<UserCheck size={14} aria-hidden="true" />}>
          <CheckboxRow checked={age} onChange={setAge} label={t("consent.ageLabel")} required />
        </Group>

        <Group
          title={t("consent.requiredTitle")}
          icon={<ShieldCheck size={14} aria-hidden="true" />}
        >
          <CheckboxRow
            checked={terms}
            onChange={setTerms}
            label={t("consent.termsLabel")}
            required
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
            expandable={{
              summary: t("consent.privacySummary"),
              linkLabel: t("consent.privacyLink"),
              href: "/privacy",
            }}
          />
        </Group>

        <Group title={t("consent.optionalTitle")} icon={<Sparkles size={14} aria-hidden="true" />}>
          <CheckboxRow
            checked={memory}
            onChange={setMemory}
            label={t("consent.memoryLabel")}
            help={t("consent.memoryHelp")}
          />
        </Group>

        <div className="rounded-xl border border-accent/25 bg-accent/5 p-5">
          <p className="text-sm font-semibold text-accent">
            {t("consent.disclosureTitle")}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {t("consent.disclosureBody")}
          </p>
        </div>

        <Button
          type="button"
          variant="primary"
          onClick={onContinue}
          disabled={!canContinue || saving}
          aria-disabled={!canContinue || saving}
          className="w-full"
        >
          {saving ? t("auth.loading") : t("common.continue")}
        </Button>
        {saveError && (
          <p role="alert" className="text-sm text-destructive">
            {saveError}
          </p>
        )}
      </div>
    </OnboardingShell>
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
    <div className="space-y-2">
      <h2 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {icon ? <span className="text-accent">{icon}</span> : null}
        {title}
      </h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function CheckboxRow({
  checked,
  onChange,
  label,
  required,
  help,
  expandable,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  required?: boolean;
  help?: string;
  expandable?: { summary: string; linkLabel: string; href: "/terms" | "/privacy" };
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <div
      className={
        "rounded-xl border px-4 py-3.5 transition-colors duration-[var(--motion-micro)] " +
        (checked ? "border-accent/60 bg-accent/[0.06]" : "border-border bg-card")
      }
    >
      <label className="flex cursor-pointer items-start gap-3">
        <div className="relative flex h-5 w-5 shrink-0 items-center justify-center mt-0.5">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            className="peer h-5 w-5 shrink-0 appearance-none rounded-md border border-input bg-background cursor-pointer transition-colors checked:border-primary checked:bg-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-required={required || undefined}
          />
          <Check
            size={12}
            className="pointer-events-none absolute hidden text-primary-foreground peer-checked:block"
            aria-hidden="true"
          />
        </div>
        <span className="text-sm leading-snug text-foreground">
          {label}
          {required && <span className="ml-1 text-accent">*</span>}
        </span>
      </label>
      {help && (
        <p className="mt-1 pl-[2rem] text-xs leading-normal text-muted-foreground">{help}</p>
      )}
      {expandable && (
        <div className="mt-2.5 pl-[2rem]">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
            aria-expanded={open}
          >
            {open ? t("consent.readLess") : t("consent.readMore")}
            <ChevronDown
              size={14}
              className={`transition-transform ${open ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>
          {open && (
            <div className="mt-2 space-y-2 text-xs text-muted-foreground">
              <p>{expandable.summary}</p>
              <Link
                to={expandable.href}
                className="inline-block font-medium text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              >
                {expandable.linkLabel}
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
