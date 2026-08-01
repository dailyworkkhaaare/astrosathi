/** Default opacity for the watermark — kept low so chart lines/text stay AA-legible over it. */
export const GANESHA_WATERMARK_OPACITY = 0.05;

/**
 * Single-line engraved side-profile silhouette of Ganesha, centered behind the
 * kundli chart. Deliberately minimal — never cartoon zodiac art (design.md law).
 */
export function GaneshaWatermark({ opacity = GANESHA_WATERMARK_OPACITY }: { opacity?: number }) {
  return (
    <svg
      viewBox="0 0 200 220"
      className="pointer-events-none absolute inset-0 m-auto h-[68%] w-[68%] text-accent"
      style={{ opacity }}
      aria-hidden="true"
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* seated body beneath the head */}
        <ellipse cx="100" cy="146" rx="46" ry="45" />

        {/* ear, fan-shaped oval behind/above the head */}
        <ellipse
          cx="150"
          cy="60"
          rx="37"
          ry="23"
          transform="rotate(-20 150 60)"
          fill="color-mix(in oklab, var(--accent) 7%, transparent)"
        />

        {/* elephant head */}
        <ellipse cx="93" cy="62" rx="32" ry="36" />

        {/* crown / mukut peak */}
        <path d="M 79 24 Q 89 10 99 24 L 92 32 Q 89 27 86 32 Z" />

        {/* trunk — curves down from the mouth then curls inward at the tip */}
        <path
          d="M 71 92 Q 54 106 47 129 Q 41 150 58 160 Q 70 167 68 152 Q 66 140 54 142"
          strokeWidth={2.6}
        />

        {/* tusk */}
        <path d="M 68 96 Q 58 100 56 111" strokeWidth={1.5} />

        {/* eye */}
        <circle cx="80" cy="52" r="2.6" fill="currentColor" stroke="none" />
      </g>
    </svg>
  );
}
