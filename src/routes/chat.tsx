import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useTranslation } from "react-i18next";
import { useRequireOnboarding } from "@/lib/require-auth";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  Menu,
  MessageSquarePlus,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Square,
  Trash2,
  X,
} from "lucide-react";

import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getBirthProfile } from "@/lib/birth-profile";
import { supabase } from "@/integrations/supabase/client";
import { NAKSHATRAS, SIGN_KEYS_BY_INDEX } from "@/lib/charts";
import { usePlanets, useTodayTransits } from "@/lib/queries";
import {
  findAscendantSignIndex,
  houseFor,
  INGRESS_SOON_MS,
  PLANET_KEY_BY_CODE,
} from "@/lib/todayTransits";
import { getFeedbackForMessages } from "@/lib/feedback";
import {
  MessageFollowUps,
  RatingButtons,
  type FeedbackEntry,
  type Provenance,
} from "@/components/chat/MessageFeedback";

type ChatRole = "user" | "assistant";
export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  // Persisted chat_messages.id — absent until the row is written/hydrated,
  // which is when the feedback footer becomes available.
  dbId?: string;
  provenance?: Provenance;
};
type Conversation = { id: string; title: string | null; updated_at: string };
type FeedbackMap = Record<string, FeedbackEntry>;

function newId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function SrAnnouncer({ text, assertive = false }: { text: string; assertive?: boolean }) {
  return (
    <div
      className="sr-only"
      role="status"
      aria-live={assertive ? "assertive" : "polite"}
      aria-atomic="true"
    >
      {text}
    </div>
  );
}

function commonPrefixLen(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  return i;
}

// Calls the astrologer-chat Edge Function in streaming mode and invokes the
// handlers as Server-Sent Events arrive. We can't use supabase.functions.invoke
// here because it buffers the whole response; we need the raw streaming body.
async function streamAstrologerReply(
  args: { message: string; conversationId: string | null; subjectRelatedChartId?: string },
  handlers: {
    onMeta?: (conversationId: string) => void;
    onDelta: (text: string) => void;
  },
  opts?: { signal?: AbortSignal },
): Promise<void> {
  // Reuse the configured functions URL + apikey from the supabase client so we
  // don't hardcode project details or depend on env-var names.
  const fnClient = supabase.functions as unknown as {
    url: string;
    headers: Record<string, string>;
  };
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  const ac = new AbortController();
  const external = opts?.signal;
  if (external) {
    if (external.aborted) ac.abort();
    else external.addEventListener("abort", () => ac.abort(), { once: true });
  }

  const res = await fetch(`${fnClient.url}/astrologer-chat`, {
    method: "POST",
    signal: ac.signal,
    headers: {
      ...fnClient.headers,
      "content-type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({
      message: args.message,
      conversation_id: args.conversationId || undefined,
      subject_related_chart_id: args.subjectRelatedChartId || undefined,
      stream: true,
    }),
  });

  if (!res.ok || !res.body) {
    let msg = `Request failed (${res.status})`;
    try {
      const j = await res.json();
      msg = (j as { error?: { message?: string } })?.error?.message || msg;
    } catch {
      /* ignore non-JSON error body */
    }
    throw new Error(msg);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let streamError: string | null = null;

  // Inactivity watchdog: the edge timeout only covers response headers, so a
  // silent mid-stream stall would otherwise hang forever. Tolerate a longer wait
  // for the FIRST byte (reasoning models pause before the first token), then a
  // tighter gap once tokens are flowing.
  const FIRST_BYTE_MS = 35000;
  const INACTIVITY_MS = 15000;
  let receivedBytes = false;
  let stalled = false;
  let stallTimer: ReturnType<typeof setTimeout> | null = null;
  const armStall = () => {
    if (stallTimer) clearTimeout(stallTimer);
    stallTimer = setTimeout(
      () => {
        stalled = true;
        ac.abort();
      },
      receivedBytes ? INACTIVITY_MS : FIRST_BYTE_MS,
    );
  };

  try {
    armStall();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      receivedBytes = true;
      armStall();
      buffer += decoder.decode(value, { stream: true });
      // SSE frames are separated by a blank line.
      let sep: number;
      while ((sep = buffer.indexOf("\n\n")) !== -1) {
        const frame = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        let event = "message";
        let dataStr = "";
        for (const line of frame.split("\n")) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          else if (line.startsWith("data:")) dataStr += line.slice(5).trim();
        }
        if (!dataStr) continue;
        let payload: {
          conversation_id?: string;
          text?: string;
          message?: string;
        } = {};
        try {
          payload = JSON.parse(dataStr);
        } catch {
          continue;
        }
        if (event === "meta") {
          if (payload.conversation_id) handlers.onMeta?.(payload.conversation_id);
        } else if (event === "delta") {
          if (payload.text) handlers.onDelta(payload.text);
        } else if (event === "error") {
          streamError = payload.message || "stream_error";
        }
        // `done` needs no action; the loop ends when the body closes.
      }
    }
  } catch (err) {
    // Only the watchdog's own abort maps to a stall; every other failure
    // (network drop, user abort) bubbles up untouched.
    if (stalled) throw new Error("stream_stalled");
    throw err;
  } finally {
    if (stallTimer) clearTimeout(stallTimer);
  }

  if (streamError) throw new Error(streamError);
}

const MAX_SEED_LENGTH = 500;
const MAX_SUBJECT_ID_LENGTH = 100;

type ChatSearch = { seed?: string; subjectRelatedChartId?: string };

export const Route = createFileRoute("/chat")({
  validateSearch: (search: Record<string, unknown>): ChatSearch => {
    const result: ChatSearch = {};
    const rawSeed = search.seed;
    if (typeof rawSeed === "string") {
      const trimmed = rawSeed.trim();
      if (trimmed && trimmed.length <= MAX_SEED_LENGTH) result.seed = trimmed;
    }
    const rawSubject = search.subjectRelatedChartId;
    if (typeof rawSubject === "string") {
      const trimmed = rawSubject.trim();
      if (trimmed && trimmed.length <= MAX_SUBJECT_ID_LENGTH)
        result.subjectRelatedChartId = trimmed;
    }
    return result;
  },
  head: () => ({
    meta: [
      { title: "Chat — AstroSaathi" },
      {
        name: "description",
        content: "Ask questions about your Vedic chart — a calm, mock conversation for reflection.",
      },
    ],
  }),
  component: ChatPage,
});

const SIDEBAR_STORAGE_KEY = "astrosaathi:chat:sidebar";

const MAX_SUGGESTIONS = 4;

// Builds the empty-state suggestion chips from today's real transit facts
// (same data as Home's "Today" panorama, reused via the shared query cache —
// no extra fetch here). Falls back to fact-free evergreen prompts whenever
// transit data isn't loaded yet, errored, or came back empty, and tops up any
// remaining slots with evergreen prompts so there are always at least a few.
function buildSuggestedPrompts(
  t: (key: string, opts?: Record<string, unknown>) => string,
  transits: { moon: { signIndex: number; nakshatraIndex: number } | null; planets: Array<{
    planet: number;
    nextIngressTs: string | null;
    nextSignIndex: number | null;
  }> } | null,
  ascSignIndex: number | null,
): string[] {
  const prompts: string[] = [];
  const moon = transits?.moon ?? null;
  const planets = transits?.planets ?? [];

  if (moon) {
    prompts.push(
      t("chat.suggestions.moonSign", {
        sign: t(`signs.${SIGN_KEYS_BY_INDEX[moon.signIndex]}`),
        nakshatra: NAKSHATRAS[moon.nakshatraIndex] ?? "",
      }),
    );
    if (ascSignIndex != null) {
      prompts.push(
        t("chat.suggestions.moonHouse", {
          house: houseFor(moon.signIndex, ascSignIndex),
        }),
      );
    }
  }

  const ingressSoon = planets.find((p) => {
    if (p.nextIngressTs == null || p.nextSignIndex == null) return false;
    const delta = new Date(p.nextIngressTs).getTime() - Date.now();
    return delta >= 0 && delta <= INGRESS_SOON_MS;
  });
  if (ingressSoon) {
    const key = PLANET_KEY_BY_CODE[ingressSoon.planet];
    if (key) {
      prompts.push(
        t("chat.suggestions.ingressSoon", {
          planet: t(`home.planets.${key}`),
          sign: t(`signs.${SIGN_KEYS_BY_INDEX[ingressSoon.nextSignIndex as number]}`),
        }),
      );
    }
  }

  const evergreen = [
    t("chat.suggestions.dasha"),
    t("chat.suggestions.week"),
    t("chat.suggestions.general"),
  ];
  for (const e of evergreen) {
    if (prompts.length >= MAX_SUGGESTIONS) break;
    prompts.push(e);
  }

  return prompts.slice(0, MAX_SUGGESTIONS);
}

