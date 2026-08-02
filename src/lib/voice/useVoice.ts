// src/lib/voice/useVoice.ts
// Voice hooks for AstroSaathi: mic input (with long-speech segmenting) and
// tap-to-play read-aloud. Nothing auto-plays -- read-aloud only ever runs when
// the user taps a speaker icon.

import { useCallback, useEffect, useRef, useState } from "react";
import { voiceProvider } from "./provider";

// Rotate recording well under Sarvam's 30s STT limit so a user can speak for
// minutes; each segment is transcribed and stitched together in order.
const SEGMENT_MS = 20_000;
// Hard safety cap (5 min) so a forgotten-open mic can't burn credits.
const MAX_MS = 300_000;

export type SttLang = "auto" | "en" | "hi" | "mr";

export interface VoiceSettings {
  inputEnabled: boolean;
  sttLang: SttLang;
  speaker: string;
  pace: number;
}

const VOICE_SETTINGS_KEY = "astrosaathi.voice.v1";
const DEFAULT_SETTINGS: VoiceSettings = {
  inputEnabled: true,
  sttLang: "auto",
  speaker: "shubh",
  pace: 1.0,
};

export function loadVoiceSettings(): VoiceSettings {
  try {
    const raw = localStorage.getItem(VOICE_SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return {
      ...DEFAULT_SETTINGS,
      ...(JSON.parse(raw) as Partial<VoiceSettings>),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function useVoiceSettings() {
  const [settings, setSettings] = useState<VoiceSettings>(loadVoiceSettings);
  const update = useCallback((patch: Partial<VoiceSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(VOICE_SETTINGS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);
  return { settings, update };
}

// Map app language (and optional user override) to a Sarvam BCP-47 code.
export function langToBCP47(
  appLang: string,
  override: SttLang = "auto",
): string {
  const lang = override === "auto" ? appLang : override;
  switch (lang) {
    case "hi":
      return "hi-IN";
    case "mr":
      return "mr-IN";
    case "en":
      return "en-IN";
    default:
      return "unknown";
  }
}

// Strip markdown so read-aloud sounds natural (no asterisks, backticks, etc.).
export function stripMarkdownForSpeech(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_~>#]/g, "")
    .replace(/\|/g, " ")
    .replace(/\n{2,}/g, ". ")
    .replace(/\s+/g, " ")
    .trim();
}

function pickMimeType(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  for (const c of candidates) {
    if (
      typeof MediaRecorder !== "undefined" &&
      MediaRecorder.isTypeSupported?.(c)
    ) {
      return c;
    }
  }
  return "";
}

// --- Mic input -----------------------------------------------------------
export function useSpeechRecognition(opts: {
  langCode: string;
  onPartial: (text: string) => void;
  onError?: (message: string) => void;
}) {
  const { langCode, onPartial, onError } = opts;
  const supported =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined";

  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  // Exposed so the composer can render a live waveform from the mic stream.
  const [stream, setStream] = useState<MediaStream | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const rotateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stoppingRef = useRef(false);
  const startedAtRef = useRef(0);
  const transcriptRef = useRef("");
  const chainRef = useRef<Promise<void>>(Promise.resolve());
  const mimeRef = useRef("");
  const langRef = useRef(langCode);
  langRef.current = langCode;

  const cleanup = useCallback(() => {
    if (rotateTimerRef.current) {
      clearTimeout(rotateTimerRef.current);
      rotateTimerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    setStream(null);
    setRecording(false);
  }, []);

  const transcribeBlob = useCallback(
    (blob: Blob) => {
      if (!blob || blob.size === 0) return;
      // Chain so transcripts append in the order segments were recorded.
      chainRef.current = chainRef.current.then(async () => {
        try {
          setBusy(true);
          const text = await voiceProvider.transcribe(blob, langRef.current);
          if (text) {
            transcriptRef.current = (transcriptRef.current + " " + text).trim();
            onPartial(transcriptRef.current);
          }
        } catch (e) {
          onError?.(e instanceof Error ? e.message : String(e));
        } finally {
          setBusy(false);
        }
      });
    },
    [onPartial, onError],
  );

  const startSegment = useCallback(() => {
    const activeStream = streamRef.current;
    if (!activeStream) return;
    const recorder = new MediaRecorder(
      activeStream,
      mimeRef.current ? { mimeType: mimeRef.current } : undefined,
    );
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeRef.current || "audio/webm" });
      const elapsed = Date.now() - startedAtRef.current;
      // Start the next segment immediately (near-gapless), then transcribe the
      // finished blob in the background.
      if (!stoppingRef.current && elapsed < MAX_MS) {
        startSegment();
      } else {
        cleanup();
      }
      transcribeBlob(blob);
    };
    recorderRef.current = recorder;
    recorder.start();
    if (rotateTimerRef.current) clearTimeout(rotateTimerRef.current);
    rotateTimerRef.current = setTimeout(() => {
      if (recorderRef.current && recorderRef.current.state === "recording") {
        recorderRef.current.stop();
      }
    }, SEGMENT_MS);
  }, [cleanup, transcribeBlob]);

  const start = useCallback(async () => {
    if (!supported || recording) return;
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = media;
      setStream(media);
      mimeRef.current = pickMimeType();
      stoppingRef.current = false;
      transcriptRef.current = "";
      startedAtRef.current = Date.now();
      setRecording(true);
      startSegment();
    } catch (e) {
      onError?.(
        e instanceof Error && e.name === "NotAllowedError"
          ? "mic_denied"
          : e instanceof Error
            ? e.message
            : String(e),
      );
      cleanup();
    }
  }, [supported, recording, startSegment, onError, cleanup]);

  const stop = useCallback(() => {
    stoppingRef.current = true;
    if (rotateTimerRef.current) {
      clearTimeout(rotateTimerRef.current);
      rotateTimerRef.current = null;
    }
    const rec = recorderRef.current;
    if (rec && rec.state === "recording") {
      rec.stop(); // onstop handles final transcribe + cleanup
    } else {
      cleanup();
    }
    setRecording(false);
  }, [cleanup]);

  useEffect(() => () => cleanup(), [cleanup]);

  return { supported, recording, busy, stream, start, stop };
}

// --- Read-aloud (tap to play only) --------------------------------------
export function useReadAloud(opts?: { onError?: (message: string) => void }) {
  const onError = opts?.onError;
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stoppedRef = useRef(false);

  const stop = useCallback(() => {
    stoppedRef.current = true;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    setPlayingId(null);
    setLoadingId(null);
  }, []);

  const play = useCallback(
    async (
      messageId: string,
      text: string,
      langCode: string,
      synthOpts?: { speaker?: string; pace?: number },
    ) => {
      // Tapping the message that's already playing stops it.
      if (playingId === messageId) {
        stop();
        return;
      }
      stop();
      stoppedRef.current = false;
      const clean = stripMarkdownForSpeech(text);
      if (!clean) return;
      try {
        setLoadingId(messageId);
        const { clips, mime } = await voiceProvider.synthesize(
          clean,
          langCode,
          synthOpts,
        );
        setLoadingId(null);
        if (stoppedRef.current || clips.length === 0) return;
        setPlayingId(messageId);
        if (!audioRef.current) audioRef.current = new Audio();
        const el = audioRef.current;
        for (const b64 of clips) {
          if (stoppedRef.current) break;
          await new Promise<void>((resolve, reject) => {
            el.src = `data:${mime};base64,${b64}`;
            el.onended = () => resolve();
            el.onerror = () => reject(new Error("playback_error"));
            el.play().catch(reject);
          });
        }
      } catch (e) {
        onError?.(e instanceof Error ? e.message : String(e));
      } finally {
        setLoadingId(null);
        setPlayingId((cur) => (cur === messageId ? null : cur));
      }
    },
    [playingId, stop, onError],
  );

  useEffect(() => () => stop(), [stop]);

  return { playingId, loadingId, play, stop };
}
