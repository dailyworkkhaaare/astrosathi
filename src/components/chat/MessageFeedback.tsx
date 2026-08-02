// Feedback controls for assistant chat bubbles: thumbs rating (shares the
// copy-button row) plus contextual outcome/remedy follow-up chips. Pure UI
// over src/lib/feedback.ts — no new backend calls.

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ThumbsDown, ThumbsUp } from "lucide-react";
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
  has_remedy: boolean;
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

// Thumbs up/down — rendered inline in the same action row as the copy
// button, matching its compact icon-button styling.
export function RatingButtons({
  messageId,
  conversationId,
  content,
  feedback,
  onFeedbackChange,
  surface = "chat",
  topic,
}: {
  messageId: string;
  conversationId: string | null;
  content: string;
  feedback?: FeedbackEntry;
  onFeedbackChange: (messageId: string, patch: Partial<FeedbackEntry>) => void;
  surface?: Surface;
  topic?: Topic;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const predictionSummary = summarize(content);

  const handleRate = async (rating: Rating) => {
    if (busy) return;
    setBusy(true);
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
    setBusy(false);
    if (!res.ok) {
      onFeedbackChange(messageId, { rating: prevRating });
      toast.error(t("feedback.toastError"));
      return;
    }
    onFeedbackChange(messageId, { rating: res.cleared ? undefined : rating });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void handleRate("up")}
        aria-label={t("feedback.thumbsUp")}
        aria-pressed={feedback?.rating === "up"}
        className={cn(
          "rounded-md p-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          feedback?.rating === "up"
            ? "text-accent"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <ThumbsUp
          size={14}
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
          "rounded-md p-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          feedback?.rating === "down"
            ? "text-destructive-strong"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <ThumbsDown
          size={14}
          strokeWidth={2}
          fill={feedback?.rating === "down" ? "currentColor" : "none"}
        />
      </button>
    </>
  );
}

// Contextual outcome ("did this come true?") and remedy ("did it help?")
// follow-ups. Each renders only when the turn's provenance calls for it.
export function MessageFollowUps({
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
  const predictionSummary = summarize(content);

  const showOutcome = provenance?.is_prediction === true;
  const showRemedy = provenance?.has_remedy === true;
  if (!showOutcome && !showRemedy) return null;

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

  return (
    <div className="mt-2 flex flex-col gap-1.5">
      {showOutcome && (
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
      {showRemedy && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground">{t("feedback.remedy.ask")}</span>
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
      )}
    </div>
  );
}
