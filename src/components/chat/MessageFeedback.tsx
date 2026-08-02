// Trust + feedback footer for assistant chat bubbles: thumbs rating,
// confidence chip, "why this?" provenance disclosure, outcome + remedy
// follow-ups. Pure UI over src/lib/feedback.ts — no new backend calls.

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ChevronDown, ThumbsDown, ThumbsUp } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  submitOutcome,
  submitRating,
  submitRemedyFeedback,
  type Outcome,
  type Rating,
  type RemedyHelped,
  type Surface,
  type Topic,
} from "@/lib/feedback";

export type Provenance = {
  version: number;
  confidence: "high" | "medium" | "low" | null;
  is_prediction: boolean;
  chart_loaded: boolean;
  basis: string[];
};

export type FeedbackEntry = {
  rating?: Rating;
  outcome?: Outcome;
  remedyHelped?: RemedyHelped;
};

const OUTCOME_OPTIONS: { value: Outcome; labelKey: string }[] = [
  { value: "happened", labelKey: "feedback.outcome.happened" },
  { value: "partly", labelKey: "feedback.outcome.partly" },
  { value: "not_yet", labelKey: "feedback.outcome.notYet" },
  { value: "did_not", labelKey: "feedback.outcome.didNot" },
];

const REMEDY_OPTIONS: { value: RemedyHelped; labelKey: string }[] = [
  { value: "yes", labelKey: "feedback.remedy.yes" },
  { value: "somewhat", labelKey: "feedback.remedy.somewhat" },
  { value: "no", labelKey: "feedback.remedy.no" },
  { value: "not_tried", labelKey: "feedback.remedy.notTried" },
];

function summarize(content: string): string {
  const trimmed = content.trim();
  return trimmed.length > 140 ? trimmed.slice(0, 140) : trimmed;
}

const chipBase =
  "tap-press min-h-11 rounded-full border px-3 text-[11px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const chipActive = "border-primary/40 bg-primary/10 text-primary";
const chipIdle = "border-border text-muted-foreground hover:bg-muted";

export function MessageFeedback({
  messageId,
  conversationId,
  content,
  provenance,
  feedback,
  onFeedbackChange,
  surface = "chat",
  topic,
}: {
  messageId: string;
  conversationId: string | null;
  content: string;
  provenance?: Provenance;
  feedback?: FeedbackEntry;
  onFeedbackChange: (messageId: string, patch: Partial<FeedbackEntry>) => void;
  surface?: Surface;
  topic?: Topic;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [ratingBusy, setRatingBusy] = useState(false);

  const predictionSummary = summarize(content);

  const handleRate = async (rating: Rating) => {
    if (ratingBusy) return;
    setRatingBusy(true);
    const prevRating = feedback?.rating;
    const willClear = prevRating === rating;
    onFeedbackChange(messageId, { rating: willClear ? undefined : rating });
    const res = await submitRating({
      messageId,
      conversationId: conversationId ?? undefined,
      rating,
      topic,
      predictionSummary,
      surface,
    });
    setRatingBusy(false);
    if (!res.ok) {
      onFeedbackChange(messageId, { rating: prevRating });
      toast.error(t("feedback.toastError"));
      return;
    }
    onFeedbackChange(messageId, { rating: res.cleared ? undefined : rating });
  };

  const handleOutcome = async (outcome: Outcome) => {
    const prev = feedback?.outcome;
    onFeedbackChange(messageId, { outcome });
    const res = await submitOutcome({
      messageId,
      conversationId: conversationId ?? undefined,
      outcome,
      topic,
      predictionSummary,
      surface,
    });
    if (!res.ok) {
      onFeedbackChange(messageId, { outcome: prev });
      toast.error(t("feedback.toastError"));
      return;
    }
    toast.success(t("feedback.outcome.saved"));
  };

  const handleRemedy = async (remedyHelped: RemedyHelped) => {
    const prev = feedback?.remedyHelped;
    onFeedbackChange(messageId, { remedyHelped });
    const res = await submitRemedyFeedback({
      messageId,
      conversationId: conversationId ?? undefined,
      remedyHelped,
      topic,
      surface: "remedy",
    });
    if (!res.ok) {
      onFeedbackChange(messageId, { remedyHelped: prev });
      toast.error(t("feedback.toastError"));
    }
  };

  const confidence = provenance?.confidence ?? null;

  return (
    <div className="mt-2.5 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={() => void handleRate("up")}
          aria-label={t("feedback.thumbsUp")}
          aria-pressed={feedback?.rating === "up"}
          className={cn(
            "tap-press grid h-11 w-11 place-items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            feedback?.rating === "up"
              ? "bg-accent/15 text-accent"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <ThumbsUp
            size={15}
            strokeWidth={2}
            fill={feedback?.rating === "up" ? "currentColor" : "none"}
          />
        </button>
        <button
          type="button"
          onClick={() => void handleRate("down")}
          aria-label={t("feedback.thumbsDown")}
          aria-pressed={feedback?.rating === "down"}
          className={cn(
            "tap-press grid h-11 w-11 place-items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            feedback?.rating === "down"
              ? "bg-destructive/15 text-destructive-strong"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <ThumbsDown
            size={15}
            strokeWidth={2}
            fill={feedback?.rating === "down" ? "currentColor" : "none"}
          />
        </button>

        {confidence && (
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium",
              confidence === "high" && "border-accent/25 bg-accent/10 text-accent",
              confidence === "medium" && "border-border bg-muted text-muted-foreground",
              confidence === "low" &&
                "border-destructive/30 bg-destructive/10 text-destructive-strong",
            )}
          >
            {t(`feedback.confidence.${confidence}`)}
          </span>
        )}

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="tap-press inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t("feedback.whyThis")}
          <ChevronDown size={13} className={cn("transition-transform", open && "rotate-180")} />
        </button>
      </div>

      {provenance?.is_prediction && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground">{t("feedback.outcome.ask")}</span>
          {OUTCOME_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => void handleOutcome(opt.value)}
              aria-pressed={feedback?.outcome === opt.value}
              className={cn(chipBase, feedback?.outcome === opt.value ? chipActive : chipIdle)}
            >
              {t(opt.labelKey)}
            </button>
          ))}
        </div>
      )}

      {open && (
        <div className="motion-fade-in rounded-2xl border border-border/60 bg-muted/30 px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">
          {provenance?.chart_loaded === false ? (
            <p>{t("feedback.basis.noChart")}</p>
          ) : provenance?.basis && provenance.basis.length > 0 ? (
            <>
              <p className="mb-1.5 font-semibold text-foreground/80">
                {t("feedback.basis.title")}
              </p>
              <ul className="list-disc space-y-1 pl-4">
                {provenance.basis.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </>
          ) : (
            <p>{t("feedback.basis.none")}</p>
          )}

          <div className="mt-3 border-t border-border/50 pt-3">
            <p className="mb-1.5 text-muted-foreground">{t("feedback.remedy.ask")}</p>
            <div className="flex flex-wrap gap-1.5">
              {REMEDY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => void handleRemedy(opt.value)}
                  aria-pressed={feedback?.remedyHelped === opt.value}
                  className={cn(
                    chipBase,
                    feedback?.remedyHelped === opt.value ? chipActive : chipIdle,
                  )}
                >
                  {t(opt.labelKey)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
