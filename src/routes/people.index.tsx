import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ChevronRight, Plus, Users } from "lucide-react";

import { useRequireOnboarding } from "@/lib/require-auth";
import { useRelatedCharts } from "@/lib/queries";
import { RELATIONS, RELATED_CHARTS_LIMIT, type Relation } from "@/lib/related-charts";

export const Route = createFileRoute("/people/")({
  head: () => ({
    meta: [
      { title: "People — AstroSaathi" },
      {
        name: "description",
        content: "Charts for the people in your life — family, partners and friends.",
      },
    ],
  }),
  component: PeoplePage,
});

function PeoplePage() {
  useRequireOnboarding();
  const { t } = useTranslation();
  const { data: people, isPending } = useRelatedCharts();

  const count = people?.length ?? 0;
  const atLimit = count >= RELATED_CHARTS_LIMIT;

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <div className="motion-fade-up flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl leading-tight tracking-tight text-foreground sm:text-4xl">
            {t("people.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("people.subtitle")}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <Link
          to="/home"
          className="tap-press flex w-full items-center gap-3 px-4 py-3 min-h-11 text-left transition-colors hover:bg-muted focus:outline-none focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
            <Users size={18} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-foreground">
              {t("people.myself")}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {t("people.myselfHint")}
            </span>
          </span>
          <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-muted-foreground" />
        </Link>

        {isPending ? (
          <div className="border-t border-border/60 px-4 py-6">
            <ListSkeleton />
          </div>
        ) : count === 0 ? (
          <p className="border-t border-border/60 px-4 py-6 text-sm text-muted-foreground">
            {t("people.empty")}
          </p>
        ) : (
          (people ?? []).map((p) => (
            <Link
              key={p.id}
              to="/people/$id"
              params={{ id: p.id }}
              className="tap-press flex w-full items-center gap-3 border-t border-border/60 px-4 py-3 min-h-11 text-left transition-colors hover:bg-muted focus:outline-none focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <span className="font-display text-lg">
                  {(p.full_name.trim()[0] ?? "?").toUpperCase()}
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {p.full_name}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {RELATIONS.includes(p.relation as Relation)
                    ? t(`people.relations.${p.relation}`)
                    : p.relation}
                </span>
              </span>
              <ChevronRight
                size={16}
                aria-hidden="true"
                className="shrink-0 text-muted-foreground"
              />
            </Link>
          ))
        )}
      </div>

      {atLimit ? (
        <p className="text-center text-xs text-muted-foreground">{t("people.limitReached")}</p>
      ) : (
        <Link
          to="/people/new"
          className="tap-press flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-dashed border-border px-4 py-3 text-sm font-medium text-foreground transition-colors hover:border-accent/40 hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus size={16} aria-hidden="true" />
          {t("people.addPerson")}
        </Link>
      )}
    </section>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="h-11 w-11 shrink-0 rounded-full bg-primary/10" />
          <div className="space-y-1.5">
            <div className="h-3.5 w-32 rounded bg-primary/10" />
            <div className="h-3 w-20 rounded bg-primary/10" />
          </div>
        </div>
      ))}
    </div>
  );
}
