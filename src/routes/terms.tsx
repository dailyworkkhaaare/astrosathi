import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

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
  component: TermsPage,
});

type Section = { heading: string; body: string[] };

function TermsPage() {
  const { t } = useTranslation();
  const sections = t("terms.sections", { returnObjects: true }) as Section[];

  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {t("terms.lastUpdated")}
      </p>
      <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
        {t("terms.title")}
      </h1>
      <p className="mt-4 rounded-xl border border-accent/25 bg-accent/5 p-4 text-sm leading-relaxed text-muted-foreground">
        {t("terms.draftNotice")}
      </p>

      <div className="mt-10 space-y-8">
        {sections.map((section, i) => (
          <section key={i}>
            <h2 className="text-base font-semibold text-foreground">{section.heading}</h2>
            <div className="mt-2 space-y-3">
              {section.body.map((paragraph, j) => (
                <p key={j} className="text-sm leading-relaxed text-muted-foreground">
                  {paragraph}
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
