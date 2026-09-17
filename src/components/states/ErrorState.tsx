import { useTranslation } from "react-i18next";
import { CircleAlert, RefreshCw } from "lucide-react";

import { StateFrame, type StateScope } from "@/components/states/StateFrame";
import { Button } from "@/components/ui/button";

export function ErrorState({
  title,
  description,
  onRetry,
  scope = "panel",
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  scope?: StateScope;
}) {
  const { t } = useTranslation();
  return (
    <StateFrame
      scope={scope}
      tone="error"
      role="alert"
      live="assertive"
      title={title ?? t("states.error")}
      description={description}
      icon={<CircleAlert size={scope === "inline" ? 20 : 24} strokeWidth={1.8} />}
      action={
        onRetry ? (
          <Button type="button" onClick={onRetry} size={scope === "inline" ? "sm" : "default"}>
            <RefreshCw aria-hidden="true" />
            {t("states.retry")}
          </Button>
        ) : undefined
      }
    />
  );
}
