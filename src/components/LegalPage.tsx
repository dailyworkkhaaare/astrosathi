import { Link } from "@tanstack/react-router";
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
  const alternate = i18nKey === "terms" ? "/privacy" : "/terms";
  const alternateLabel = i18nKey === "terms" ? t("common.privacy") : t("common.terms");

  return (
    <article className="mx-auto w-full max-w-[var(--container-reading)] pb-8">
      <header className="border-b border-border/70 pb-6">
        <p className="as-micro text-primary">{t(`${i18nKey}.lastUpdated`)}</p>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            {t(`${i18nKey}.title`)}
          </h1>
          <Link
            to={alternate}
            className="tap-press inline-flex min-h-11 w-fit items-center rounded-md border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {alternateLabel}
          </Link>
        </div>
        <p className="mt-5 rounded-md border border-accent/25 bg-accent/5 p-4 text-sm leading-relaxed text-muted-foreground">
          {t(`${i18nKey}.draftNotice`)}
        </p>
      </header>

      {sections.length > 0 && (
        <nav
          aria-label={t(`${i18nKey}.title`)}
          className="-mx-4 mt-5 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0"
        >
          <ol className="flex min-w-max gap-2">
            {sections.map((section, i) => (
              <li key={section.heading}>
                <a
                  href={`#${i18nKey}-section-${i + 1}`}
                  className="tap-press inline-flex min-h-10 items-center rounded-md border border-border/70 px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {section.heading}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      )}

      <div className="mt-8 divide-y divide-border/70">
        {sections.map((section, i) => (
          <section
            id={`${i18nKey}-section-${i + 1}`}
            key={section.heading}
            className="py-6 first:pt-0"
          >
            <h2 className="text-base font-semibold text-foreground">{section.heading}</h2>
            <div className="mt-2 space-y-3">
              {section.body.map((paragraph, j) => (
                <p key={j} className="text-sm leading-7 text-muted-foreground">
                  {paragraph}
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}
