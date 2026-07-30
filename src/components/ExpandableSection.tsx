import { ChevronDown, type LucideIcon } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function ExpandableSection({
  title,
  defaultOpen = false,
  icon: Icon,
  badge,
  children,
  className,
}: {
  title: string;
  defaultOpen?: boolean;
  icon?: LucideIcon;
  badge?: string | number;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <Card className={cn("rounded-2xl p-0", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={contentId}
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl px-5 py-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          {Icon && (
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/15">
              <Icon size={15} className="text-accent" aria-hidden="true" />
            </span>
          )}
          <span className="truncate text-base font-semibold leading-tight text-foreground">
            {title}
          </span>
          {badge != null && (
            <span className="inline-flex shrink-0 items-center rounded-full border border-border/80 bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {badge}
            </span>
          )}
        </span>
        <ChevronDown
          size={18}
          aria-hidden="true"
          className={cn(
            "shrink-0 text-muted-foreground transition-transform",
            open ? "rotate-180" : "",
          )}
        />
      </button>
      {open && (
        <div id={contentId} className="motion-fade-up px-5 pb-5">
          {children}
        </div>
      )}
    </Card>
  );
}
