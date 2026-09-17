import { createRoot } from "react-dom/client";

import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import { LoadingState } from "@/components/states/LoadingState";
import i18n from "@/i18n";

export async function mountStateMatrix(target: HTMLElement, language: "en" | "hi" | "mr") {
  await i18n.changeLanguage(language);
  document.documentElement.lang = language;
  target.dataset.retryCount = "0";

  createRoot(target).render(
    <div className="space-y-4 p-4">
      <LoadingState scope="inline" description={i18n.t("states.loading")} />
      <EmptyState scope="panel" />
      <ErrorState
        scope="page"
        description={i18n.t("states.errorBody")}
        onRetry={() => {
          target.dataset.retryCount = String(Number(target.dataset.retryCount) + 1);
        }}
      />
      <div data-without-retry>
        <ErrorState scope="inline" title={i18n.t("states.error")} />
      </div>
    </div>,
  );

  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}
