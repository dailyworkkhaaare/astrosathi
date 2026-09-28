import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { triggerHaptic } from "@/lib/native-device";

export function TodayBackButton({ label }: { label: string }) {
  return (
    <Link
      to="/today"
      aria-label={label}
      onClick={() => void triggerHaptic("selection")}
      className="tap-press inline-grid h-11 w-11 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ArrowLeft size={18} aria-hidden="true" />
    </Link>
  );
}
