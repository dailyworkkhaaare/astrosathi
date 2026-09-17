import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { BrandMark } from "@/components/BrandMark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { APP_NAME } from "@/lib/brand";

export function AuthTransitionPage({ children }: { children: ReactNode }) {
  return (
    <main
      className="relative isolate flex min-h-dvh flex-col overflow-hidden p-4 text-on-night sm:p-6"
      style={{ background: "var(--gradient-night)" }}
    >
      <TransitionCosmos />
      <header className="relative mx-auto flex w-full max-w-[76rem] items-center justify-between">
        <Link
          to="/"
          aria-label={APP_NAME}
          className="inline-flex items-center gap-2 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <BrandMark withWordmark={false} className="h-8 w-8" />
          <span className="text-lg font-semibold tracking-tight text-on-night">{APP_NAME}</span>
        </Link>
        <div className="rounded-full border border-white/10 bg-white/[0.07] p-0.5 backdrop-blur-sm">
          <ThemeToggle />
        </div>
      </header>

      <div className="relative mx-auto flex w-full max-w-xl flex-1 items-center py-10 sm:py-14">
        {children}
      </div>

      <p className="relative text-center text-[0.65rem] uppercase tracking-[0.18em] text-on-night-subtle">
        {APP_NAME}
      </p>
    </main>
  );
}

function TransitionCosmos() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute -left-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-[oklch(0.55_0.22_302/0.2)] blur-3xl" />
      <div className="absolute -bottom-44 right-[-7rem] h-[32rem] w-[32rem] rounded-full bg-[oklch(0.69_0.16_75/0.12)] blur-3xl" />
      <svg
        className="absolute left-1/2 top-1/2 h-[42rem] w-[42rem] -translate-x-1/2 -translate-y-1/2 opacity-40"
        viewBox="0 0 680 680"
      >
        <circle cx="340" cy="340" r="248" fill="none" stroke="white" strokeOpacity=".08" />
        <circle cx="340" cy="340" r="178" fill="none" stroke="white" strokeOpacity=".06" />
        <ellipse
          cx="340"
          cy="340"
          rx="285"
          ry="103"
          fill="none"
          stroke="white"
          strokeOpacity=".06"
          transform="rotate(-24 340 340)"
        />
        <circle cx="340" cy="92" r="4" fill="currentColor" className="text-accent" />
        <circle cx="594" cy="409" r="3" fill="white" fillOpacity=".6" />
      </svg>
    </div>
  );
}
