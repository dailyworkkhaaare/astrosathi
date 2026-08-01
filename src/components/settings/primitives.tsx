// Shared visual primitives for settings-style screens (grouped card lists,
// segmented controls, toggles, confirm dialogs). Extracted from
// src/routes/settings.tsx so /settings/memory can reuse the exact look.

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function Group({
  title,
  icon,
  children,
  delay,
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  delay?: 1 | 2 | 3 | 4;
}) {
  return (
    <div className={"motion-fade-up" + (delay ? ` motion-delay-${delay}` : "")}>
      <h2 className="mb-2.5 flex items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {icon ? <span className="text-accent">{icon}</span> : null}
        {title}
      </h2>
      <div className="overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-[var(--shadow-soft)]">
        {children}
      </div>
    </div>
  );
}

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 px-4 py-3 min-h-11 md:flex-row md:items-center md:justify-between">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <div className="w-full md:w-auto">{children}</div>
    </div>
  );
}

export function Divider() {
  return <div className="h-px bg-border" role="presentation" />;
}

export function SegmentedGroup<T extends string>({
  name,
  value,
  onChange,
  options,
}: {
  name: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div
      role="radiogroup"
      aria-label={name}
      className="flex w-full md:w-auto rounded-full border border-border bg-muted p-0.5"
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            className={`flex-1 md:flex-initial rounded-full px-3 py-1.5 min-h-[40px] md:min-h-0 text-xs font-medium transition-colors duration-[var(--motion-micro)] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              selected
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({
  id,
  checked,
  onChange,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="grid place-items-center min-h-11 min-w-11 focus:outline-none"
    >
      <span
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-[var(--motion-micro)] focus-visible:ring-2 focus-visible:ring-ring ${
          checked ? "bg-primary" : "bg-muted-foreground/30"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-background shadow transition-transform duration-[var(--motion-micro)] ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}

export function ConfirmDialog({
  title,
  body,
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: string;
  cancelLabel: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-4 sm:items-center"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="confirm-title" className="text-base font-semibold text-foreground">
          {title}
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        <div className="mt-5 flex gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            className="flex-1 border border-border bg-background"
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={onConfirm}
            className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
