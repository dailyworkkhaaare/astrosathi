import type { ReactNode } from "react";

/**
 * Shared celestial-styled wrapper for onboarding steps.
 * Renders a soft nebula gradient panel, step indicator, and serif heading.
 */
export function OnboardingShell({
  step,
  totalSteps = 2,
  eyebrow,
  title,
  subtitle,
  children,
}: {
  step: number;
  totalSteps?: number;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="mx-auto max-w-xl px-4 md:px-6 py-8">
      <div className="motion-fade-up">
        <StepIndicator step={step} total={totalSteps} eyebrow={eyebrow} />
        <h1 className="mt-5 font-display text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground sm:text-base">
            {subtitle}
          </p>
        ) : null}
        <div className="mt-8">{children}</div>
      </div>
    </section>
  );
}

function StepIndicator({
  step,
  total,
  eyebrow,
}: {
  step: number;
  total: number;
  eyebrow?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5" aria-label={`Step ${step} of ${total}`}>
        {Array.from({ length: total }).map((_, i) => {
          const active = i + 1 === step;
          const done = i + 1 < step;
          return (
            <span
              key={i}
              className={
                "h-1.5 rounded-full transition-all " +
                (active ? "w-8 bg-accent" : done ? "w-4 bg-accent/60" : "w-4 bg-border")
              }
            />
          );
        })}
      </div>
      {eyebrow ? (
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {eyebrow}
        </span>
      ) : null}
    </div>
  );
}