// ---------- Page ----------

function ChatPage() {
  useRequireOnboarding();
  const { t } = useTranslation();
  const { seed, subjectRelatedChartId } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [profileName, setProfileName] = useState<string | null>(null);
  useEffect(() => {
    void getBirthProfile().then((p) => setProfileName(p?.name ?? null));
  }, []);
  const name = profileName?.split(" ")[0] ?? t("chat.friend");

  // Empty-state suggestion chips, built from today's real transit facts (Home's
  // "Today" panorama already fetches these — reused here via the shared query
  // cache, no extra network call).
  const transitsQuery = useTodayTransits();
  const planetsQuery = usePlanets();
  const ascSignIndex = useMemo(
    () => findAscendantSignIndex(planetsQuery.data?.planets ?? []),
    [planetsQuery.data],
  );
  const hasTransitData =
    !transitsQuery.isPending &&
    !transitsQuery.isError &&
    (!!transitsQuery.data?.moon || (transitsQuery.data?.planets.length ?? 0) > 0);
  const suggestions = useMemo(
    () => buildSuggestedPrompts(t, hasTransitData ? (transitsQuery.data ?? null) : null, ascSignIndex),
    [t, hasTransitData, transitsQuery.data, ascSignIndex],
  );

  // Sidebar state (persisted on desktop; drawer on mobile is always closed at start).
  // Computed synchronously in the initializer — not via a post-mount effect —
  // so the first paint already matches the real viewport. Deriving it later
  // caused a visible flash: the desktop-open sidebar would render inline for
  // one frame, then snap into the fixed, off-canvas mobile position once the
  // effect caught up (seen as "sidebar opens, then swipes away" on Home→Chat).
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 767px)").matches : false,
  );
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    if (window.matchMedia("(max-width: 767px)").matches) return false;
    const stored = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    return stored ? stored === "open" : true;
  });
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 767px)");
    const sync = () => setIsMobile(mql.matches);
    mql.addEventListener("change", sync);
    return () => mql.removeEventListener("change", sync);
  }, []);
  useEffect(() => {
    const stored =
      typeof window !== "undefined" ? window.localStorage.getItem(SIDEBAR_STORAGE_KEY) : null;
    if (isMobile) {
      setSidebarOpen(false);
    } else {
      setSidebarOpen(stored ? stored === "open" : true);
    }
  }, [isMobile]);
  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => {
      const next = !prev;
      if (!isMobile) {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "open" : "closed");
      }
      return next;
    });
  }, [isMobile]);

  // Messages
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // Rating/outcome/remedy selections keyed by persisted chat_messages.id.
  const [feedbackMap, setFeedbackMap] = useState<FeedbackMap>({});
  const updateFeedback = useCallback((messageId: string, patch: Partial<FeedbackEntry>) => {
    setFeedbackMap((prev) => ({ ...prev, [messageId]: { ...prev[messageId], ...patch } }));
  }, []);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFailed, setLastFailed] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  // Scopes only the very first message of a freshly-opened conversation to a
  // saved person (e.g. arriving via "Ask AstroSaathi about {name}"); cleared
  // as soon as that message is sent, same lifecycle as the `seed` param below.
  const [pendingSubjectChartId, setPendingSubjectChartId] = useState<string | null>(null);
  // Id of the assistant message currently being streamed (for the live caret).
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [streamPhase, setStreamPhase] = useState<
    "idle" | "connecting" | "thinking" | "writing" | "reconnecting"
  >("idle");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [srFinal, setSrFinal] = useState("");
  const phaseAnnouncement = useMemo(() => {
    switch (streamPhase) {
      case "connecting":
        return t("chat.phaseConnecting");
      case "thinking":
        return t("chat.phaseThinking");
      case "reconnecting":
        return t("chat.phaseReconnecting");
      default:
        return "";
    }
  }, [streamPhase, t]);
  const listRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRafRef = useRef<number | null>(null);
  // Tracks the freshest known conversation id for provenance hydration after
  // a stream completes, since `conversationId` state lags behind onMeta/the
  // response payload within the same sendToBackend call.
  const latestConvIdRef = useRef<string | null>(null);
  useEffect(() => {
    latestConvIdRef.current = conversationId;
  }, [conversationId]);

  // Streaming plumbing: buffer deltas in a ref and flush once per animation
  // frame so React commits at most once per frame — no per-token re-renders,
  // no flicker, no jank on mobile.
  const bufferRef = useRef<string>("");
  const rafRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const activeStreamIdRef = useRef<string | null>(null);
  const cancelStreamRef = useRef<(() => void) | null>(null);

  const cancelPendingFrame = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const scheduleFlush = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const id = activeStreamIdRef.current;
      if (!id) return;
      const text = bufferRef.current;
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === id);
        if (idx === -1) return prev;
        if (prev[idx].content === text) return prev;
        const next = prev.slice();
        next[idx] = { ...next[idx], content: text };
        return next;
      });
    });
  }, []);

  // Reveal `full` into the placeholder message with a rAF-driven typewriter.
  // Cancellable via the returned function. Respects prefers-reduced-motion.
  const typewriterReveal = useCallback(
    (id: string, full: string): (() => void) => {
      const reduce =
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      if (reduce || full.length < 24) {
        bufferRef.current = full;
        activeStreamIdRef.current = id;
        scheduleFlush();
        return () => {
          /* nothing to cancel */
        };
      }
      // Aim to finish in ~1.5s regardless of length; min 30 chars/frame.
      const targetMs = 1500;
      const startedAt = performance.now();
      const perFrame = Math.max(30, Math.ceil(full.length / (targetMs / 16)));
      let i = bufferRef.current.length;
      let cancelled = false;
      let handle: number | null = null;
      const step = () => {
        if (cancelled) return;
        const elapsed = performance.now() - startedAt;
        // Time-based ceiling so slow devices still finish on schedule.
        const byTime = Math.ceil((elapsed / targetMs) * full.length);
        i = Math.min(full.length, Math.max(i + perFrame, byTime));
        bufferRef.current = full.slice(0, i);
        scheduleFlush();
        if (i < full.length) handle = requestAnimationFrame(step);
      };
      handle = requestAnimationFrame(step);
      return () => {
        cancelled = true;
        if (handle !== null) cancelAnimationFrame(handle);
        // Commit the full text so nothing is lost.
        bufferRef.current = full;
        scheduleFlush();
      };
    },
    [scheduleFlush],
  );

  function createRevealController(opts: {
    paint: (text: string) => void;
    reduceMotion: boolean;
  }) {
    const BASE_CPS = 180;
    const MAX_CPS = 1400;
    const MAX_LAG_MS = 400;

    let target = "";
    let revealed = 0;
    let raf: number | null = null;
    let lastTs = 0;
    let ended = false;
    let onDrained: (() => void) | null = null;
    let disposed = false;

    const paintNow = () => opts.paint(target.slice(0, revealed));
    const stopRaf = () => { if (raf !== null) { cancelAnimationFrame(raf); raf = null; } };
    const finishIfDone = () => {
      if (revealed >= target.length && ended) { onDrained?.(); onDrained = null; }
    };
    const fastForward = () => {
      if (revealed !== target.length) { revealed = target.length; paintNow(); }
      stopRaf();
      finishIfDone();
    };

    const tick = (ts: number) => {
      raf = null;
      if (disposed) return;
      const dt = lastTs ? Math.min(100, ts - lastTs) : 16;
      lastTs = ts;
      const backlog = target.length - revealed;
      if (backlog > 0) {
        const neededCps = (backlog / MAX_LAG_MS) * 1000;
        const cps = Math.min(MAX_CPS, Math.max(BASE_CPS, neededCps));
        const step = Math.max(1, Math.ceil((cps * dt) / 1000));
        revealed = Math.min(target.length, revealed + step);
        paintNow();
      }
      if (revealed < target.length) raf = requestAnimationFrame(tick);
      else finishIfDone();
    };

    const ensureRunning = () => {
      if (typeof window === "undefined" || disposed) return;
      if (opts.reduceMotion || (typeof document !== "undefined" && document.hidden)) {
        fastForward();
        return;
      }
      if (raf === null && revealed < target.length) { lastTs = 0; raf = requestAnimationFrame(tick); }
    };

    const onVisibility = () => {
      if (typeof document === "undefined" || disposed) return;
      if (document.hidden) {
        fastForward();
      } else {
        lastTs = 0;
        paintNow();
        ensureRunning();
      }
    };

    if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisibility);
    const teardown = () => {
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisibility);
    };

    return {
      push(chunk: string) { if (!chunk || disposed) return; target += chunk; ensureRunning(); },
      end(): Promise<void> {
        ended = true;
        if (revealed >= target.length) return Promise.resolve();
        if (opts.reduceMotion || (typeof document !== "undefined" && document.hidden)) {
          fastForward();
          return Promise.resolve();
        }
        return new Promise<void>((resolve) => { onDrained = resolve; ensureRunning(); });
      },
      cancel() { disposed = true; stopRaf(); onDrained = null; teardown(); },
      get text() { return target; },
    };
  }

  // Cancel any in-flight stream/typewriter cleanly.
  const abortActiveStream = useCallback(() => {
    cancelStreamRef.current?.();
    cancelStreamRef.current = null;
    abortRef.current?.abort();
    abortRef.current = null;
    cancelPendingFrame();
    activeStreamIdRef.current = null;
    bufferRef.current = "";
    setStreamPhase("idle");
  }, [cancelPendingFrame]);

  useEffect(() => () => abortActiveStream(), [abortActiveStream]);

  // ---- Data loading ----
  const refetchConversations = useCallback(async () => {
    const { data } = await supabase
      .from("chat_conversations")
      .select("id, title, updated_at")
      .order("updated_at", { ascending: false });
    const list = Array.isArray(data) ? (data as Conversation[]) : [];
    setConversations(list);
    return list;
  }, []);

  const loadConversation = useCallback(async (id: string) => {
    setConversationId(id);
    setError(null);
    setLastFailed(null);
    setPendingSubjectChartId(null);
    const { data } = await supabase
      .from("chat_messages")
      .select("id, role, content, created_at, metadata")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });
    const rows = Array.isArray(data) ? data : [];
    const mapped: ChatMessage[] = rows
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        id: newId(),
        dbId: typeof m.id === "string" ? m.id : undefined,
        role: m.role as ChatRole,
        content: String(m.content ?? ""),
        provenance: (m.metadata as { provenance?: Provenance } | null)?.provenance,
      }));
    setMessages(mapped);
    setPinnedToBottom(true);

    const assistantDbIds = mapped
      .filter((m) => m.role === "assistant" && m.dbId)
      .map((m) => m.dbId as string);
    if (assistantDbIds.length > 0) {
      getFeedbackForMessages(assistantDbIds)
        .then((fb) => setFeedbackMap((prev) => ({ ...prev, ...fb })))
        .catch(() => {
          /* fail-soft: selections just won't be pre-filled */
        });
    }
  }, []);

  // Hydrates the id + provenance metadata of the most recently persisted
  // assistant row onto the (client-only-id) streamed bubble, so the
  // feedback footer can appear without a full reload. Fail-soft.
  const hydrateLastAssistantMessage = useCallback(
    async (convId: string | null, assistantId: string) => {
      if (!convId) return;
      try {
        const { data } = await supabase
          .from("chat_messages")
          .select("id, metadata")
          .eq("conversation_id", convId)
          .eq("role", "assistant")
          .order("created_at", { ascending: false })
          .limit(1);
        const row = Array.isArray(data) ? data[0] : null;
        const rowId = row && typeof row.id === "string" ? row.id : null;
        if (!rowId) return;
        const provenance = (row?.metadata as { provenance?: Provenance } | null)?.provenance;
        setMessages((prev) => {
          const idx = prev.findIndex((m) => m.id === assistantId);
          if (idx === -1) return prev;
          const next = prev.slice();
          next[idx] = { ...next[idx], dbId: rowId, provenance };
          return next;
        });
      } catch {
        /* fail-soft: footer just won't appear for this turn */
      }
    },
    [],
  );

  // Initial mount: fetch conversations, open the most recent one only if it
  // was active in the last 15 minutes. After a longer gap the user is most
  // likely here to ask something new, so land on the empty composer instead
  // of resuming a stale conversation — still browsable from the sidebar.
  // Skipped entirely when a `?seed=` or `?subjectRelatedChartId=` is present
  // (e.g. tapping a house on Home, or "Ask AstroSaathi about {name}"): that's
  // an explicit signal to ask something new, so resuming an old conversation
  // would both land on the wrong thread and silently drop the seed/subject
  // (their pre-fill effect below only applies to an empty thread).
  const RESUME_WINDOW_MS = 15 * 60 * 1000;
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const list = await refetchConversations();
      if (cancelled) return;
      const mostRecent = list[0];
      const lastActiveMs = mostRecent ? new Date(mostRecent.updated_at).getTime() : NaN;
      const isRecent = Number.isFinite(lastActiveMs) && Date.now() - lastActiveMs < RESUME_WINDOW_MS;
      if (mostRecent && isRecent && !seed && !subjectRelatedChartId) {
        await loadConversation(mostRecent.id);
      }
      if (!cancelled) setInitialLoadDone(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only; `seed`/`subjectRelatedChartId` are read once by design, not re-triggered on later changes (e.g. once cleared by the pre-fill effect below).
  }, [loadConversation, refetchConversations]);

  // Autofocus the composer once we land on a genuinely empty conversation —
  // saves the user a tap at the exact "first message" moment. Skipped on
  // mobile so we don't pop the keyboard up unannounced on page load.
  useEffect(() => {
    if (!initialLoadDone || isMobile) return;
    if (messages.length === 0 && !sending) {
      textareaRef.current?.focus();
    }
  }, [initialLoadDone, isMobile, messages.length, sending]);

  // Pre-fill the composer from a `?seed=` search param (e.g. the "Ask about
  // today" bridge from Home) and/or capture a `?subjectRelatedChartId=` to
  // scope the first message to a saved person (e.g. "Ask AstroSaathi about
  // {name}" on their detail page) — never auto-sent, the user still presses
  // send. Only applies to a genuinely empty conversation, and the params are
  // stripped right after so a refresh or reload doesn't re-inject them.
  useEffect(() => {
    if (!initialLoadDone || (!seed && !subjectRelatedChartId) || messages.length > 0) return;
    if (seed) setInput(seed);
    if (subjectRelatedChartId) setPendingSubjectChartId(subjectRelatedChartId);
    textareaRef.current?.focus();
    void navigate({ search: {}, replace: true });
  }, [initialLoadDone, seed, subjectRelatedChartId, messages.length, navigate]);

  // Auto-grow textarea
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 220) + "px";
  }, [input]);

  // Auto-scroll on message change unless the user scrolled up
  const [pinnedToBottom, setPinnedToBottom] = useState(true);
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const onScroll = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      setPinnedToBottom(distance < 80);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, [messages.length, sending]);

  useEffect(() => {
    if (!pinnedToBottom) return;
    const el = listRef.current;
    if (!el) return;
    if (scrollRafRef.current !== null) cancelAnimationFrame(scrollRafRef.current);
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      el.scrollTop = el.scrollHeight;
    });
    return () => {
      if (scrollRafRef.current !== null) {
        cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = null;
      }
    };
  }, [messages, sending, pinnedToBottom]);

  const scrollToBottom = () => {
    const el = listRef.current;
    if (el) {
      const reduce =
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
      el.scrollTo({ top: el.scrollHeight, behavior: reduce ? "auto" : "smooth" });
    }
    setPinnedToBottom(true);
  };

  // ---- Send via real Edge Function (streaming) ----
  const sendToBackend = useCallback(
    async (text: string, subjectRelatedChartId?: string) => {
      setSending(true);
      setStreamPhase("connecting");
      setError(null);
      setLastFailed(null);

      // Cancel any previous in-flight stream before starting a new one.
      abortActiveStream();

      const controller = new AbortController();
      abortRef.current = controller;

      // Defer creating the assistant placeholder until the first delta
      // arrives — this way the bouncing "typing…" indicator shows while
      // we're waiting on the model, exactly like before.
      const assistantId = newId();
      bufferRef.current = "";
      let placeholderInserted = false;
      const ensurePlaceholder = () => {
        if (placeholderInserted) return;
        placeholderInserted = true;
        activeStreamIdRef.current = assistantId;
        setMessages((m) => [...m, { id: assistantId, role: "assistant", content: "" }]);
        setStreamingId(assistantId);
        setStreamPhase("writing");
      };

      let receivedAny = false;

      const reduceMotion =
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
      const makeReveal = () =>
        createRevealController({
          reduceMotion,
          paint: (textSoFar) => {
            bufferRef.current = textSoFar;
            scheduleFlush();
          },
        });
      let reveal = makeReveal();
      cancelStreamRef.current = () => reveal.cancel();

      // ---- 1) Try SSE streaming first (one transparent reconnect) ----
      // Subject-scoped turns skip streaming entirely and go straight to the
      // buffered fallback below, which renders the full JSON reply.
      const MAX_SSE_ATTEMPTS = subjectRelatedChartId ? 0 : 2;
      for (let attempt = 1; attempt <= MAX_SSE_ATTEMPTS; attempt++) {
        try {
          await streamAstrologerReply(
            { message: text, conversationId, subjectRelatedChartId },
            {
              onMeta: (cid) => {
                if (cid && cid !== conversationId) setConversationId(cid);
                if (cid) latestConvIdRef.current = cid;
                setStreamPhase("thinking");
              },
              onDelta: (chunk) => {
                if (!chunk) return;
                receivedAny = true;
                ensurePlaceholder();
                reveal.push(chunk);
              },
            },
            { signal: controller.signal },
          );

          // Stream succeeded with content — commit final and stop streaming.
          if (receivedAny && reveal.text.trim().length > 0) {
            await reveal.end();
            cancelPendingFrame();
            const finalText = reveal.text;
            setMessages((prev) => {
              const idx = prev.findIndex((m) => m.id === assistantId);
              if (idx === -1) return prev;
              const next = prev.slice();
              next[idx] = { ...next[idx], content: finalText };
              return next;
            });
            setStreamingId(null);
            setSending(false);
            setStreamPhase("idle");
            activeStreamIdRef.current = null;
            bufferRef.current = "";
            reveal.cancel();
            cancelStreamRef.current = null;
            abortRef.current = null;
            setSrFinal(finalText);
            void refetchConversations();
            void hydrateLastAssistantMessage(latestConvIdRef.current, assistantId);
            return;
          }
          // Connected but empty — fall through to the buffered fallback.
          break;
        } catch (streamErr) {
          if (controller.signal.aborted) {
            reveal.cancel();
            const partial = reveal.text.trim();
            if (partial.length > 0) {
              setMessages((prev) => {
                const idx = prev.findIndex((m) => m.id === assistantId);
                if (idx === -1) return prev;
                const next = prev.slice();
                next[idx] = { ...next[idx], content: reveal.text };
                return next;
              });
            } else if (placeholderInserted) {
              setMessages((prev) => prev.filter((m) => m.id !== assistantId));
            }
            setStreamingId(null);
            setStreamPhase("idle");
            setSending(false);
            activeStreamIdRef.current = null;
            bufferRef.current = "";
            cancelStreamRef.current = null;
            abortRef.current = null;
            void refetchConversations();
            return;
          }
          console.warn("[astrologer-chat] stream attempt failed:", streamErr);
          reveal.cancel();
          // Only auto-reconnect while nothing has appeared yet, so visible text
          // is never duplicated or rewound.
          if (attempt < MAX_SSE_ATTEMPTS && !receivedAny) {
            setStreamPhase("reconnecting");
            reveal = makeReveal();
            await new Promise((r) => setTimeout(r, 600));
            continue;
          }
          break;
        }
      }

      // Preserve everything already streamed so the fallback continues from it
      // instead of wiping the visible text and re-typing from scratch.
      if (receivedAny) {
        ensurePlaceholder();
        bufferRef.current = reveal.text;
      }

      // ---- 2) Buffered fallback with client-side typewriter reveal ----
      try {
        const { data, error: invokeErr } = await supabase.functions.invoke("astrologer-chat", {
          body: {
            message: text,
            conversation_id: conversationId || undefined,
            subject_related_chart_id: subjectRelatedChartId || undefined,
            ...(subjectRelatedChartId ? { stream: false } : {}),
          },
        });
        if (invokeErr) throw invokeErr;
        const payload = (data ?? {}) as {
          reply?: string;
          conversation_id?: string;
        };
        if (payload.conversation_id && payload.conversation_id !== conversationId)
          setConversationId(payload.conversation_id);
        if (payload.conversation_id) latestConvIdRef.current = payload.conversation_id;
        const reply = (payload.reply ?? "").trim();
        if (!reply) throw new Error("empty_response");

        ensurePlaceholder();
        const shown = bufferRef.current;
        if (shown && reply.startsWith(shown)) {
          // Same answer so far — keep it and reveal only the remainder.
        } else if (shown) {
          // Regenerated answer diverged — rewind only the divergent tail to the
          // longest common prefix, so we rewrite as little as possible on screen.
          bufferRef.current = reply.slice(0, commonPrefixLen(shown, reply));
        } else {
          bufferRef.current = "";
        }
        const cancelTyping = typewriterReveal(assistantId, reply);
        cancelStreamRef.current = cancelTyping;

        // Finish the typewriter after ~1.6s, then swap to full Markdown render.
        await new Promise<void>((resolve) => {
          const done = () => {
            cancelTyping();
            resolve();
          };
          setTimeout(done, 1600);
        });
        cancelStreamRef.current = null;
        setMessages((prev) => {
          const idx = prev.findIndex((m) => m.id === assistantId);
          if (idx === -1) return prev;
          const next = prev.slice();
          next[idx] = { ...next[idx], content: reply };
          return next;
        });
        setStreamingId(null);
        setStreamPhase("idle");
        activeStreamIdRef.current = null;
        bufferRef.current = "";
        setSrFinal(reply);
        void refetchConversations();
        void hydrateLastAssistantMessage(latestConvIdRef.current, assistantId);
      } catch (e) {
        console.error("[astrologer-chat] request failed:", e);
        const partial = bufferRef.current.trim();
        if (placeholderInserted && partial.length > 0) {
          const kept = bufferRef.current;
          setMessages((prev) => {
            const idx = prev.findIndex((m) => m.id === assistantId);
            if (idx === -1) return prev;
            const next = prev.slice();
            next[idx] = { ...next[idx], content: kept };
            return next;
          });
          setLastFailed(text);
          setError(t("chat.errorInterrupted"));
          setSrFinal(t("chat.errorInterrupted"));
        } else {
          if (placeholderInserted) {
            setMessages((prev) => prev.filter((m) => m.id !== assistantId));
          }
          setLastFailed(text);
          setError(t("chat.errorGeneric"));
        }
        setStreamingId(null);
        setStreamPhase("idle");
        activeStreamIdRef.current = null;
        bufferRef.current = "";
      } finally {
        setSending(false);
      }
    },
    [
      conversationId,
      refetchConversations,
      abortActiveStream,
      scheduleFlush,
      cancelPendingFrame,
      typewriterReveal,
      hydrateLastAssistantMessage,
      t,
    ],
  );

  const handleSend = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || sending) return;
      setMessages((m) => [...m, { id: newId(), role: "user", content: text }]);
      setInput("");
      setPinnedToBottom(true);
      const subjectRelatedChartId = pendingSubjectChartId ?? undefined;
      if (pendingSubjectChartId) setPendingSubjectChartId(null);
      await sendToBackend(text, subjectRelatedChartId);
    },
    [sending, sendToBackend, pendingSubjectChartId],
  );

  const handleRetry = useCallback(() => {
    if (!lastFailed || sending) return;
    void sendToBackend(lastFailed);
  }, [lastFailed, sending, sendToBackend]);

  const handleRegenerate = useCallback(() => {
    if (sending) return;
    // Find last user message; drop any assistant reply that came after it.
    let lastUserIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        lastUserIdx = i;
        break;
      }
    }
    if (lastUserIdx === -1) return;
    const text = messages[lastUserIdx].content;
    setMessages((m) => m.slice(0, lastUserIdx + 1));
    void sendToBackend(text);
  }, [messages, sending, sendToBackend]);

  const handleNewChat = useCallback(() => {
    setMessages([]);
    setFeedbackMap({});
    setInput("");
    setConversationId(null);
    setError(null);
    setLastFailed(null);
    setPinnedToBottom(true);
    setPendingSubjectChartId(null);
    if (isMobile) setSidebarOpen(false);
    textareaRef.current?.focus();
  }, [isMobile]);

  const handleDeleteConversation = useCallback(
    async (id: string) => {
      try {
        await supabase.from("chat_conversations").delete().eq("id", id);
        if (conversationId === id) {
          handleNewChat();
        }
        void refetchConversations();
      } catch {
        /* ignore deletion errors */
      }
    },
    [conversationId, handleNewChat, refetchConversations],
  );

  const handleRenameConversation = useCallback(
    async (id: string, title: string) => {
      const trimmed = title.trim();
      if (!trimmed) return;
      try {
        await supabase.from("chat_conversations").update({ title: trimmed }).eq("id", id);
        void refetchConversations();
      } catch {
        /* ignore rename errors */
      }
    },
    [refetchConversations],
  );

  const handleSelectConversation = (id: string) => {
    if (id === conversationId) {
      if (isMobile) setSidebarOpen(false);
      return;
    }
    void loadConversation(id);
    if (isMobile) setSidebarOpen(false);
  };

  const handleEditUser = (id: string) => {
    const msg = messages.find((m) => m.id === id);
    if (!msg) return;
    setInput(msg.content);
    textareaRef.current?.focus();
  };

  const handleSuggestionClick = (text: string) => {
    setInput(text);
    textareaRef.current?.focus();
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void handleSend(input);
    }
  };

  const hasMessages = messages.length > 0 || sending;

  return (
    <div className="flex h-[100dvh] md:h-screen w-full overflow-hidden bg-background text-foreground pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
      {/* Sidebar */}
      <Sidebar
        open={sidebarOpen}
        isMobile={isMobile}
        onClose={() => setSidebarOpen(false)}
        onNewChat={handleNewChat}
        userName={name}
        conversations={conversations}
        activeId={conversationId}
        onSelect={handleSelectConversation}
        onDelete={handleDeleteConversation}
        onRename={handleRenameConversation}
      />

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          onToggleSidebar={toggleSidebar}
          onNewChat={handleNewChat}
          sidebarOpen={sidebarOpen}
          isMobile={isMobile}
          profileName={profileName}
        />

        <div className="relative flex flex-1 flex-col overflow-hidden">
          {!initialLoadDone ? (
            <div className="flex-1" aria-hidden="true" />
          ) : hasMessages ? (
            <>
              <div className="relative flex-1 overflow-hidden">
                <div
                  ref={listRef}
                  role="log"
                  aria-live="off"
                  aria-label={t("chat.title")}
                  className="h-full overflow-y-auto overscroll-contain"
                >
                  <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-6 md:px-8 md:py-10 [overflow-anchor:none]">
                    {messages.map((m) => (
                      <MessageRow
                        key={m.id}
                        message={m}
                        streaming={m.id === streamingId}
                        onCopy={() => copy(m.content)}
                        onEdit={undefined}
                        conversationId={conversationId}
                        feedback={m.dbId ? feedbackMap[m.dbId] : undefined}
                        onFeedbackChange={updateFeedback}
                      />
                    ))}
                    {sending && !streamingId && (
                      <TypingRow
                        phase={
                          streamPhase === "reconnecting"
                            ? "reconnecting"
                            : streamPhase === "thinking"
                              ? "thinking"
                              : "connecting"
                        }
                      />
                    )}
                    {error && <ErrorRow message={error} onRetry={handleRetry} />}
                    <div ref={bottomRef} />
                  </div>
                </div>
                <SrAnnouncer text={phaseAnnouncement} />
                <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
                  {srFinal}
                </div>
                {!pinnedToBottom && (
                  <button
                    type="button"
                    onClick={scrollToBottom}
                    aria-label={t("chat.scrollToBottom", "Scroll to bottom")}
                    className="tap-press motion-fade-up absolute bottom-3 left-1/2 z-30 grid h-11 w-11 -translate-x-1/2 place-items-center rounded-full border border-accent/40 bg-card/95 shadow-2xl backdrop-blur-xl transition-all hover:bg-card hover:border-accent/70 hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ArrowDown size={18} className="text-accent" aria-hidden="true" />
                  </button>
                )}
              </div>
              <Composer
                value={input}
                onChange={setInput}
                onSend={() => handleSend(input)}
                onStop={abortActiveStream}
                onKeyDown={onKeyDown}
                sending={sending}
                textareaRef={textareaRef}
              />
            </>
          ) : (
            <div className="relative flex flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-10">
              {/* Ambient celestial wash */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    "radial-gradient(60% 45% at 50% 20%, color-mix(in oklab, var(--glow-gold) 10%, transparent), transparent 65%), radial-gradient(50% 40% at 20% 90%, color-mix(in oklab, var(--glow-violet) 10%, transparent), transparent 70%)",
                }}
              />
              <div className="motion-fade-up relative flex w-full max-w-2xl flex-col items-center gap-8">
                <div className="flex flex-col items-center gap-4 text-center">
                  <div
                    aria-hidden="true"
                    className="relative grid h-16 w-16 place-items-center rounded-2xl bg-accent/10 text-accent ring-1 ring-accent/30 shadow-[var(--shadow-glow-gold)]"
                  >
                    <BrandMark withWordmark={false} />
                  </div>
                  <h1 className="font-display text-3xl leading-tight tracking-tight text-foreground md:text-4xl">
                    {t("chat.emptyGreeting")}
                  </h1>
                </div>
                {suggestions.length > 0 && (
                  <div
                    role="group"
                    aria-label={t("chat.suggestionsLabel")}
                    className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2"
                  >
                    {suggestions.map((text, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleSuggestionClick(text)}
                        className="tap-press flex min-h-[3.25rem] items-center justify-center rounded-2xl border border-border bg-card/60 px-5 py-3 text-center text-sm leading-snug text-foreground transition-all hover:border-accent/40 hover:bg-card focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {text}
                      </button>
                    ))}
                  </div>
                )}
                <div className="w-full">
                  <Composer
                    value={input}
                    onChange={setInput}
                    onSend={() => handleSend(input)}
                    onStop={abortActiveStream}
                    onKeyDown={onKeyDown}
                    sending={sending}
                    textareaRef={textareaRef}
                    inline
                  />
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ---------- Conversation item (rename / delete) ----------

function ConversationItem({
  id,
  title,
  active,
  onSelect,
  onRename,
  onDelete,
}: {
  id: string;
  title: string;
  active: boolean;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(title);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const startRename = () => {
    setRenameValue(title);
    setIsRenaming(true);
  };

  const commitRename = () => {
    const trimmed = renameValue.trim();
    setIsRenaming(false);
    if (trimmed && trimmed !== title) {
      onRename(id, trimmed);
    }
  };

  if (confirmingDelete) {
    return (
      <li className="flex flex-col gap-1.5 rounded-lg bg-destructive/5 px-3 py-2">
        <p className="truncate text-xs text-muted-foreground">{t("chat.deleteConfirmPrompt")}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setConfirmingDelete(false)}
            className="tap-press min-h-11 flex-1 rounded-lg border border-border bg-background px-2 text-xs font-medium text-foreground hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("chat.cancel")}
          </button>
          <button
            type="button"
            onClick={() => onDelete(id)}
            className="tap-press min-h-11 flex-1 rounded-lg border border-destructive/40 bg-destructive/10 px-2 text-xs font-medium text-destructive-strong hover:bg-destructive/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("chat.delete")}
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="group/item relative flex items-center">
      {isRenaming ? (
        <label className="w-full">
          <span className="sr-only">{t("chat.renameInputLabel")}</span>
          <input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitRename();
              } else if (e.key === "Escape") {
                e.preventDefault();
                setIsRenaming(false);
              }
            }}
            className="w-full truncate rounded-lg border border-border bg-background py-2 pl-3 pr-10 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-ring md:text-sm"
          />
        </label>
      ) : (
        <button
          type="button"
          onClick={() => onSelect(id)}
          aria-current={active ? "true" : undefined}
          className={
            "tap-press w-full truncate rounded-lg py-2 pl-3 pr-10 text-left text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
            (active
              ? "bg-accent/10 text-accent font-medium"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground")
          }
          title={title}
        >
          {title}
        </button>
      )}
      {!isRenaming && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={t("chat.conversationOptions")}
              className="tap-press absolute right-0.5 top-1/2 -translate-y-1/2 grid min-h-11 min-w-11 place-items-center rounded-full text-muted-foreground opacity-100 transition-opacity hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring md:opacity-0 md:group-hover/item:opacity-100 md:focus-within:opacity-100"
            >
              <MoreHorizontal size={16} aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="min-w-[9rem] rounded-xl border-border bg-card p-1.5 shadow-[var(--shadow-elevated)]"
          >
            <DropdownMenuItem
              onClick={startRename}
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground"
            >
              <Pencil size={14} aria-hidden="true" />
              {t("chat.rename")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setConfirmingDelete(true)}
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive-strong"
            >
              <Trash2 size={14} aria-hidden="true" />
              {t("chat.delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </li>
  );
}

// ---------- Sidebar ----------

function Sidebar({
  open,
  isMobile,
  onClose,
  onNewChat,
  conversations,
  activeId,
  onSelect,
  onDelete,
  onRename,
}: {
  open: boolean;
  isMobile: boolean;
  onClose: () => void;
  onNewChat: () => void;
  userName: string;
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");

  const filteredGroups = useMemo(
    () => groupConversations(conversations, query, t),
    [conversations, query, t],
  );

  const panel = (
    <aside
      aria-label="Chat history"
      className={`flex h-full w-80 shrink-0 flex-col border-r border-border/70 bg-card/70 backdrop-blur-xl transition-transform duration-300 ease-out ${
        isMobile ? "fixed inset-y-0 left-0 z-50 rounded-r-3xl shadow-2xl" : "relative"
      } ${open ? "translate-x-0" : "-translate-x-full"} ${!isMobile && !open ? "hidden" : ""}`}
    >
      {isMobile && (
        <div className="flex justify-end px-3 pt-3">
          <button
            type="button"
            onClick={onClose}
            aria-label={t("chat.closeSidebar")}
            className="tap-press rounded-full p-2 text-foreground/70 hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      )}

      <div className="p-3">
        <Button
          variant="secondary"
          className="w-full gap-2 font-medium shadow-sm"
          onClick={onNewChat}
        >
          <Plus size={16} aria-hidden="true" />
          {t("chat.newChat")}
        </Button>
      </div>

      <div className="px-3 pb-2">
        <label className="relative block">
          <span className="sr-only">{t("chat.searchPlaceholder")}</span>
          <Search
            size={14}
            aria-hidden="true"
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("chat.searchPlaceholder")}
            className="w-full rounded-full border border-border bg-background py-2 pl-8 pr-3 text-base text-foreground placeholder:text-muted-foreground focus:border-accent/50 focus:bg-background focus:outline-none focus:ring-2 focus:ring-ring md:text-sm"
          />
        </label>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-3">
        {filteredGroups.length === 0 && (
          <div className="px-3 py-4 text-xs text-muted-foreground">{t("chat.historyEmpty")}</div>
        )}
        {filteredGroups.map((g) => (
          <div key={g.label} className="mb-4">
            <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {g.label}
            </div>
            <ul className="flex flex-col gap-0.5">
              {g.items.map((it) => (
                <ConversationItem
                  key={it.id}
                  id={it.id}
                  title={it.title}
                  active={activeId === it.id}
                  onSelect={onSelect}
                  onRename={onRename}
                  onDelete={onDelete}
                />
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );

  if (isMobile) {
    return (
      <>
        <button
          type="button"
          aria-label={t("chat.closeSidebar")}
          onClick={onClose}
          aria-hidden={!open}
          tabIndex={open ? 0 : -1}
          className={`fixed inset-0 z-40 bg-foreground/50 backdrop-blur-sm transition-opacity duration-300 ${
            open ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        />
        {panel}
      </>
    );
  }
  return panel;
}

// ---------- Top bar ----------

function TopBar({
  onToggleSidebar,
  onNewChat,
  sidebarOpen,
  isMobile,
  profileName,
}: {
  onToggleSidebar: () => void;
  onNewChat: () => void;
  sidebarOpen: boolean;
  isMobile: boolean;
  profileName?: string | null;
}) {
  const { t } = useTranslation();
  return (
    <div
      className="flex items-center justify-between border-b border-border/60 bg-background/80 px-3 py-2 backdrop-blur z-10"
      style={{ paddingTop: "calc(0.5rem + env(safe-area-inset-top))" }}
    >
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label={sidebarOpen ? t("chat.closeSidebar") : t("chat.openSidebar")}
          title={sidebarOpen ? t("chat.closeSidebar") : t("chat.openSidebar")}
          className="tap-press rounded-lg p-2 text-foreground/80 hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Menu size={18} aria-hidden="true" />
        </button>
        {(!sidebarOpen || isMobile) && (
          <button
            type="button"
            onClick={onNewChat}
            aria-label={t("chat.newChat")}
            title={t("chat.newChat")}
            className="tap-press inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-card px-2.5 py-1.5 text-xs font-medium text-foreground shadow-sm hover:border-accent/40 hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <MessageSquarePlus size={15} className="text-accent" aria-hidden="true" />
            <span className="hidden sm:inline">{t("chat.newChat")}</span>
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
          </span>
          <span className="truncate max-w-[160px] sm:max-w-xs">
            {profileName ? `${profileName}'s Kundli` : "Vedic Chart Active"}
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------- Messages ----------

function sanitizeStreamingMarkdown(text: string, streaming: boolean): string {
  if (!streaming || !text) return text;
  let out = text;

  // 1) Hold back a trailing GFM table until its delimiter row exists, so header
  //    pipes don't flash as literal "| A | B |".
  {
    const lines = out.split("\n");
    let i = lines.length - 1;
    while (i >= 0 && lines[i].includes("|")) i--;
    const start = i + 1;
    const run = lines.slice(start);
    if (run.length > 0 && /^\s*\|/.test(run[0])) {
      const delim = /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/;
      const hasDelim = run.some((l, idx) => idx < run.length - 1 && delim.test(l));
      if (!hasDelim) out = lines.slice(0, start).join("\n").replace(/\s+$/, "");
    }
  }

  // 2) Drop a trailing hashes-only heading marker with no text yet ("##", "### ").
  out = out.replace(/\n?#{1,6}[ \t]*$/, "");

  // 3) Unclosed fenced code block -> close it so partial code renders live as code.
  const fenceCount = (out.match(/```/g) ?? []).length;
  if (fenceCount % 2 === 1) {
    if (!out.endsWith("\n")) out += "\n";
    return out + "```";
  }
  // strip a stray 1–2 backtick fence-in-progress at the very end
  out = out.replace(/\n?`{1,2}$/, "");

  // 4) Hide an incomplete link/image at the end: "[label" or "[label](url…".
  {
    const open = out.lastIndexOf("[");
    if (open !== -1) {
      const cut = open > 0 && out[open - 1] === "!" ? open - 1 : open;
      const rest = out.slice(open);
      if (!rest.includes("]")) {
        out = out.slice(0, cut);
      } else if (/^!?\[[^\]]*\]\(/.test(rest) && !/^!?\[[^\]]*\]\([^)]*\)/.test(rest)) {
        out = out.slice(0, cut);
      }
    }
  }

  // 5) Close an unclosed inline code span by dropping the dangling opening backtick,
  //    so the text stays visible and becomes code once the closer arrives.
  if (((out.match(/`/g) ?? []).length) % 2 === 1) {
    const idx = out.lastIndexOf("`");
    out = out.slice(0, idx) + out.slice(idx + 1);
  }

  // 6) Emphasis: drop a just-started trailing marker, then close an earlier open bold
  //    so it renders bold live instead of showing literal "**".
  out = out.replace(/(\*\*|~~|\*|_)$/, "");
  if (((out.match(/\*\*/g) ?? []).length) % 2 === 1) out += "**";

  return out;
}

const markdownComponents = {
  pre: (props: React.HTMLAttributes<HTMLPreElement>) => <CodeBlock {...props} />,
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="my-3 max-w-[34rem] border-l-2 border-accent/60 bg-accent/5 py-2 pl-4 pr-3 text-[0.95rem] italic text-foreground/90 rounded-r-lg">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-6 border-0 border-t border-border/60" />,
  code: ({ className, children, ...rest }: React.HTMLAttributes<HTMLElement>) => (
    <code className={className} {...rest}>
      {children}
    </code>
  ),
  table: ({ node: _node, ...props }: { node?: unknown } & React.HTMLAttributes<HTMLTableElement>) => (
    <div className="my-4 w-full overflow-x-auto rounded-lg border border-border">
      <table {...props} className="w-full border-collapse text-left text-sm" />
    </div>
  ),
  thead: ({ node: _node, ...props }: { node?: unknown } & React.HTMLAttributes<HTMLTableSectionElement>) => <thead {...props} className="bg-muted" />,
  tbody: ({ node: _node, ...props }: { node?: unknown } & React.HTMLAttributes<HTMLTableSectionElement>) => <tbody {...props} />,
  tr: ({ node: _node, ...props }: { node?: unknown } & React.HTMLAttributes<HTMLTableRowElement>) => <tr {...props} className="even:bg-muted/40" />,
  th: ({ node: _node, ...props }: { node?: unknown } & React.ThHTMLAttributes<HTMLTableCellElement>) => (
    <th
      {...props}
      className="!border !border-border px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-foreground whitespace-nowrap"
    />
  ),
  td: ({ node: _node, ...props }: { node?: unknown } & React.TdHTMLAttributes<HTMLTableCellElement>) => (
    <td
      {...props}
      className="!border !border-border px-4 py-2.5 align-top text-foreground"
    />
  ),
} as const;

const RenderedMarkdown = memo(function RenderedMarkdown({ md }: { md: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
      {md}
    </ReactMarkdown>
  );
});

function settledBoundary(md: string): number {
  let idx = md.lastIndexOf("\n\n");
  if (idx === -1) return 0;
  let boundary = idx + 2;
  const settled = md.slice(0, boundary);
  const fences = settled.match(/```/g);
  if (fences && fences.length % 2 === 1) {
    const openFence = settled.lastIndexOf("```");
    const prevBreak = md.lastIndexOf("\n\n", openFence);
    boundary = prevBreak === -1 ? 0 : prevBreak + 2;
  }
  return boundary;
}

function StreamingMarkdown({ content, streaming }: { content: string; streaming: boolean }) {
  if (!streaming) return <RenderedMarkdown md={content} />;
  const boundary = settledBoundary(content);
  const settled = content.slice(0, boundary);
  const tail = sanitizeStreamingMarkdown(content.slice(boundary), true);
  return (
    <>
      {settled ? <RenderedMarkdown md={settled} /> : null}
      {tail ? <RenderedMarkdown md={tail} /> : null}
    </>
  );
}

function MessageRow({
  message,
  streaming,
  onCopy,
  onEdit,
  conversationId,
  feedback,
  onFeedbackChange,
}: {
  message: ChatMessage;
  streaming: boolean;
  onCopy: () => void;
  onEdit?: () => void;
  conversationId: string | null;
  feedback?: FeedbackEntry;
  onFeedbackChange: (messageId: string, patch: Partial<FeedbackEntry>) => void;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const doCopy = () => {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  if (message.role === "user") {
    return (
      <div className="motion-fade-up group flex flex-col items-end gap-1.5">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-3xl rounded-tr-sm bg-accent/10 px-4 py-3 text-base leading-relaxed text-foreground shadow-sm ring-1 ring-accent/25">
          {message.content}
        </div>
        <div className="flex gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100">
          <IconAction label={copied ? t("chat.copied") : t("chat.copy")} onClick={doCopy}>
            {copied ? <Check size={14} className="text-accent" /> : <Copy size={14} />}
          </IconAction>
          {onEdit && (
            <IconAction label={t("chat.edit")} onClick={onEdit}>
              <Pencil size={14} />
            </IconAction>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="motion-fade-up group">
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground tracking-tight">
            {t("chat.assistantName")}
          </span>
          {streaming && (
            <span className="flex items-center gap-1 text-[10px] text-accent font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse motion-reduce:animate-none" />
              {t("chat.phaseWriting")}
            </span>
          )}
        </div>
        <div
          className={
            "prose max-w-none text-foreground leading-relaxed " +
            "[&>*:first-child]:mt-0 " +
            "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 " +
            "[&_strong]:font-semibold [&_strong]:text-foreground [&_em]:italic [&_em]:text-foreground/90 " +
            "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.85em] " +
            "[&_h1]:text-xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h1]:mt-6 [&_h1]:mb-3 " +
            "[&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:mt-6 [&_h2]:mb-2.5 " +
            "[&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-5 [&_h3]:mb-2 " +
            "[&_h4]:text-sm [&_h4]:font-semibold [&_h4]:text-foreground/90 [&_h4]:mt-4 [&_h4]:mb-1.5 " +
            "[&_p]:my-3 [&_p]:leading-relaxed " +
            "[&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5 " +
            "[&_li]:my-1 [&_li]:leading-relaxed [&_li>ul]:my-1.5 [&_li>ol]:my-1.5 [&_ul_ul]:mt-1 " +
            "[&_ul>li]:marker:text-accent/60 [&_ol>li]:marker:text-muted-foreground " +
            "[&_li:has(input)]:list-none [&_li:has(input)]:-ml-5 [&_input[type=checkbox]]:mr-2 [&_input[type=checkbox]]:accent-accent " +
            "[&_hr]:my-6 [&_hr]:border-0 [&_hr]:border-t [&_hr]:border-border/60 " +
            "[&>h1]:max-w-[36rem] [&>h2]:max-w-[36rem] [&>h3]:max-w-[36rem] [&>h4]:max-w-[36rem] " +
            "[&>p]:max-w-[36rem] [&>ul]:max-w-[36rem] [&>ol]:max-w-[36rem] [&>blockquote]:max-w-[36rem]" +
            (streaming ? " as-streaming" : "")
          }
        >
          <StreamingMarkdown content={message.content ?? ""} streaming={streaming} />
        </div>
        {!streaming && message.content && (
          <div className="mt-2 flex items-center gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100">
            <IconAction label={copied ? t("chat.copied") : t("chat.copy")} onClick={doCopy}>
              {copied ? <Check size={14} className="text-accent" /> : <Copy size={14} />}
            </IconAction>
            {message.dbId && (
              <RatingButtons
                messageId={message.dbId}
                conversationId={conversationId}
                content={message.content}
                feedback={feedback}
                onFeedbackChange={onFeedbackChange}
              />
            )}
          </div>
        )}
        {!streaming && message.dbId && (
          <MessageFollowUps
            messageId={message.dbId}
            conversationId={conversationId}
            content={message.content}
            provenance={message.provenance}
            feedback={feedback}
            onFeedbackChange={onFeedbackChange}
          />
        )}
      </div>
    </div>
  );
}

function IconAction({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
    </button>
  );
}

function CodeBlock(props: React.HTMLAttributes<HTMLPreElement>) {
  const { t } = useTranslation();
  const preRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);
  const onCopy = () => {
    const text = preRef.current?.innerText ?? "";
    void copy(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };
  return (
    <div className="relative my-3 overflow-hidden rounded-lg border border-border bg-muted/50">
      <button
        type="button"
        onClick={onCopy}
        aria-label={copied ? t("chat.copied") : t("chat.copy")}
        className="absolute right-2 top-2 rounded-md bg-background/80 px-2 py-1 text-xs text-muted-foreground shadow-sm hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {copied ? t("chat.copied") : t("chat.copy")}
      </button>
      <pre
        ref={preRef}
        className="overflow-x-auto p-3 text-xs leading-relaxed text-foreground"
        {...props}
      />
    </div>
  );
}

// ---------- Composer ----------

function Composer({
  value,
  onChange,
  onSend,
  onStop,
  onKeyDown,
  sending,
  textareaRef,
  inline = false,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  onKeyDown: (e: ReactKeyboardEvent<HTMLTextAreaElement>) => void;
  sending: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  inline?: boolean;
}) {
  const { t } = useTranslation();
  const canSend = value.trim().length > 0 && !sending;

  return (
    <div
      className={
        inline
          ? "w-full"
          : "border-t border-transparent bg-gradient-to-t from-background via-background/95 to-background/0 px-4 pb-4 pt-4 md:px-8"
      }
    >
      <div className="mx-auto w-full max-w-3xl">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canSend) onSend();
          }}
          className="flex items-end gap-2 rounded-3xl border border-border/70 bg-card/80 p-2 shadow-[var(--shadow-elevated)] backdrop-blur-xl transition-all focus-within:border-accent/50 focus-within:ring-2 focus-within:ring-accent/20"
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            disabled={sending}
            placeholder={t("chat.composerPlaceholder")}
            aria-label={t("chat.composerPlaceholder")}
            className="max-h-56 min-h-[36px] flex-1 resize-none border-0 bg-transparent px-2.5 py-2 text-base leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none md:text-sm"
          />
          {sending ? (
            <button
              type="button"
              onClick={onStop}
              aria-label={t("chat.stop")}
              title={t("chat.stop")}
              className="tap-press grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-glow-gold)] transition-all hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Square size={14} className="fill-current" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!canSend}
              aria-label={t("chat.send")}
              title={t("chat.send")}
              className={
                "tap-press grid h-10 w-10 shrink-0 place-items-center rounded-full text-primary-foreground transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none " +
                (canSend
                  ? "bg-primary shadow-[var(--shadow-glow-gold)] hover:bg-primary/90"
                  : "bg-primary/80")
              }
            >
              <ArrowUp size={16} aria-hidden="true" />
            </button>
          )}
        </form>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          {t("chat.disclaimerLong")}
        </p>
      </div>
    </div>
  );
}

// ---------- Utils ----------

async function copy(text: string) {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
    }
  } catch {
    // clipboard may be blocked; the visual "copied" flash is harmless
  }
}

// ---------- Extras: typing indicator, error row, conversation grouping ----------

function TypingRow({ phase }: { phase: "connecting" | "thinking" | "reconnecting" }) {
  const { t } = useTranslation();
  const label =
    phase === "reconnecting"
      ? t("chat.phaseReconnecting")
      : phase === "thinking"
        ? t("chat.phaseThinking")
        : t("chat.phaseConnecting");
  return (
    <div className="motion-fade-up flex items-center">
      <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/5 px-3.5 py-1.5 text-xs font-medium text-accent backdrop-blur">
        <span className="flex gap-1" aria-hidden="true">
          <span
            className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-accent motion-reduce:animate-none"
            style={{ animationDelay: "0ms" }}
          />
          <span
            className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-accent motion-reduce:animate-none"
            style={{ animationDelay: "150ms" }}
          />
          <span
            className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-accent motion-reduce:animate-none"
            style={{ animationDelay: "300ms" }}
          />
        </span>
        <span>{label}</span>
      </div>
    </div>
  );
}

function ErrorRow({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div
      role="alert"
      className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-foreground"
    >
      <p>{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 inline-flex min-h-[36px] items-center rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
      >
        {t("chat.retry")}
      </button>
    </div>
  );
}

type ConversationGroup = {
  label: string;
  items: Array<{ id: string; title: string }>;
};

function groupConversations(
  list: Conversation[],
  query: string,
  t: (k: string) => string,
): ConversationGroup[] {
  const q = query.trim().toLowerCase();
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
  const start7 = startOfToday - 7 * 24 * 60 * 60 * 1000;

  const buckets: Record<string, Array<{ id: string; title: string }>> = {
    today: [],
    yesterday: [],
    previous7: [],
    older: [],
  };

  for (const c of list) {
    const title = (c.title ?? "").trim() || "New chat";
    if (q && !title.toLowerCase().includes(q)) continue;
    const ts = new Date(c.updated_at).getTime();
    let bucket: keyof typeof buckets;
    if (ts >= startOfToday) bucket = "today";
    else if (ts >= startOfYesterday) bucket = "yesterday";
    else if (ts >= start7) bucket = "previous7";
    else bucket = "older";
    buckets[bucket].push({ id: c.id, title });
  }

  const groups: ConversationGroup[] = [];
  if (buckets.today.length) groups.push({ label: t("chat.groups.today"), items: buckets.today });
  if (buckets.yesterday.length)
    groups.push({
      label: t("chat.groups.yesterday"),
      items: buckets.yesterday,
    });
  if (buckets.previous7.length)
    groups.push({
      label: t("chat.groups.previous7"),
      items: buckets.previous7,
    });
  if (buckets.older.length) groups.push({ label: t("chat.groups.older"), items: buckets.older });
  return groups;
}
