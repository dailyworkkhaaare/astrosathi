// Feedback controls for assistant chat bubbles. Kept deliberately quiet: a
// single row of tiny icon-only triggers that share the copy button's line,
// each one 44px-tappable but visually ~16px. Outcome/remedy open a compact
// popover instead of an inline band, so the reading experience never gets a
// permanent "did this come true?" band under every message.

import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { CalendarCheck, Check, Copy, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
const OUTCOME_NEGATIVE: Outcome[] = ["did_not"];

const REMEDY_OPTIONS: { value: RemedyHelped; labelKey: string }[] = [
  { value: "yes", labelKey: "feedback.remedy.yes" },
  { value: "somewhat", labelKey: "feedback.remedy.somewhat" },
  { value: "no", labelKey: "feedback.remedy.no" },
  { value: "not_tried", labelKey: "feedback.remedy.notTried" },
];
const REMEDY_NEGATIVE: RemedyHelped[] = ["no"];

function summarize(content: string): string {
  const trimmed = content.trim();
  return trimmed.length > 140 ? trimmed.slice(0, 140) : trimmed;
}

// A 36px tap target via padding, ~16px visual footprint via a matching
// negative margin — tight, ChatGPT/Claude-mobile-style icon row rather than
// the app's usual 44px primary tap targets (36px still clears the WCAG 2.2
// AA minimum target size of 24px; this row is a quiet secondary affordance,
// not a primary action). Icon-only state is a fixed 36x36 square (so its
// glyph lands in exactly the same slot as the copy/thumbs buttons, keeping
// gaps between all five triggers visually equal); it only grows to fit an
// inline micro-label once a follow-up has been answered.
const triggerIdle = "text-muted-foreground/55 hover:bg-muted/60 hover:text-foreground";
const triggerIconOnly = "tap-press grid h-9 w-9 -my-[10px] place-items-center rounded-full";
const triggerWithLabel =
  "tap-press inline-flex h-9 -my-[10px] items-center gap-1 rounded-full px-1";

function RowIconButton({
  label,
  onClick,
  active,
  activeTone = "accent",
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  activeTone?: "accent" | "destructive";
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        triggerIconOnly,
        "transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? activeTone === "destructive"
            ? "text-destructive-strong"
            : "text-accent"
          : triggerIdle,
        className,
      )}
    >
      {children}
    </button>
  );
}

