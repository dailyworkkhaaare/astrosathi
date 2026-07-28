import { useTranslation } from "react-i18next";

type Section = { heading: string; body: string[] };

function isValidSections(value: unknown): value is Section[] {
  return (
    Array.isArray(value) &&
    value.every(
      (s) =>
        s &&
        typeof s === "object" &&
        typeof (s as Section).heading === "string" &&
        Array.isArray((s as Section).body),
    )
  );
}

/** Shared shell for the Terms and Privacy pages — same layout, different i18n namespace. */
export function LegalPage({ i18nKey }: { i18nKey: "terms" | "privacy" }) {
  const { t } = useTranslation();
  const rawSections = t(`${i18nKey}.sections`, { returnObjects: true });
  const sections = isValidSections(rawSections) ? rawSections : [];

  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {t(`${i18nKey}.lastUpdated`)}
      </p>
      <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
        {t(`${i18nKey}.title`)}
      </h1>
      <p className="mt-4 rounded-xl border border-accent/25 bg-accent/5 p-4 text-sm leading-relaxed text-muted-foreground">
        {t(`${i18nKey}.draftNotice`)}
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
