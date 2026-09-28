// Shared visual primitives for settings-style screens (grouped card lists,
// segmented controls, toggles, confirm dialogs). Extracted from
// src/routes/settings.tsx so /settings/memory can reuse the exact look.

import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

export function SettingsBackHeader({
  title,
  backLabel,
  eyebrow,
  subtitle,
}: {
  title: string;
  backLabel: string;
  eyebrow?: string;
  subtitle?: string;
}) {
  return (
    <header className="motion-fade-up">
      <div className="flex items-start gap-2">
        <Link
          to="/settings"
          aria-label={backLabel}
          className="tap-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </Link>
        <div className="min-w-0 pt-1">
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="font-display text-2xl leading-tight tracking-tight text-foreground sm:text-3xl">
            {title}
          </h1>
        </div>
      </div>
      {subtitle ? (
        <p className="ml-[52px] mt-2 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
          {subtitle}
        </p>
      ) : null}
    </header>
  );
}

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
      <h2 className="mb-2 flex items-center gap-2 px-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {icon ? <span className="text-accent">{icon}</span> : null}
        {title}
      </h2>
      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/85 text-card-foreground shadow-none backdrop-blur md:shadow-[var(--shadow-soft)]">
        {children}
      </div>
    </div>
  );
}

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-12 flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:justify-between">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <div className="w-full md:w-auto">{children}</div>
    </div>
  );
}

export function Divider() {
  return <div className="ml-4 h-px bg-border/70" role="presentation" />;
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
            className={`flex-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-[var(--motion-micro)] min-h-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring md:flex-initial ${
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
  ariaLabel,
  checked,
  onChange,
}: {
  id: string;
  ariaLabel: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-label={ariaLabel}
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="grid min-h-11 min-w-11 place-items-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
  confirmTone = "default",
  onCancel,
  onConfirm,
}: {
  title: string;
  body: string;
  cancelLabel: string;
  confirmLabel: string;
  confirmTone?: "default" | "danger";
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Drawer open onOpenChange={(open) => !open && onCancel()} shouldScaleBackground={false}>
      <DrawerContent
        aria-label={title}
        className="max-h-[min(85dvh,26rem)] sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-sm sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl"
      >
        <DrawerHeader>
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription>{body}</DrawerDescription>
        </DrawerHeader>
        <DrawerFooter className="sm:flex-row">
          <DrawerClose asChild>
            <Button type="button" variant="ghost" className="flex-1 border border-border bg-background">
              {cancelLabel}
            </Button>
          </DrawerClose>
          <Button
            type="button"
            variant={confirmTone === "danger" ? "destructive" : "ghost"}
            onClick={() => void onConfirm()}
            className={
              confirmTone === "danger"
                ? "flex-1"
                : "flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
            }
          >
            {confirmLabel}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
