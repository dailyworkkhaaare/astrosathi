import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useId, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Brain, ChevronDown, LockKeyhole, ShieldCheck, UserCheck } from "lucide-react";
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
    <main className="min-h-dvh w-full bg-background px-4 pt-[calc(var(--as-safe-top)+0.75rem)] text-foreground sm:px-6 md:pt-12">
      <OnboardingShell
        step={3}
        showBack={false}
        title={t("consent.title")}
        subtitle={t("consent.body")}
        footer={
          <>
            <p className="mb-3 text-center text-xs leading-relaxed text-muted-foreground">
              {canContinue ? t("consent.readyHint") : t("consent.continueHint")}
            </p>
            <Button
              type="button"
              variant="primary"
              onClick={onContinue}
              disabled={!canContinue || saving}
              aria-disabled={!canContinue || saving}
              className="min-h-[3.375rem] w-full rounded-full text-[1.0625rem] font-semibold"
            >
              {saving ? t("auth.loading") : t("common.continue")}
            </Button>
            {saveError && (
              <p role="alert" className="mt-3 text-center text-sm text-destructive-strong">
                {saveError}
              </p>
            )}
          </>
        }
      >
        <div className="space-y-7">
          <Group
            title={t("consent.requiredTitle")}
            note={
              <span aria-live="polite">
                {t("consent.progressLabel", { done: completedRequired, total: 3 })}
              </span>
            }
          >
            <SwitchRow
              checked={age}
              onChange={setAge}
              label={t("consent.ageLabel")}
              required
              icon={<UserCheck size={17} aria-hidden="true" />}
            />
            <SwitchRow
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
            <SwitchRow
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

          <Group title={t("consent.optionalTitle")} footer={t("consent.memoryHelp")}>
            <SwitchRow
              checked={memory}
              onChange={setMemory}
              label={t("consent.memoryLabel")}
              icon={<Brain size={17} aria-hidden="true" />}
              status={memory ? t("consent.memoryOn") : t("consent.memoryOff")}
            />
          </Group>

          <p className="px-4 text-xs leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">{t("consent.disclosureTitle")}.</span>{" "}
            {t("consent.disclosureBody")}
          </p>
        </div>
      </OnboardingShell>
    </main>
  );
}

/** iOS grouped section: small header, hairline-separated card, optional footer. */
function Group({
  title,
  note,
  footer,
  children,
}: {
  title: string;
  note?: ReactNode;
  footer?: string;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="px-4 pb-2">
        <h2 className="text-[0.8125rem] font-semibold text-muted-foreground">{title}</h2>
        {note ? <p className="mt-0.5 text-xs text-muted-foreground">{note}</p> : null}
      </div>
      <div className="list-hairline overflow-hidden rounded-[0.875rem] bg-card shadow-[var(--as-elevation-1)] [--list-inset:3.75rem]">
        {children}
      </div>
      {footer ? (
        <p className="px-4 pt-2 text-xs leading-relaxed text-muted-foreground">{footer}</p>
      ) : null}
    </section>
  );
}

/** A consent row: the input stays a checkbox for assistive tech, drawn as a switch. */
function SwitchRow({
  checked,
  onChange,
  label,
  required,
  icon,
  status,
  expandable,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  required?: boolean;
  icon: ReactNode;
  status?: string;
  expandable?: { summary: string; linkLabel: string; href: "/terms" | "/privacy" };
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const statusId = useId();
  const detailsId = useId();

  return (
    <div className={"px-4 " + (expandable ? "pb-0.5 pt-3" : "py-3")}>
      <label className="flex min-h-11 cursor-pointer items-center gap-3">
        <span
          className="grid h-8 w-8 shrink-0 place-items-center rounded-[0.5rem] bg-accent/12 text-accent"
          aria-hidden="true"
        >
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[0.9375rem] leading-snug text-foreground">{label}</span>
          {status ? (
            <span
              id={statusId}
              className={
                "mt-0.5 block text-xs font-medium " +
                (checked ? "text-accent" : "text-muted-foreground")
              }
            >
              {status}
            </span>
          ) : null}
        </span>
        <span className="relative inline-flex h-[1.9375rem] w-[3.1875rem] shrink-0">
          <input
            type="checkbox"
            checked={checked}
            onChange={(event) => {
              const next = event.target.checked;
              void triggerHaptic(next ? "selection" : "light");
              onChange(next);
            }}
            className="peer absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-full bg-foreground/[0.16] transition-colors duration-[var(--motion-micro)] checked:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card motion-reduce:transition-none"
            aria-required={required || undefined}
            aria-describedby={status ? statusId : undefined}
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-0.5 top-0.5 h-[1.6875rem] w-[1.6875rem] rounded-full bg-white shadow-[var(--as-elevation-1)] transition-transform duration-[var(--motion-micro)] peer-checked:translate-x-5 motion-reduce:transition-none"
          />
        </span>
      </label>

      {expandable ? (
        <div className="pl-11">
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            className="tap-press -ml-2 inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-[0.8125rem] font-semibold text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-expanded={open}
            aria-controls={detailsId}
          >
            {open ? t("consent.readLess") : t("consent.readMore")}
            <ChevronDown
              size={14}
              className={`transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>
          {open ? (
            <div
              id={detailsId}
              className="space-y-2 pb-1 text-[0.8125rem] leading-relaxed text-muted-foreground"
            >
              <p>{expandable.summary}</p>
              <Link
                to={expandable.href}
                className="inline-flex min-h-11 items-center rounded-sm font-semibold text-foreground underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
