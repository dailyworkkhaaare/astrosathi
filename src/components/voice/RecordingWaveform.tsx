// Live audio waveform for the chat composer's mic recording state. Reads the
// live MediaStream via a Web Audio AnalyserNode, samples byte-frequency data
// each animation frame, and paints amber vertical bars into a canvas.
//
// Feature-detects Web Audio; on unsupported browsers or a missing stream it
// falls back to a calm placeholder row of bars so the composer never breaks.

import { useEffect, useRef } from "react";

interface Props {
  stream: MediaStream | null;
  className?: string;
  // Bar count is derived from width; if a caller wants a denser look they can
  // pass a barWidth override (in CSS px, pre-DPR).
  barWidth?: number;
  barGap?: number;
}

export function RecordingWaveform({ stream, className, barWidth = 3, barGap = 2 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const w = typeof window !== "undefined" ? window : null;
    const AudioCtx =
      (w as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext } | null)
        ?.AudioContext ??
      (w as unknown as { webkitAudioContext?: typeof AudioContext } | null)?.webkitAudioContext ??
      null;

    let raf = 0;
    let audioCtx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let data: Uint8Array<ArrayBuffer> | null = null;
    let disposed = false;

    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;

    // Read the amber accent from the design tokens so light/dark both look right.
    const readAccent = (): string => {
      const root = getComputedStyle(document.documentElement);
      const color = root.getPropertyValue("--accent-foreground") || root.getPropertyValue("--accent");
      const trimmed = color.trim();
      // CSS tokens are HSL triples like "35 65% 55%"; wrap for canvas.
      if (/^\d/.test(trimmed) && trimmed.includes("%")) return `hsl(${trimmed})`;
      return trimmed || "#D99A3D";
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cssW = canvas.clientWidth;
      const cssH = canvas.clientHeight;
      canvas.width = Math.max(1, Math.floor(cssW * dpr));
      canvas.height = Math.max(1, Math.floor(cssH * dpr));
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const setup = () => {
      if (!stream || !AudioCtx) return;
      try {
        audioCtx = new AudioCtx();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.75;
        source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);
        data = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
      } catch {
        audioCtx = null;
        analyser = null;
      }
    };
    setup();

    const draw = () => {
      if (disposed) return;
      raf = requestAnimationFrame(draw);
      const cssW = canvas.clientWidth;
      const cssH = canvas.clientHeight;
      const midY = cssH / 2;
      const step = barWidth + barGap;
      const bars = Math.max(4, Math.floor(cssW / step));
      const accent = readAccent();
      ctx2d.clearRect(0, 0, cssW, cssH);
      ctx2d.fillStyle = accent;

      if (analyser && data) {
        analyser.getByteFrequencyData(data);
        // Sample `bars` evenly across the spectrum, biasing to the voice band.
        const usableBins = Math.floor(data.length * 0.55);
        for (let i = 0; i < bars; i++) {
          const bin = Math.floor((i / bars) * usableBins);
          const v = data[bin] / 255; // 0..1
          const eased = Math.pow(v, 0.8);
          const h = Math.max(2, eased * cssH * 0.92);
          const x = i * step;
          ctx2d.globalAlpha = 0.55 + eased * 0.45;
          ctx2d.fillRect(x, midY - h / 2, barWidth, h);
        }
        ctx2d.globalAlpha = 1;
      } else {
        // Placeholder ripple when there's no audio stream (Web Audio missing,
        // permission still pending, etc.) — a gentle animated baseline so the
        // area doesn't look broken.
        const t = performance.now() / 400;
        for (let i = 0; i < bars; i++) {
          const wave = 0.35 + 0.35 * Math.sin(t + i * 0.35);
          const h = Math.max(2, wave * cssH * 0.5);
          ctx2d.globalAlpha = 0.35;
          ctx2d.fillRect(i * step, midY - h / 2, barWidth, h);
        }
        ctx2d.globalAlpha = 1;
      }
    };
    raf = requestAnimationFrame(draw);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      try {
        source?.disconnect();
      } catch {
        /* ignore */
      }
      try {
        analyser?.disconnect();
      } catch {
        /* ignore */
      }
      try {
        void audioCtx?.close();
      } catch {
        /* ignore */
      }
    };
  }, [stream, barWidth, barGap]);

  return (
    <canvas
      ref={canvasRef}
      className={className ?? "block h-full w-full"}
      aria-hidden="true"
    />
  );
}
