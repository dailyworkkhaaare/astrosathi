import { createFileRoute } from "@tanstack/react-router";

import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — AstroSaathi" },
      {
        name: "description",
        content: "AstroSaathi's Privacy Policy.",
      },
    ],
  }),
  component: () => <LegalPage i18nKey="privacy" />,
});
