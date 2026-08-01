type CornerSpec = {
  x: number;
  y: number;
  /** rotation (deg) for the center petal — the fan's two side petals sit ±22° from this */
  angle: number;
};

const CORNERS: CornerSpec[] = [
  { x: 0, y: 0, angle: 135 },
  { x: 100, y: 0, angle: 225 },
  { x: 100, y: 100, angle: 315 },
  { x: 0, y: 100, angle: 45 },
];

/** Single petal outline, apex at origin, pointing "up" (-Y) before rotation. */
function petalPath(length: number, width: number) {
  return `M 0 0 C ${-width} ${-length * 0.4} ${-width * 0.55} ${-length * 0.85} 0 ${-length} C ${width * 0.55} ${-length * 0.85} ${width} ${-length * 0.4} 0 0 Z`;
}

/**
 * Decorative lotus-corner ornaments + double-rule border for ChartFrame.
 * Pure engraved linework — never touches or wraps the chart SVG itself.
 */
export function LotusCorners() {
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full text-accent"
      aria-hidden="true"
    >
      {/* double-rule border */}
      <rect
        x={1.5}
        y={1.5}
        width={97}
        height={97}
        fill="none"
        stroke="currentColor"
        strokeWidth={0.3}
        opacity={0.5}
        vectorEffect="non-scaling-stroke"
      />
      <rect
        x={3}
        y={3}
        width={94}
        height={94}
        fill="none"
        stroke="currentColor"
        strokeWidth={0.3}
        opacity={0.35}
        vectorEffect="non-scaling-stroke"
      />

      {/* lotus blooms — one fan of 3 petals per corner, opening inward */}
      {CORNERS.map((c, i) => (
        <g
          key={i}
          transform={`translate(${c.x} ${c.y})`}
          className={`motion-fade-in motion-delay-${i + 1}`}
        >
          {/* lotus bloom at half opacity vs. the double-rule border/ticks */}
          <g opacity={0.5}>
            <g transform={`rotate(${c.angle})`}>
              <path
                d={petalPath(17, 4.6)}
                fill="color-mix(in oklab, var(--accent) 8%, transparent)"
                stroke="currentColor"
                strokeWidth={0.45}
                vectorEffect="non-scaling-stroke"
              />
              <path
                d={`M 0 -1 L 0 ${-17 * 0.88}`}
                fill="none"
                stroke="currentColor"
                strokeWidth={0.25}
                opacity={0.6}
                vectorEffect="non-scaling-stroke"
              />
            </g>
            <g transform={`rotate(${c.angle - 24})`}>
              <path
                d={petalPath(12.5, 3.4)}
                fill="color-mix(in oklab, var(--accent) 6%, transparent)"
                stroke="currentColor"
                strokeWidth={0.4}
                vectorEffect="non-scaling-stroke"
              />
            </g>
            <g transform={`rotate(${c.angle + 24})`}>
              <path
                d={petalPath(12.5, 3.4)}
                fill="color-mix(in oklab, var(--accent) 6%, transparent)"
                stroke="currentColor"
                strokeWidth={0.4}
                vectorEffect="non-scaling-stroke"
              />
            </g>
            <circle cx={0} cy={0} r={1.1} fill="currentColor" opacity={0.7} />
          </g>
        </g>
      ))}
    </svg>
  );
}
