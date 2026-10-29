import { Link, useCanGoBack, useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";

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
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const rawSections = t(`${i18nKey}.sections`, { returnObjects: true });
  const sections = isValidSections(rawSections) ? rawSections : [];
  const alternate = i18nKey === "terms" ? "/privacy" : "/terms";
  const alternateLabel = i18nKey === "terms" ? t("common.privacy") : t("common.terms");

  const goBack = () => {
    if (canGoBack) router.history.back();
    else void router.navigate({ to: "/" });
  };

  return (
    <article className="mx-auto w-full max-w-[var(--container-reading)] pb-8">
      <header className="motion-fade-up">
        <nav className="-mx-2 -mt-2 flex min-h-11 items-center">
          <button
            type="button"
            onClick={goBack}
            className="tap-press inline-flex h-11 items-center gap-0.5 rounded-full pl-1 pr-3 text-[1.0625rem] text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronLeft size={22} aria-hidden="true" />
            {t("common.back")}
          </button>
        </nav>
        <h1 className="large-title mt-1 text-foreground">{t(`${i18nKey}.title`)}</h1>
        <p className="mt-1.5 text-[0.9375rem] text-muted-foreground">
          {t(`${i18nKey}.lastUpdated`)}
        </p>
      </header>

      {sections.length > 0 && (
        <nav
          aria-label={t(`${i18nKey}.title`)}
          className="-mx-4 mt-5 overflow-x-auto px-4 pb-2 [scrollbar-width:none]"
        >
          <ol className="flex min-w-max gap-2">
            {sections.map((section, i) => (
              <li key={section.heading}>
                <a
                  href={`#${i18nKey}-section-${i + 1}`}
                  className="tap-press inline-flex min-h-11 items-center rounded-full bg-foreground/[0.06] px-3.5 text-[0.8125rem] font-medium text-foreground/80 transition-colors hover:bg-foreground/[0.1] hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {section.heading}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      )}

      <div className="mt-6 space-y-7">
        {sections.map((section, i) => (
          <section id={`${i18nKey}-section-${i + 1}`} key={section.heading} className="scroll-mt-6">
            <h2 className="text-[1.0625rem] font-semibold text-foreground">{section.heading}</h2>
            <div className="mt-2 space-y-3">
              {section.body.map((paragraph, j) => (
                <p key={j} className="text-[0.9375rem] leading-relaxed text-muted-foreground">
                  {paragraph}
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>

      <Link
        to={alternate}
        className="tap-press mt-10 flex min-h-11 items-center justify-between gap-3 rounded-[0.875rem] bg-card px-4 text-[1.0625rem] text-foreground shadow-[var(--as-elevation-1)] transition-colors hover:bg-foreground/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {alternateLabel}
        <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-muted-foreground" />
      </Link>
    </article>
  );
}
