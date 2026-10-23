import { useRouter } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

/** Onboarding runs Language → Sign in → Consent → About you → Birth details. */
export const ONBOARDING_STEPS = 5;

/**
 * Native onboarding frame: back chevron, segmented progress with a visible
 * "Step N of 5", a large title, and an optional footer pinned above the home
 * indicator for the step's primary action.
 */
export function OnboardingShell({
  step,
  totalSteps = ONBOARDING_STEPS,
  eyebrow,
  title,
  subtitle,
  onBack,
  showBack = true,
  footer,
  children,
}: {
  step: number;
  totalSteps?: number;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  /** Overrides history-back, e.g. to return to a previous in-page stage. */
  onBack?: () => void;
  showBack?: boolean;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const goBack = onBack ?? (() => router.history.back());

  return (
    <section className="mx-auto flex min-h-[calc(100dvh-var(--as-safe-top)-2.5rem)] max-w-xl flex-col md:min-h-0">
      <div className="flex min-h-11 items-center gap-2 px-1">
        {showBack ? (
          <button
            type="button"
            onClick={goBack}
            aria-label={t("common.back")}
            className="tap-press -ml-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronLeft size={26} strokeWidth={2.2} aria-hidden="true" />
          </button>
        ) : null}
        <StepIndicator step={step} total={totalSteps} />
      </div>

      <div className="motion-fade-up flex flex-1 flex-col px-1 pt-3">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="large-title mt-1 text-foreground">{title}</h1>
        {subtitle ? (
          <p className="mt-2 max-w-prose text-pretty text-[0.9375rem] leading-snug text-muted-foreground">
            {subtitle}
          </p>
        ) : null}
        <div className="mt-6 flex-1">{children}</div>
      </div>

      {footer ? (
        <div className="sticky bottom-0 z-10 -mx-4 mt-6 bg-gradient-to-t from-background via-background/95 to-background/0 px-4 pb-[calc(0.75rem+var(--as-safe-bottom))] pt-4 sm:mx-0 sm:px-1 md:static md:bg-none md:pb-0">
          {footer}
        </div>
      ) : null}
    </section>
  );
}

function StepIndicator({ step, total }: { step: number; total: number }) {
  const { t } = useTranslation();
  const label = t("common.stepOf", { current: step, total });
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3 pr-1">
      <div className="flex flex-1 gap-1.5" aria-hidden="true">
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className={
              "h-1 flex-1 rounded-full transition-colors " +
              (i < step ? "bg-accent" : "bg-foreground/[0.14]")
            }
          />
        ))}
      </div>
      <span className="shrink-0 text-[0.8125rem] font-semibold text-muted-foreground">{label}</span>
    </div>
  );
}
