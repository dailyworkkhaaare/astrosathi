import { Link } from "@tanstack/react-router";
import { Check, ChevronDown, Clock3, Orbit, UserRound, UsersRound } from "lucide-react";
import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { useTranslation } from "react-i18next";

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useRelatedCharts } from "@/lib/queries";

type LensKind = "subject" | "time";

type SubjectContext = {
  kind: "self" | "person" | "relationship" | "unavailable";
  label: string;
  detail: string;
  initial?: string;
};

export function ContextDock({ pathname }: { pathname: string }) {
  const { t } = useTranslation();
  const personId = personIdFromPath(pathname);
  const { data: people, isPending } = useRelatedCharts();
  const person = personId ? people?.find((candidate) => candidate.id === personId) : undefined;
  const isRelationship = !!personId && pathname.endsWith("/compatibility");
  const subject = resolveSubject({
    personId,
    personName: person?.full_name,
    isPending,
    isRelationship,
    t,
  });
  const showTime = !pathname.startsWith("/people");
  const timeApplied = pathname === "/today" || pathname.startsWith("/today/");

  return (
    <section
      aria-label={t("contextDock.currentContext")}
      className="relative z-20 mb-6 flex min-h-11 items-center gap-2 pr-14 md:mb-7 md:justify-end md:pr-0"
    >
      <LensShell
        kind="subject"
        label={t("contextDock.subject")}
        value={subject.label}
        initial={subject.initial}
        details={{
          title: t("contextDock.subjectTitle"),
          description: subject.detail,
          applied: subject.kind !== "unavailable",
          status:
            subject.kind === "unavailable"
              ? t("contextDock.unavailable")
              : t("contextDock.applied"),
          destinationLabel: t("contextDock.managePeople"),
        }}
      />

      {showTime ? (
        <LensShell
          kind="time"
          label={t("contextDock.time")}
          value={timeApplied ? t("contextDock.today") : t("contextDock.notApplied")}
          details={{
            title: t("contextDock.timeTitle"),
            description: t(
              timeApplied ? "contextDock.todayDetail" : "contextDock.timeUnsupportedDetail",
            ),
            applied: timeApplied,
            status: timeApplied ? t("contextDock.applied") : t("contextDock.notApplied"),
          }}
        />
      ) : null}
    </section>
  );
}

function LensShell({
  kind,
  label,
  value,
  initial,
  details,
}: {
  kind: LensKind;
  label: string;
  value: string;
  initial?: string;
  details: LensDetailsProps;
}) {
  const trigger = <LensTrigger kind={kind} label={label} value={value} initial={initial} />;

  return (
    <>
      <div className="md:hidden">
        <Drawer>
          <DrawerTrigger asChild>{trigger}</DrawerTrigger>
          <DrawerContent className="rounded-t-[1.75rem] border-border bg-background px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <LensDetails {...details} surface="drawer" />
          </DrawerContent>
        </Drawer>
      </div>
      <div className="hidden md:block">
        <Popover>
          <PopoverTrigger asChild>{trigger}</PopoverTrigger>
          <PopoverContent
            align="end"
            className="w-80 rounded-2xl border-border bg-popover p-0 shadow-[var(--shadow-elevated)]"
          >
            <LensDetails {...details} surface="popover" />
          </PopoverContent>
        </Popover>
      </div>
    </>
  );
}

type LensTriggerProps = {
  kind: LensKind;
  label: string;
  value: string;
  initial?: string;
} & ComponentPropsWithoutRef<"button">;

const LensTrigger = forwardRef<HTMLButtonElement, LensTriggerProps>(function LensTrigger(
  { kind, label, value, initial, ...buttonProps },
  ref,
) {
  const Icon = kind === "subject" ? UserRound : Clock3;
  return (
    <button
      ref={ref}
      {...buttonProps}
      type="button"
      aria-label={`${label}: ${value}`}
      className="tap-press flex min-h-11 min-w-0 items-center gap-2 rounded-2xl border border-border/70 bg-card/80 px-3 text-left shadow-[var(--shadow-soft)] backdrop-blur transition-colors hover:bg-card focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
        {initial ? (
          <span className="font-display text-xs" aria-hidden="true">
            {initial}
          </span>
        ) : (
          <Icon size={15} aria-hidden="true" />
        )}
      </span>
      <span className="min-w-0">
        <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </span>
        <span className="block max-w-28 truncate text-xs font-semibold text-foreground sm:max-w-40">
          {value}
        </span>
      </span>
      <ChevronDown size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />
    </button>
  );
});

type LensDetailsProps = {
  title: string;
  description: string;
  applied: boolean;
  status: string;
  destinationLabel?: string;
};

function LensDetails({
  title,
  description,
  applied,
  status,
  destinationLabel,
  surface,
}: LensDetailsProps & { surface: "drawer" | "popover" }) {
  const header =
    surface === "drawer" ? (
      <DrawerHeader className="px-5 pb-3 pt-6 text-left">
        <DrawerTitle className="font-display text-xl">{title}</DrawerTitle>
        <DrawerDescription className="leading-relaxed">{description}</DrawerDescription>
      </DrawerHeader>
    ) : (
      <div className="px-5 pb-3 pt-5">
        <h2 className="font-display text-xl font-semibold leading-none tracking-tight">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
    );

  return (
    <div>
      {header}
      <div className="px-5 pb-5">
        <div className="flex min-h-11 items-center gap-3 rounded-xl bg-muted/60 px-3 text-sm font-medium text-foreground">
          <span
            className={
              "grid h-7 w-7 place-items-center rounded-full " +
              (applied ? "bg-accent/15 text-accent" : "bg-background text-muted-foreground")
            }
          >
            {applied ? (
              <Check size={15} aria-hidden="true" />
            ) : (
              <Orbit size={15} aria-hidden="true" />
            )}
          </span>
          {status}
        </div>
        {destinationLabel ? (
          <Link
            to="/people"
            className="tap-press mt-3 flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold text-foreground hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <UsersRound size={16} aria-hidden="true" />
            {destinationLabel}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function personIdFromPath(pathname: string) {
  const match = pathname.match(/^\/people\/([^/]+)/);
  const candidate = match?.[1];
  return candidate && candidate !== "new" ? decodeURIComponent(candidate) : undefined;
}

function resolveSubject({
  personId,
  personName,
  isPending,
  isRelationship,
  t,
}: {
  personId?: string;
  personName?: string;
  isPending: boolean;
  isRelationship: boolean;
  t: ReturnType<typeof useTranslation>["t"];
}): SubjectContext {
  if (!personId) {
    return {
      kind: "self",
      label: t("contextDock.myChart"),
      detail: t("contextDock.selfDetail"),
    };
  }
  if (isPending) {
    return {
      kind: "unavailable",
      label: t("contextDock.resolvingSubject"),
      detail: t("contextDock.resolvingSubjectDetail"),
    };
  }
  if (!personName) {
    return {
      kind: "unavailable",
      label: t("contextDock.subjectUnavailable"),
      detail: t("contextDock.subjectUnavailableDetail"),
    };
  }
  return {
    kind: isRelationship ? "relationship" : "person",
    label: isRelationship ? t("contextDock.relationshipWith", { name: personName }) : personName,
    detail: t(isRelationship ? "contextDock.relationshipDetail" : "contextDock.personDetail", {
      name: personName,
    }),
    initial: personName.trim()[0]?.toUpperCase(),
  };
}
