/** Default opacity for the watermark — kept low so chart lines/text stay AA-legible over it. */
export const GANESHA_WATERMARK_OPACITY = 0.05;

/**
 * Single-line engraved outline of Ganesha, centered behind the kundli chart.
 * Deliberately minimal/geometric — never cartoon zodiac art (design.md law).
 */
export function GaneshaWatermark({ opacity = GANESHA_WATERMARK_OPACITY }: { opacity?: number }) {
  return (
    <svg
      viewBox="0 0 200 200"
      className="pointer-events-none absolute inset-0 m-auto h-[70%] w-[70%] text-accent"
      style={{ opacity }}
      aria-hidden="true"
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* crown */}
        <path d="M 78 22 Q 100 8 122 22 L 118 34 Q 100 26 82 34 Z" />
        <circle cx="100" cy="16" r="3" />
        {/* ears */}
        <path d="M 62 62 Q 34 58 30 84 Q 28 106 52 108 Q 68 108 72 92" />
        <path d="M 138 62 Q 166 58 170 84 Q 172 106 148 108 Q 132 108 128 92" />
        {/* head outline */}
        <path d="M 72 92 Q 68 50 100 44 Q 132 50 128 92 Q 130 122 100 130 Q 70 122 72 92 Z" />
        {/* trunk */}
        <path d="M 100 130 Q 96 150 108 162 Q 118 172 108 182 Q 100 188 92 180" />
        {/* tusk */}
        <path d="M 92 132 Q 84 140 88 150" />
        {/* neck / shoulders */}
        <path d="M 66 150 Q 100 170 134 150 L 134 176 Q 100 196 66 176 Z" />
      </g>
    </svg>
  );
}
