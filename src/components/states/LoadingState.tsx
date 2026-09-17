import { useTranslation } from "react-i18next";
import { Orbit } from "lucide-react";

import { StateFrame, type StateScope } from "@/components/states/StateFrame";

export function LoadingState({
  label,
  description,
  scope = "panel",
}: {
  label?: string;
  description?: string;
  scope?: StateScope;
}) {
  const { t } = useTranslation();
  return (
    <StateFrame
      scope={scope}
      tone="loading"
      role="status"
      live="polite"
      busy
      title={label ?? t("states.loading")}
      description={description}
      icon={
        <>
          <Orbit size={scope === "inline" ? 20 : 25} strokeWidth={1.6} />
          <span className="as-state-orbit-dot absolute left-1/2 top-1/2 size-1.5 rounded-full bg-current shadow-[0_0_10px_currentColor]" />
        </>
      }
    />
  );
}