// Shared shape for the outcome / remedy popover controls: an icon-only
// trigger (gold when answered, with a truncated micro-label of the choice)
// that opens a small single-select chip popover.
function FollowUpControl<TValue extends string>({
  icon,
  triggerLabel,
  popoverTitle,
  options,
  negativeValues,
  value,
  onSelect,
}: {
  icon: ReactNode;
  triggerLabel: string;
  popoverTitle: string;
  options: { value: TValue; labelKey: string }[];
  negativeValues: TValue[];
  value?: TValue;
  onSelect: (value: TValue) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  const isNegative = selected ? negativeValues.includes(selected.value) : false;

  const handleSelect = async (v: TValue) => {
    await onSelect(v);
    window.setTimeout(() => setOpen(false), 250);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={triggerLabel}
          aria-expanded={open}
          className={cn(
            "transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            selected ? triggerWithLabel : triggerIconOnly,
            selected ? (isNegative ? "text-destructive-strong" : "text-accent") : triggerIdle,
          )}
        >
          {icon}
          {selected && (
            <span className="max-w-[4.5rem] truncate text-[10px] font-medium leading-none">
              {t(selected.labelKey)}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={10}
        className="motion-pop w-auto max-w-[15rem] rounded-2xl border-border/60 bg-popover p-3 text-popover-foreground shadow-lg duration-[220ms] ease-[cubic-bezier(0.32,0.72,0,1)]"
      >
        <p className="mb-2 text-[11px] font-medium text-muted-foreground">{popoverTitle}</p>
        <div className="flex max-w-[13rem] flex-wrap gap-1.5">
          {options.map((opt) => {
            const isSelected = opt.value === value;
            const negative = negativeValues.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => void handleSelect(opt.value)}
                aria-pressed={isSelected}
                className={cn(
                  "tap-press min-h-9 rounded-full border px-2.5 text-[11px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isSelected
                    ? negative
                      ? "border-destructive/40 bg-destructive/10 text-destructive-strong"
                      : "border-primary/40 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted",
                )}
              >
                {t(opt.labelKey)}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// The full action row: copy + thumbs always; outcome/remedy triggers only
// when the turn's provenance calls for them. Sits directly under the
// message text, quiet at rest, revealed on hover/focus on desktop.
export function MessageActionRow({
  content,
  copied,
  onCopy,
  messageId,
  conversationId,
  provenance,
  feedback,
  onFeedbackChange,
  surface = "chat",
  topic,
}: {
  content: string;
  copied: boolean;
  onCopy: () => void;
  messageId?: string;
  conversationId: string | null;
  provenance?: Provenance;
  feedback?: FeedbackEntry;
  onFeedbackChange: (messageId: string, patch: Partial<FeedbackEntry>) => void;
  surface?: Surface;
  topic?: Topic;
}) {
  const { t } = useTranslation();
  const [bounce, setBounce] = useState<Rating | null>(null);
  const [ratingBusy, setRatingBusy] = useState(false);
  const predictionSummary = summarize(content);

  const handleRate = async (rating: Rating) => {
    if (ratingBusy || !messageId) return;
    setRatingBusy(true);
    setBounce(rating);
    window.setTimeout(() => setBounce(null), 140);
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
    if (!messageId) return;
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
    }
  };

  const handleRemedy = async (remedyHelped: RemedyHelped) => {
    if (!messageId) return;
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
    <div className="mt-1 flex items-center gap-0.5 opacity-40 transition-opacity duration-[140ms] md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100">
      <RowIconButton label={copied ? t("chat.copied") : t("chat.copy")} onClick={onCopy}>
        {copied ? <Check size={16} className="text-accent" /> : <Copy size={16} />}
      </RowIconButton>

      {messageId && (
        <>
          <RowIconButton
            label={t("feedback.thumbsUp")}
            onClick={() => void handleRate("up")}
            active={feedback?.rating === "up"}
            className={bounce === "up" ? "motion-bounce-tap" : undefined}
          >
            <ThumbsUp
              size={16}
              strokeWidth={2}
              fill={feedback?.rating === "up" ? "currentColor" : "none"}
            />
          </RowIconButton>
          <RowIconButton
            label={t("feedback.thumbsDown")}
            onClick={() => void handleRate("down")}
            active={feedback?.rating === "down"}
            activeTone="destructive"
            className={bounce === "down" ? "motion-bounce-tap" : undefined}
          >
            <ThumbsDown
              size={16}
              strokeWidth={2}
              fill={feedback?.rating === "down" ? "currentColor" : "none"}
            />
          </RowIconButton>

          {provenance?.is_prediction && (
            <FollowUpControl
              icon={<CalendarCheck size={16} />}
              triggerLabel={t("feedback.outcome.ariaLabel")}
              popoverTitle={t("feedback.outcome.ask")}
              options={OUTCOME_OPTIONS}
              negativeValues={OUTCOME_NEGATIVE}
              value={feedback?.outcome}
              onSelect={handleOutcome}
            />
          )}
          {provenance?.has_remedy && (
            <FollowUpControl
              icon={<Sparkles size={16} />}
              triggerLabel={t("feedback.remedy.ariaLabel")}
              popoverTitle={t("feedback.remedy.ask")}
              options={REMEDY_OPTIONS}
              negativeValues={REMEDY_NEGATIVE}
              value={feedback?.remedyHelped}
              onSelect={handleRemedy}
            />
          )}
        </>
      )}
    </div>
  );
}
