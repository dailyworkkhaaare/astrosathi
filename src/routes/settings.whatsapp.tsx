import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { WhatsAppGuidanceCard } from "@/components/WhatsAppGuidanceCard";
import { SettingsBackHeader } from "@/components/settings/primitives";
import { useRequireOnboarding } from "@/lib/require-auth";

export const Route = createFileRoute("/settings/whatsapp")({
  head: () => ({
    meta: [{ title: "WhatsApp guidance — AstroSaathi" }],
  }),
  component: WhatsAppSettingsPage,
});

function WhatsAppSettingsPage() {
  useRequireOnboarding();
  const { t } = useTranslation();
  return (
    <section className="mx-auto max-w-2xl space-y-7">
      <SettingsBackHeader
        title={t("settings.whatsapp.title")}
        backLabel={t("settings.memory.back")}
        subtitle={t("settings.whatsapp.toggleHelp")}
      />
      <WhatsAppGuidanceCard />
    </section>
  );
}
