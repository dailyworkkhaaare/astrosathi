import { useEffect, useState } from "react";
import { Wifi, WifiOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";

export function NetworkStatusBanner() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [offline, setOffline] = useState(false);
  const [reconnected, setReconnected] = useState(false);

  useEffect(() => {
    let onlineTimeout: number | null = null;
    const syncOffline = () => {
      setOffline(true);
      setReconnected(false);
    };
    const syncOnline = () => {
      setOffline(false);
      setReconnected(true);
      if (onlineTimeout !== null) window.clearTimeout(onlineTimeout);
      onlineTimeout = window.setTimeout(() => setReconnected(false), 2600);
      void queryClient.invalidateQueries({
        predicate: (query) =>
          query.queryKey[0] === "chart-gateway" && query.getObserversCount() > 0,
      });
    };

    if (!navigator.onLine) syncOffline();
    window.addEventListener("online", syncOnline);
    window.addEventListener("offline", syncOffline);
    return () => {
      window.removeEventListener("online", syncOnline);
      window.removeEventListener("offline", syncOffline);
      if (onlineTimeout !== null) window.clearTimeout(onlineTimeout);
    };
  }, [queryClient]);

  if (!offline && !reconnected) return null;
  const restored = !offline && reconnected;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-50 px-3 pt-[calc(var(--as-safe-top)+0.5rem)]"
    >
      <div className="mx-auto flex min-h-11 max-w-md items-center gap-2 rounded-full border border-border/70 bg-background/95 px-4 text-sm font-medium text-foreground shadow-[var(--shadow-elevated)] backdrop-blur">
        {restored ? (
          <Wifi size={16} className="shrink-0 text-feedback-success" aria-hidden="true" />
        ) : (
          <WifiOff size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
        <span className="min-w-0 truncate">
          {restored ? t("states.onlineBanner") : t("states.offlineBanner")}
        </span>
      </div>
    </div>
  );
}
