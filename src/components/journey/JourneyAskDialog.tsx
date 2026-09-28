import { useNavigate } from "@tanstack/react-router";
import { MessageCircle, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

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
import { storeJourneyAskDraft } from "@/lib/journey-ask";

export type JourneyAskSource = {
  kind: "event" | "reflection";
  title: string;
  date: string;
  draft: string;
};

export function JourneyAskDialog({
  source,
  onClose,
}: {
  source: JourneyAskSource | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setError(null), [source?.draft]);

  const handleOpenChange = (open: boolean) => {
    if (!open) onClose();
  };

  const continueToAsk = () => {
    if (!source) return;
    const sourceLabel = t(
      source.kind === "event"
        ? "journey.askContext.eventSource"
        : "journey.askContext.reflectionSource",
    );
    const token = storeJourneyAskDraft({ draft: source.draft, sourceLabel });
    if (!token) {
      setError(t("journey.askContext.storageError"));
      return;
    }
    onClose();
    void navigate({ to: "/chat", search: { journeyDraft: token } });
  };

  const sourceLabel = source
    ? t(
        source.kind === "event"
          ? "journey.askContext.eventSource"
          : "journey.askContext.reflectionSource",
      )
    : "";

  return (
    <Drawer open={source !== null} onOpenChange={handleOpenChange} shouldScaleBackground={false}>
      <DrawerContent
        aria-describedby="journey-ask-description"
        className="bg-card sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[min(42rem,calc(100dvh-2rem))] sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl"
      >
        <DrawerHeader className="flex flex-row items-start justify-between gap-4 px-5 pb-4 pt-5 text-left sm:px-6">
          <div className="min-w-0">
            <p className="as-micro text-primary">{t("journey.askContext.eyebrow")}</p>
            <DrawerTitle className="pr-8 font-display text-2xl leading-tight">
              {t("journey.askContext.title")}
            </DrawerTitle>
            <DrawerDescription id="journey-ask-description" className="leading-relaxed">
              {t("journey.askContext.description")}
            </DrawerDescription>
          </div>
          <DrawerClose asChild>
            <button
              type="button"
              aria-label={t("journey.askContext.cancel")}
              className="tap-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </DrawerClose>
        </DrawerHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 sm:px-6">
          {source && (
            <>
              <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-2xl border border-border bg-muted/45 px-3.5 py-3 text-sm sm:mt-0">
                <dt className="font-medium text-muted-foreground">
                  {t("journey.askContext.about")}
                </dt>
                <dd className="min-w-0 text-right font-medium text-foreground">
                  {t("journey.askContext.aboutSelf")}
                </dd>
                <dt className="font-medium text-muted-foreground">
                  {t("journey.askContext.when")}
                </dt>
                <dd className="min-w-0 text-right text-foreground">{source.date}</dd>
                <dt className="font-medium text-muted-foreground">
                  {t("journey.askContext.from")}
                </dt>
                <dd className="min-w-0 text-right text-foreground">{sourceLabel}</dd>
              </dl>

              <section className="mt-4 space-y-1.5">
                <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {t("journey.askContext.included")}
                </h3>
                <p className="text-sm leading-relaxed text-foreground">
                  {source.kind === "event"
                    ? t("journey.askContext.eventIncluded", { title: source.title })
                    : t("journey.askContext.reflectionIncluded", { title: source.title })}
                </p>
                <h3 className="pt-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {t("journey.askContext.notIncluded")}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {t("journey.askContext.notIncludedBody")}
                </p>
              </section>

              <section className="mt-4 space-y-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {t("journey.askContext.draft")}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {t("journey.askContext.draftHint")}
                  </p>
                </div>
                <p className="max-h-44 overflow-y-auto whitespace-pre-wrap rounded-2xl border border-primary/20 bg-primary/[0.06] px-3.5 py-3 text-sm leading-relaxed text-foreground">
                  {source.draft}
                </p>
              </section>

              <div className="mt-4 flex gap-2 rounded-2xl border border-accent/20 bg-accent/[0.06] px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
                <MessageCircle
                  size={15}
                  className="mt-0.5 shrink-0 text-accent"
                  aria-hidden="true"
                />
                <p>{t("journey.askContext.contextNote")}</p>
              </div>
            </>
          )}

          {error && (
            <p className="mt-4 text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>

        <DrawerFooter className="gap-2 px-5 sm:flex-row sm:px-6">
          <Button type="button" variant="outline" onClick={onClose}>
            {t("journey.askContext.cancel")}
          </Button>
          <Button type="button" variant="primary" onClick={continueToAsk} className="gap-2">
            <MessageCircle size={15} aria-hidden="true" />
            {t("journey.askContext.continue")}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
