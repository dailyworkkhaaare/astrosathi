import { useId, type AriaRole, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export type StateScope = "inline" | "panel" | "page";
export type StateTone = "loading" | "empty" | "error";

const scopeClasses: Record<StateScope, string> = {
  inline: "min-h-20 flex-row flex-wrap items-center gap-4 px-4 py-3 text-left sm:flex-nowrap",
  panel:
    "mx-auto min-h-56 max-w-2xl flex-col items-center justify-center gap-4 px-6 py-9 text-center sm:px-10",
  page: "mx-auto min-h-[min(32rem,70dvh)] max-w-3xl flex-col items-center justify-center gap-5 px-6 py-12 text-center",
};

const glyphClasses: Record<StateTone, string> = {
  loading:
    "border-action-intelligence/25 bg-action-intelligence/10 text-action-intelligence shadow-[0_16px_36px_-22px_var(--as-color-action-intelligence)]",
  empty:
    "border-action-warm/30 bg-action-warm/15 text-action-warm shadow-[0_16px_36px_-22px_var(--as-color-action-warm)]",
  error:
    "border-feedback-danger/25 bg-feedback-danger/10 text-feedback-danger shadow-[0_16px_36px_-22px_var(--as-color-feedback-danger)]",
};

const edgeClasses: Record<StateTone, string> = {
  loading: "bg-[var(--as-gradient-aurora-live)]",
  empty: "bg-[var(--as-gradient-solar-reveal)]",
  error: "bg-feedback-danger/65",
};

export function StateFrame({
  scope = "panel",
  tone,
  icon,
  title,
  description,
  action,
  role,
  live,
  busy,
  className,
}: {
  scope?: StateScope;
  tone: StateTone;
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  role?: AriaRole;
  live?: "polite" | "assertive";
  busy?: boolean;
  className?: string;
}) {
  const id = useId();
  const titleId = `${id}-title`;
  const descriptionId = description ? `${id}-description` : undefined;
  const inline = scope === "inline";

  return (
    <div
      role={role}
      aria-live={live}
      aria-busy={busy}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      data-state={tone}
      data-scope={scope}
      className={cn(
        "motion-local-enter relative isolate flex w-full overflow-hidden rounded-card border border-border-strong/55 bg-card text-foreground shadow-[var(--as-elevation-1)]",
        scopeClasses[scope],
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn("absolute inset-x-6 top-0 h-px opacity-80", edgeClasses[tone])}
      />
      <div
        aria-hidden="true"
        className={cn(
          "relative flex size-14 shrink-0 items-center justify-center rounded-[1.125rem] border",
          inline && "size-11 rounded-[0.875rem]",
          glyphClasses[tone],
        )}
      >
        {icon}
      </div>
      <div className={cn("min-w-0", inline ? "flex-1" : "max-w-md")}>
        <h2
          id={titleId}
          className={cn(
            "font-display font-semibold text-foreground",
            inline ? "text-base leading-snug" : "text-title-sm",
          )}
        >
          {title}
        </h2>
        {description && (
          <p
            id={descriptionId}
            className={cn(
              "text-pretty text-muted-foreground",
              inline ? "mt-0.5 text-body-sm" : "mt-2 text-body-sm",
            )}
          >
            {description}
          </p>
        )}
      </div>
      {action && <div className={cn("shrink-0", inline ? "ml-auto" : "mt-1")}>{action}</div>}
    </div>
  );
}
