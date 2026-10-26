import { useNavigate } from "@tanstack/react-router";
import { BookHeart, CalendarDays, Check, MessageCircle, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
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

  const SourceIcon = source?.kind === "event" ? CalendarDays : BookHeart;

  return (
    <Drawer open={source !== null} onOpenChange={handleOpenChange} shouldScaleBackground={false}>
      <DrawerContent
        aria-describedby="journey-ask-description"
        className="bg-background sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[min(42rem,calc(100dvh-2rem))] sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl"
      >
        <DrawerHeader className="flex flex-row items-start justify-between gap-3 px-5 pb-2 pt-3 text-left">
          <div className="min-w-0 pt-1.5">
            <DrawerTitle className="text-xl font-semibold leading-tight">
              {t("journey.askContext.title")}
            </DrawerTitle>
            <DrawerDescription
              id="journey-ask-description"
              className="mt-1 text-[0.8125rem] text-muted-foreground"
            >
              {t("journey.askContext.description")}
            </DrawerDescription>
          </div>
          <DrawerClose asChild>
            <button
              type="button"
              aria-label={t("journey.askContext.cancel")}
              className="tap-press -mr-2 grid h-11 w-11 shrink-0 place-items-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="grid h-8 w-8 place-items-center rounded-full bg-foreground/[0.08] text-muted-foreground">
                <X size={16} aria-hidden="true" />
              </span>
            </button>
          </DrawerClose>
        </DrawerHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3">
          {source && (
            <>
              <h3 className={SECTION_LABEL}>{t("journey.askContext.included")}</h3>
              <ul className="list-hairline overflow-hidden rounded-[0.875rem] bg-card shadow-[var(--as-elevation-1)] [--list-inset:4rem]">
                <li className="flex min-h-[3.75rem] items-center gap-3.5 px-4 py-2.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[0.625rem] bg-accent/12 text-accent">
                    <Sparkles size={17} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-base text-foreground">
                      {t("journey.askContext.aboutSelf")}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {t("journey.askContext.alwaysIncluded")}
                    </span>
                  </span>
                  <Check size={18} className="shrink-0 text-accent" aria-hidden="true" />
                </li>
                <li className="flex min-h-[3.75rem] items-center gap-3.5 px-4 py-2.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[0.625rem] bg-accent/12 text-accent">
                    <SourceIcon size={17} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base text-foreground">{source.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {sourceLabel} · {source.date}
                    </span>
                  </span>
                  <Check size={18} className="shrink-0 text-accent" aria-hidden="true" />
                </li>
              </ul>
              <p className="mt-2 px-1 text-xs leading-relaxed text-muted-foreground">
                <span className="font-semibold text-foreground">
                  {t("journey.askContext.notIncluded")}:
                </span>{" "}
                {t("journey.askContext.notIncludedBody")}
              </p>

              <h3 className={`${SECTION_LABEL} mt-5`}>{t("journey.askContext.draft")}</h3>
              <p className="max-h-44 overflow-y-auto whitespace-pre-wrap rounded-[0.875rem] bg-card px-4 py-3 text-[0.9375rem] leading-relaxed text-foreground shadow-[var(--as-elevation-1)]">
                {source.draft}
              </p>
              <p className="mt-2 px-1 text-xs leading-relaxed text-muted-foreground">
                {t("journey.askContext.contextNote")}
              </p>
            </>
          )}

          {error && (
            <p className="mt-3 px-1 text-sm text-feedback-warning" role="alert">
              {error}
            </p>
          )}
        </div>

        <DrawerFooter className="gap-1 px-4 pb-[calc(0.75rem+var(--as-safe-bottom))] pt-2">
          <button
            type="button"
            onClick={continueToAsk}
            className="tap-press inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--as-color-action-ask)] px-5 text-base font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <MessageCircle size={17} aria-hidden="true" />
            {t("journey.askContext.continue")}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="tap-press inline-flex min-h-11 w-full items-center justify-center rounded-full px-4 text-[0.9375rem] font-semibold text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("journey.askContext.cancel")}
          </button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

const SECTION_LABEL =
  "mb-2 px-1 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground [:lang(hi)_&]:tracking-normal [:lang(mr)_&]:tracking-normal";
