import type { ReactNode } from "react";

import { AstrolabeCorners } from "@/components/chart/AstrolabeCorners";
import { GaneshaWatermark } from "@/components/chart/GaneshaWatermark";

/**
 * "Manuscript Frame" — aged-paper surface + engraved astrolabe corners + a
 * faint Ganesha watermark around the kundli chart. Decorative-only wrapper:
 * never touches the chart SVG string, which is passed in unchanged as children.
 */
export function ChartFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative mx-auto w-full max-w-md motion-chart-unfurl">
      <div className="relative overflow-hidden rounded-lg border border-border p-2">
        {/* aged-paper surface, theme-aware via tokens only */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: [
              "radial-gradient(ellipse at 30% 15%, color-mix(in oklab, var(--accent) 7%, transparent) 0%, transparent 60%)",
              "repeating-linear-gradient(115deg, color-mix(in oklab, var(--foreground) 3%, transparent) 0px, transparent 1.5px, transparent 5px)",
              "repeating-linear-gradient(25deg, color-mix(in oklab, var(--foreground) 2%, transparent) 0px, transparent 1px, transparent 6px)",
            ].join(", "),
            backgroundColor: "color-mix(in oklab, var(--card) 55%, var(--background) 45%)",
          }}
        />

        <GaneshaWatermark />

        <div className="relative">{children}</div>
      </div>

      <AstrolabeCorners />
    </div>
  );
}
