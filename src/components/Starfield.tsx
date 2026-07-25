import { useMemo } from "react";

/**
 * Celestial backdrop: layered radial gradient nebula + deterministic star field.
 * Purely decorative (aria-hidden). Sized to fill its positioned parent.
 */
export function Starfield({
  density = 70,
  className = "",
}: {
  density?: number;
  className?: string;
}) {
  const stars = useMemo(() => {
    // Deterministic pseudo-random so SSR + client match.
    const out: { x: number; y: number; r: number; o: number; d: number }[] = [];
    let seed = 1337;
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    for (let i = 0; i < density; i++) {
      out.push({
        x: rand() * 100,
        y: rand() * 100,
        r: 0.4 + rand() * 1.4,
        o: 0.25 + rand() * 0.7,
        d: 2 + rand() * 5,
      });
    }
    return out;
  }, [density]);

  return (
    <div
      aria-hidden="true"
      className={"pointer-events-none absolute inset-0 overflow-hidden " + className}
    >
      {/* Deep space base */}
      <div className="absolute inset-0" style={{ background: "var(--gradient-night)" }} />
      {/* Warm nebula wash */}
      <div
        className="absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(60% 45% at 80% 15%, color-mix(in oklab, var(--glow-gold) 22%, transparent), transparent 70%), radial-gradient(50% 40% at 15% 85%, color-mix(in oklab, var(--glow-violet) 25%, transparent), transparent 70%)",
        }}
      />
      {/* Stars */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {stars.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r * 0.12} fill="var(--on-night)" opacity={s.o}>
            <animate
              attributeName="opacity"
              values={`${s.o};${Math.max(0.05, s.o - 0.5)};${s.o}`}
              dur={`${s.d}s`}
              repeatCount="indefinite"
            />
          </circle>
        ))}
      </svg>
      {/* Vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 55%, color-mix(in oklab, var(--night-surface) 55%, transparent) 100%)",
        }}
      />
    </div>
  );
}
