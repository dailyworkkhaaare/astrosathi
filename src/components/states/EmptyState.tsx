import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";

import { StateFrame, type StateScope } from "@/components/states/StateFrame";

export function EmptyState({
  title,
  description,
  icon,
  action,
  scope = "panel",
}: {
  title?: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  scope?: StateScope;
}) {
  const { t } = useTranslation();
  return (
    <StateFrame
      scope={scope}
      tone="empty"
      role="status"
      live="polite"
      title={title ?? t("states.empty")}
      description={description}
      action={action}
      icon={icon ?? <Sparkles size={scope === "inline" ? 19 : 23} strokeWidth={1.7} />}
    />
  );
}
