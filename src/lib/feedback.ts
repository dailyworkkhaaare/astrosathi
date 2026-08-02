// Feedback capture data layer for user_prediction_feedback. Owner-scoped via
// RLS (auth.uid() = user_id); every write also sets user_id explicitly.
//
// No supabase upsert() here: the table's partial unique index on
// (user_id, message_id) WHERE feedback_kind='rating' can't be expressed via
// onConflict, so toggles use delete-then-insert instead.

import { supabase } from "@/integrations/supabase/client";

export type Topic =
  | "career"
  | "health"
  | "marriage"
  | "relationships"
  | "finance"
  | "children"
  | "education"
  | "travel"
  | "property"
  | "business"
  | "spirituality"
  | "family"
  | "other";

export type Surface = "chat" | "daily" | "remedy" | "other";
export type Rating = "up" | "down";
export type Outcome = "happened" | "partly" | "not_yet" | "did_not";
export type RemedyHelped = "yes" | "somewhat" | "no" | "not_tried";

type FeedbackRow = {
  id: string;
  user_id: string;
  conversation_id: string | null;
  message_id: string | null;
  surface: Surface;
  feedback_kind: "rating" | "outcome" | "remedy";
  rating: Rating | null;
  outcome: Outcome | null;
  remedy_helped: RemedyHelped | null;
  topic: Topic | null;
  prediction_summary: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

const TABLE = "user_prediction_feedback";

async function getUserId(): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}

export async function submitRating(opts: {
  messageId: string;
  conversationId?: string;
  rating: Rating;
  topic?: Topic;
  predictionSummary?: string;
  surface?: Surface;
}): Promise<{ ok: boolean; cleared?: boolean }> {
  try {
    const userId = await getUserId();
    if (!userId) return { ok: false };

    const { data: existing } = await supabase
      .from(TABLE)
      .select("id, rating")
      .eq("user_id", userId)
      .eq("message_id", opts.messageId)
      .eq("feedback_kind", "rating")
      .maybeSingle<Pick<FeedbackRow, "id" | "rating">>();

    if (existing) {
      const { error: deleteError } = await supabase
        .from(TABLE)
        .delete()
        .eq("id", existing.id);
      if (deleteError) return { ok: false };
      if (existing.rating === opts.rating) {
        return { ok: true, cleared: true };
      }
    }

    const { error: insertError } = await supabase.from(TABLE).insert({
      user_id: userId,
      message_id: opts.messageId,
      conversation_id: opts.conversationId ?? null,
      surface: opts.surface ?? "chat",
      feedback_kind: "rating",
      rating: opts.rating,
      topic: opts.topic ?? null,
      prediction_summary: opts.predictionSummary ?? null,
    });
    if (insertError) return { ok: false };

    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function submitOutcome(opts: {
  messageId?: string;
  conversationId?: string;
  outcome: Outcome;
  topic?: Topic;
  predictionSummary?: string;
  note?: string;
  surface?: Surface;
}): Promise<{ ok: boolean }> {
  try {
    const userId = await getUserId();
    if (!userId) return { ok: false };

    let deleteQuery = supabase
      .from(TABLE)
      .delete()
      .eq("user_id", userId)
      .eq("feedback_kind", "outcome");
    deleteQuery = opts.messageId
      ? deleteQuery.eq("message_id", opts.messageId)
      : deleteQuery.is("message_id", null);
    await deleteQuery;

    const { error: insertError } = await supabase.from(TABLE).insert({
      user_id: userId,
      message_id: opts.messageId ?? null,
      conversation_id: opts.conversationId ?? null,
      surface: opts.surface ?? "chat",
      feedback_kind: "outcome",
      outcome: opts.outcome,
      topic: opts.topic ?? null,
      prediction_summary: opts.predictionSummary ?? null,
      note: opts.note ?? null,
    });
    if (insertError) return { ok: false };

    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function submitRemedyFeedback(opts: {
  messageId?: string;
  conversationId?: string;
  remedyHelped: RemedyHelped;
  topic?: Topic;
  note?: string;
  surface?: Surface;
}): Promise<{ ok: boolean }> {
  try {
    const userId = await getUserId();
    if (!userId) return { ok: false };

    let deleteQuery = supabase
      .from(TABLE)
      .delete()
      .eq("user_id", userId)
      .eq("feedback_kind", "remedy");
    deleteQuery = opts.messageId
      ? deleteQuery.eq("message_id", opts.messageId)
      : deleteQuery.is("message_id", null);
    await deleteQuery;

    const { error: insertError } = await supabase.from(TABLE).insert({
      user_id: userId,
      message_id: opts.messageId ?? null,
      conversation_id: opts.conversationId ?? null,
      surface: opts.surface ?? "remedy",
      feedback_kind: "remedy",
      remedy_helped: opts.remedyHelped,
      topic: opts.topic ?? null,
      note: opts.note ?? null,
    });
    if (insertError) return { ok: false };

    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function getFeedbackForMessages(
  messageIds: string[],
): Promise<
  Record<
    string,
    { rating?: Rating; outcome?: Outcome; remedyHelped?: RemedyHelped }
  >
> {
  const result: Record<
    string,
    { rating?: Rating; outcome?: Outcome; remedyHelped?: RemedyHelped }
  > = {};
  if (messageIds.length === 0) return result;

  try {
    const userId = await getUserId();
    if (!userId) return result;

    const { data, error } = await supabase
      .from(TABLE)
      .select("message_id, feedback_kind, rating, outcome, remedy_helped")
      .eq("user_id", userId)
      .in("message_id", messageIds)
      .returns<
        Pick<
          FeedbackRow,
          "message_id" | "feedback_kind" | "rating" | "outcome" | "remedy_helped"
        >[]
      >();
    if (error || !data) return result;

    for (const row of data) {
      if (!row.message_id) continue;
      const entry = (result[row.message_id] ??= {});
      if (row.feedback_kind === "rating" && row.rating) {
        entry.rating = row.rating;
      } else if (row.feedback_kind === "outcome" && row.outcome) {
        entry.outcome = row.outcome;
      } else if (row.feedback_kind === "remedy" && row.remedy_helped) {
        entry.remedyHelped = row.remedy_helped;
      }
    }

    return result;
  } catch {
    return result;
  }
}
