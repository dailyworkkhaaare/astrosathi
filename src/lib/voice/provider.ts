// src/lib/voice/provider.ts
// Swappable speech engine. Today it talks to our Supabase edge functions
// (which proxy Sarvam). To switch engines later, implement VoiceProvider with
// another class and change the one exported line at the bottom -- nothing else
// in the app needs to change.

import { supabase } from "@/integrations/supabase/client";

export interface SynthOpts {
  speaker?: string;
  pace?: number;
}

export interface SynthResult {
  clips: string[]; // base64-encoded audio clips, played back-to-back
  mime: string; // e.g. "audio/mpeg"
}

export interface VoiceProvider {
  // Transcribe one <=30s audio blob into text.
  transcribe(audio: Blob, langCode: string): Promise<string>;
  // Synthesize speech; returns one or more audio clips (long text is chunked).
  synthesize(
    text: string,
    langCode: string,
    opts?: SynthOpts,
  ): Promise<SynthResult>;
}

// Convert an audio Blob to a base64 string (no data-URL prefix). We send audio
// as base64 JSON because supabase.functions.invoke() is unreliable with
// multipart/FormData bodies in the browser.
async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const CHUNK = 0x8000; // 32KB chunks to avoid call-stack limits
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

class SarvamProvider implements VoiceProvider {
  async transcribe(audio: Blob, langCode: string): Promise<string> {
    const audioBase64 = await blobToBase64(audio);
    const { data, error } = await supabase.functions.invoke("speech-to-text", {
      body: {
        audio_base64: audioBase64,
        mime: audio.type || "audio/webm",
        language_code: langCode || "unknown",
      },
    });
    if (error) throw error;
    return ((data as { transcript?: string })?.transcript ?? "").trim();
  }

  async synthesize(
    text: string,
    langCode: string,
    opts: SynthOpts = {},
  ): Promise<SynthResult> {
    const { data, error } = await supabase.functions.invoke("text-to-speech", {
      body: {
        text,
        language_code: langCode,
        speaker: opts.speaker,
        pace: opts.pace,
      },
    });
    if (error) throw error;
    const d = data as { audios?: string[]; mime?: string };
    return { clips: d?.audios ?? [], mime: d?.mime ?? "audio/mpeg" };
  }
}

// --- Swap point: change ONLY this line to switch engines in the future. ---
export const voiceProvider: VoiceProvider = new SarvamProvider();
