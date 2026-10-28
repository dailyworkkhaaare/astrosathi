// Shared visual primitives for settings-style screens (grouped card lists,
// segmented controls, toggles, confirm dialogs). Extracted from
// src/routes/settings.tsx so /settings/memory can reuse the exact look.

import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
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
  subtitle,
}: {
  title: string;
  backLabel: string;
  /** Kept for callers; the native header no longer shows an eyebrow. */
  eyebrow?: string;
  subtitle?: string;
}) {
  const { t } = useTranslation();
  return (
    <header className="motion-fade-up">
      <nav className="-mx-2 -mt-2 flex min-h-11 items-center">
        <Link
          to="/settings"
          aria-label={backLabel}
          className="tap-press inline-flex h-11 items-center gap-0.5 rounded-full pl-1 pr-3 text-[1.0625rem] text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronLeft size={22} aria-hidden="true" />
          {t("settings.title")}
        </Link>
      </nav>
      <h1 className="large-title mt-1 text-foreground">{title}</h1>
      {subtitle ? (
        <p className="mt-1.5 max-w-xl text-[0.9375rem] leading-snug text-muted-foreground">
          {subtitle}
        </p>
      ) : null}
    </header>
  );
}

/** A titled inset-grouped list: small uppercase label over a rounded card of rows. */
export function Group({
  title,
  children,
  footer,
  delay,
}: {
  title: string;
  /** Kept for callers; native groups are labelled by text only. */
  icon?: ReactNode;
  children: ReactNode;
  /** Short footnote under the card. */
  footer?: ReactNode;
  delay?: 1 | 2 | 3 | 4;
}) {
  return (
    <div className={"motion-fade-up" + (delay ? ` motion-delay-${delay}` : "")}>
      <h2 className="mb-2 px-4 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground [:lang(hi)_&]:tracking-normal [:lang(mr)_&]:tracking-normal">
        {title}
      </h2>
      <div className="overflow-hidden rounded-[0.875rem] bg-card text-card-foreground shadow-[var(--as-elevation-1)]">
        {children}
      </div>
      {footer ? (
        <p className="mt-2 px-4 text-[0.8125rem] leading-snug text-muted-foreground">{footer}</p>
      ) : null}
    </div>
  );
}

/** Small rounded icon square that leads a settings row. */
export function IconTile({ children, tone }: { children: ReactNode; tone?: "warning" }) {
  return (
    <span
      aria-hidden="true"
      className={
        "grid h-[1.875rem] w-[1.875rem] shrink-0 place-items-center rounded-[0.5rem] " +
        (tone === "warning"
          ? "bg-destructive/12 text-destructive-strong"
          : "bg-accent/12 text-accent")
      }
    >
      {children}
    </span>
  );
}

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-12 flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <span className="text-base text-foreground">{label}</span>
      <div className="w-full sm:w-auto">{children}</div>
    </div>
  );
}

export function Divider() {
  return <div className="ml-4 h-px bg-[var(--as-list-separator)]" role="presentation" />;
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
      className="flex w-full gap-0.5 rounded-[0.625rem] bg-foreground/[0.07] p-0.5 sm:w-auto"
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
            className={`min-h-10 flex-1 rounded-[0.5rem] px-3 text-[0.8125rem] font-semibold leading-tight transition-colors duration-[var(--motion-micro)] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:flex-initial ${
              selected
                ? "bg-background text-foreground shadow-[var(--as-elevation-1)] dark:bg-foreground/[0.16]"
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
      className="grid min-h-11 min-w-11 shrink-0 place-items-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        className={`relative inline-flex h-[1.9375rem] w-[3.1875rem] shrink-0 rounded-full transition-colors duration-[var(--motion-micro)] motion-reduce:transition-none ${
          checked ? "bg-accent" : "bg-foreground/[0.16]"
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-[1.6875rem] w-[1.6875rem] rounded-full bg-white shadow-[var(--as-elevation-1)] transition-transform duration-[var(--motion-micro)] motion-reduce:transition-none ${
            checked ? "translate-x-5" : "translate-x-0"
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
        className="max-h-[min(85dvh,26rem)] bg-background sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-sm sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl"
      >
        <DrawerHeader className="px-5 pb-2 pt-3 text-center">
          <DrawerTitle className="text-[1.0625rem] font-semibold">{title}</DrawerTitle>
          <DrawerDescription className="text-[0.8125rem] leading-snug text-muted-foreground">
            {body}
          </DrawerDescription>
        </DrawerHeader>
        <DrawerFooter className="gap-2 px-4 pb-[calc(0.75rem+var(--as-safe-bottom))] pt-2">
          <button
            type="button"
            onClick={() => void onConfirm()}
            className={`tap-press inline-flex min-h-12 w-full items-center justify-center rounded-full px-4 text-base font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              confirmTone === "danger"
                ? "bg-destructive/15 text-destructive-strong"
                : "bg-accent/15 text-accent"
            }`}
          >
            {confirmLabel}
          </button>
          <DrawerClose asChild>
            <button
              type="button"
              className="tap-press inline-flex min-h-12 w-full items-center justify-center rounded-full bg-foreground/[0.07] px-4 text-base font-semibold text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {cancelLabel}
            </button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
