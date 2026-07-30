import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
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

type ChatRole = "user" | "assistant";
export type ChatMessage = { id: string; role: ChatRole; content: string };
type Conversation = { id: string; title: string | null; updated_at: string };

function newId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Calls the astrologer-chat Edge Function in streaming mode and invokes the
// handlers as Server-Sent Events arrive. We can't use supabase.functions.invoke
// here because it buffers the whole response; we need the raw streaming body.
async function streamAstrologerReply(
  args: { message: string; conversationId: string | null },
  handlers: {
    onMeta?: (conversationId: string) => void;
    onDelta: (text: string) => void;
  },
): Promise<void> {
  // Reuse the configured functions URL + apikey from the supabase client so we
  // don't hardcode project details or depend on env-var names.
  const fnClient = supabase.functions as unknown as {
    url: string;
    headers: Record<string, string>;
  };
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  const res = await fetch(`${fnClient.url}/astrologer-chat`, {
    method: "POST",
    headers: {
      ...fnClient.headers,
      "content-type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({
      message: args.message,
      conversation_id: args.conversationId || undefined,
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

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
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

  if (streamError) throw new Error(streamError);
}

const MAX_SEED_LENGTH = 500;

type ChatSearch = { seed?: string };

export const Route = createFileRoute("/chat")({
  validateSearch: (search: Record<string, unknown>): ChatSearch => {
    const raw = search.seed;
    if (typeof raw !== "string") return {};
    const trimmed = raw.trim();
    if (!trimmed || trimmed.length > MAX_SEED_LENGTH) return {};
    return { seed: trimmed };
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
  const { seed } = Route.useSearch();
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
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFailed, setLastFailed] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  // Id of the assistant message currently being streamed (for the live caret).
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  // Cancel any in-flight stream/typewriter cleanly.
  const abortActiveStream = useCallback(() => {
    cancelStreamRef.current?.();
    cancelStreamRef.current = null;
    abortRef.current?.abort();
    abortRef.current = null;
    cancelPendingFrame();
    activeStreamIdRef.current = null;
    bufferRef.current = "";
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
    const { data } = await supabase
      .from("chat_messages")
      .select("role, content, created_at")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });
    const rows = Array.isArray(data) ? data : [];
    setMessages(
      rows
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
          id: newId(),
          role: m.role as ChatRole,
          content: String(m.content ?? ""),
        })),
    );
    setPinnedToBottom(true);
  }, []);

  // Initial mount: fetch conversations, open the most recent one only if it
  // was active in the last 15 minutes. After a longer gap the user is most
  // likely here to ask something new, so land on the empty composer instead
  // of resuming a stale conversation — still browsable from the sidebar.
  // Skipped entirely when a `?seed=` is present (e.g. tapping a house on
  // Home): that's an explicit signal to ask something new, so resuming an
  // old conversation would both land on the wrong thread and silently drop
  // the seed (its pre-fill effect below only applies to an empty thread).
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
      if (mostRecent && isRecent && !seed) {
        await loadConversation(mostRecent.id);
      }
      if (!cancelled) setInitialLoadDone(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only; `seed` is read once by design, not re-triggered on later changes (e.g. once cleared by the pre-fill effect below).
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
  // today" bridge from Home) — never auto-sent, the user still presses send.
  // Only applies to a genuinely empty conversation, and the param is stripped
  // right after so a refresh or reload doesn't re-inject it.
  useEffect(() => {
    if (!initialLoadDone || !seed || messages.length > 0) return;
    setInput(seed);
    textareaRef.current?.focus();
    void navigate({ search: {}, replace: true });
  }, [initialLoadDone, seed, messages.length, navigate]);

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
    if (pinnedToBottom) {
      bottomRef.current?.scrollIntoView({ block: "end" });
    }
  }, [messages, sending, pinnedToBottom]);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    setPinnedToBottom(true);
  };

  // ---- Send via real Edge Function (streaming) ----
  const sendToBackend = useCallback(
    async (text: string) => {
      setSending(true);
      setError(null);
      setLastFailed(null);

      // Cancel any previous in-flight stream before starting a new one.
      abortActiveStream();

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
      };

      let receivedAny = false;

      // ---- 1) Try SSE streaming first ----
      try {
        await streamAstrologerReply(
          { message: text, conversationId },
          {
            onMeta: (cid) => {
              if (cid && cid !== conversationId) setConversationId(cid);
            },
            onDelta: (chunk) => {
              if (!chunk) return;
              receivedAny = true;
              ensurePlaceholder();
              bufferRef.current += chunk;
              scheduleFlush();
            },
          },
        );

        // Stream succeeded with content — commit final and stop streaming.
        if (receivedAny && bufferRef.current.trim().length > 0) {
          cancelPendingFrame();
          const finalText = bufferRef.current;
          setMessages((prev) => {
            const idx = prev.findIndex((m) => m.id === assistantId);
            if (idx === -1) return prev;
            const next = prev.slice();
            next[idx] = { ...next[idx], content: finalText };
            return next;
          });
          setStreamingId(null);
          setSending(false);
          activeStreamIdRef.current = null;
          bufferRef.current = "";
          void refetchConversations();
          return;
        }
        // Otherwise fall through to typewriter fallback below.
      } catch (streamErr) {
        console.warn("[astrologer-chat] stream failed, falling back:", streamErr);
        // Fall through to typewriter fallback.
      }

      // ---- 2) Buffered fallback with client-side typewriter reveal ----
      try {
        const { data, error: invokeErr } = await supabase.functions.invoke("astrologer-chat", {
          body: {
            message: text,
            conversation_id: conversationId || undefined,
          },
        });
        if (invokeErr) throw invokeErr;
        const payload = (data ?? {}) as {
          reply?: string;
          conversation_id?: string;
        };
        if (payload.conversation_id && payload.conversation_id !== conversationId)
          setConversationId(payload.conversation_id);
        const reply = (payload.reply ?? "").trim();
        if (!reply) throw new Error("empty_response");

        ensurePlaceholder();
        bufferRef.current = "";
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
        setStreamingId(null);
        activeStreamIdRef.current = null;
        bufferRef.current = "";
        void refetchConversations();
      } catch (e) {
        console.error("[astrologer-chat] request failed:", e);
        // Remove the empty placeholder so the error UI stands alone.
        if (placeholderInserted) {
          setMessages((prev) => prev.filter((m) => m.id !== assistantId));
        }
        setLastFailed(text);
        setError(t("chat.errorGeneric"));
        setStreamingId(null);
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
      await sendToBackend(text);
    },
    [sending, sendToBackend],
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
    setInput("");
    setConversationId(null);
    setError(null);
    setLastFailed(null);
    setPinnedToBottom(true);
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
                  aria-live="polite"
                  aria-label={t("chat.title")}
                  className="h-full overflow-y-auto scroll-smooth"
                >
                  <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-6 md:px-8 md:py-10">
                    {messages.map((m) => (
                      <MessageRow
                        key={m.id}
                        message={m}
                        streaming={m.id === streamingId}
                        onCopy={() => copy(m.content)}
                        onEdit={undefined}
                      />
                    ))}
                    {sending && !streamingId && <TypingRow />}
                    {error && <ErrorRow message={error} onRetry={handleRetry} />}
                    <div ref={bottomRef} />
                  </div>
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
            className="tap-press min-h-11 flex-1 rounded-lg border border-destructive/40 bg-destructive/10 px-2 text-xs font-medium text-destructive hover:bg-destructive/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive"
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

// While a reply is still streaming in, the tail of the buffer can briefly
// contain a dangling markdown token (an opening **/* or ``` fence with no
// closing partner yet). Rendered as-is that flashes a stray literal marker
// or an open-ended code block for a frame until the next chunk arrives, so
// we trim just the trailing partial token — only during the live stream;
// the final commit always renders the untouched text.
function sanitizeStreamingMarkdown(text: string, streaming: boolean): string {
  if (!streaming || !text) return text;

  let out = text;
  const fenceCount = (out.match(/```/g) ?? []).length;
  if (fenceCount % 2 === 1) {
    out = out.slice(0, out.lastIndexOf("```"));
  }

  return out.replace(/(\*\*|\*|`)$/, "");
}

function MessageRow({
  message,
  streaming,
  onCopy,
  onEdit,
}: {
  message: ChatMessage;
  streaming: boolean;
  onCopy: () => void;
  onEdit?: () => void;
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
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
              {t("chat.generating")}
            </span>
          )}
        </div>
        <div className="prose max-w-none text-foreground [&_a]:text-primary [&_a]:underline [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&>h1]:max-w-[34rem] [&_h1]:text-lg [&_h1]:font-semibold [&>h2]:max-w-[34rem] [&_h2]:text-base [&_h2]:font-semibold [&>p]:max-w-[34rem] [&_p]:my-2 [&_p]:leading-relaxed [&>ul]:max-w-[34rem] [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&>ol]:max-w-[34rem] [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              pre: (props) => <CodeBlock {...props} />,
              blockquote: ({ children }) => (
                <blockquote className="my-3 max-w-[34rem] border-l-2 border-accent/60 bg-accent/5 py-2 pl-4 pr-3 text-sm italic text-foreground/90 rounded-r-lg">
                  {children}
                </blockquote>
              ),
              code: ({ className, children, ...rest }) => (
                <code className={className} {...rest}>
                  {children}
                </code>
              ),
              table: ({ node: _node, ...props }) => (
                <div className="my-4 w-full overflow-x-auto rounded-lg border border-border">
                  <table {...props} className="w-full border-collapse text-left text-sm" />
                </div>
              ),
              thead: ({ node: _node, ...props }) => <thead {...props} className="bg-muted" />,
              tbody: ({ node: _node, ...props }) => <tbody {...props} />,
              tr: ({ node: _node, ...props }) => <tr {...props} className="even:bg-muted/40" />,
              th: ({ node: _node, ...props }) => (
                <th
                  {...props}
                  className="!border !border-border px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-foreground whitespace-nowrap"
                />
              ),
              td: ({ node: _node, ...props }) => (
                <td
                  {...props}
                  className="!border !border-border px-4 py-2.5 align-top text-foreground"
                />
              ),
            }}
          >
            {sanitizeStreamingMarkdown(message.content ?? "", streaming)}
          </ReactMarkdown>
        </div>
        {!streaming && message.content && (
          <div className="mt-2 flex items-center gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100">
            <IconAction label={copied ? t("chat.copied") : t("chat.copy")} onClick={doCopy}>
              {copied ? <Check size={14} className="text-accent" /> : <Copy size={14} />}
            </IconAction>
          </div>
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
  onKeyDown,
  sending,
  textareaRef,
  inline = false,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
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

function TypingRow() {
  const { t } = useTranslation();
  return (
    <div className="motion-fade-up flex items-center" aria-live="polite">
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
        <span>{t("chat.typing")}…</span>
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
