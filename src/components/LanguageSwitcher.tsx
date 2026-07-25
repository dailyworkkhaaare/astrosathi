import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronDown, Languages } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SUPPORTED_LANGUAGES, setLanguage, type SupportedLanguage } from "@/i18n";

const NATIVE_LABELS: Record<SupportedLanguage, string> = {
  mr: "मराठी",
  hi: "हिन्दी",
  en: "English",
};

const LATIN_LABELS: Record<SupportedLanguage, string> = {
  mr: "Marathi",
  hi: "Hindi",
  en: "English",
};

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  if (!hydrated) {
    return (
      <div className="h-9 w-28 min-h-[44px] sm:min-h-0 rounded-lg bg-muted" aria-hidden="true" />
    );
  }

  const rawLang = i18n.language ?? "mr";
  const currentLang =
    SUPPORTED_LANGUAGES.find((l) => rawLang === l || rawLang.startsWith(`${l}-`)) ?? "mr";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-9 min-h-[44px] sm:min-h-0 px-3 text-sm font-medium gap-2 text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={t("common.language")}
        >
          <Languages className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span>{NATIVE_LABELS[currentLang]}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="bg-card text-card-foreground border-border rounded-xl shadow-[var(--shadow-elevated)] p-1.5 min-w-[11rem]"
      >
        {SUPPORTED_LANGUAGES.map((lng) => {
          const isSelected = currentLang === lng;
          const showSubLabel = NATIVE_LABELS[lng] !== LATIN_LABELS[lng];
          return (
            <DropdownMenuItem
              key={lng}
              onClick={() => setLanguage(lng)}
              className="flex items-center justify-between gap-4 min-h-11 px-3 py-2 cursor-pointer rounded-lg hover:bg-muted focus:bg-muted focus:text-foreground text-foreground"
            >
              <div className="flex flex-col text-left">
                <span className="text-sm font-medium text-foreground">{NATIVE_LABELS[lng]}</span>
                {showSubLabel && (
                  <span className="text-xs text-muted-foreground">{LATIN_LABELS[lng]}</span>
                )}
              </div>
              {isSelected && <Check className="h-4 w-4 text-primary shrink-0 ml-auto" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
