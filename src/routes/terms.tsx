import { createFileRoute } from "@tanstack/react-router";

import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — AstroSaathi" },
      {
        name: "description",
        content: "AstroSaathi's Terms of Service.",
      },
    ],
  }),
  component: () => <LegalPage i18nKey="terms" />,
});
