/**
 * Decorative astrolabe-style corner ticks + double-rule border for ChartFrame.
 * Pure engraved linework — never touches or wraps the chart SVG itself.
 */
export function AstrolabeCorners() {
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

      {/* corner ticks — astrolabe-style alidade marks */}
      {[
        { x: 0, y: 0, dx: 1, dy: 1 },
        { x: 100, y: 0, dx: -1, dy: 1 },
        { x: 100, y: 100, dx: -1, dy: -1 },
        { x: 0, y: 100, dx: 1, dy: -1 },
      ].map((c, i) => (
        <g
          key={i}
          className="motion-corner-draw"
          style={{ ["--corner-dash" as string]: 40, animationDelay: `${i * 40}ms` }}
        >
          <path
            d={`M ${c.x + c.dx * 8} ${c.y + c.dy * 1.5} L ${c.x + c.dx * 1.5} ${c.y + c.dy * 1.5} L ${c.x + c.dx * 1.5} ${c.y + c.dy * 8}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={0.4}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <circle
            cx={c.x + c.dx * 1.5}
            cy={c.y + c.dy * 1.5}
            r={0.6}
            fill="currentColor"
            opacity={0.6}
          />
        </g>
      ))}
    </svg>
  );
}
