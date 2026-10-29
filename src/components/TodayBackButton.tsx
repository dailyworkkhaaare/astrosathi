import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useTranslation } from "react-i18next";

import { triggerHaptic } from "@/lib/native-device";

/** Gold "‹ Today" back link shared by the Today detail screens. */
export function TodayBackButton({ label }: { label: string }) {
  const { t } = useTranslation();
  return (
    <nav className="-mx-2 -mt-2 flex min-h-11 items-center">
      <Link
        to="/today"
        aria-label={label}
        onClick={() => void triggerHaptic("selection")}
        className="tap-press inline-flex h-11 items-center gap-0.5 rounded-full pl-1 pr-3 text-[1.0625rem] text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronLeft size={22} aria-hidden="true" />
        {t("nav.today")}
      </Link>
    </nav>
  );
}
