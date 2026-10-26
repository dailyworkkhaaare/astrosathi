import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Field, inputCls } from "@/components/BirthDetailsForm";
import { RELATIONS, type Relation } from "@/lib/related-charts";

export function RelationSelect({
  value,
  onChange,
  error,
  variant = "stacked",
}: {
  value: Relation;
  onChange: (v: Relation) => void;
  error?: string;
  /** "grouped" draws a native inset-grouped row to sit beside the grouped birth fields. */
  variant?: "stacked" | "grouped";
}) {
  const { t } = useTranslation();
  const options = RELATIONS.map((r) => (
    <option key={r} value={r}>
      {t(`people.relations.${r}`)}
    </option>
  ));

  if (variant === "grouped") {
    return (
      <div className="rounded-[0.875rem] bg-card shadow-[var(--as-elevation-1)]">
        <div className="flex min-h-[3.125rem] items-center gap-4 px-4">
          <label htmlFor="relation" className="text-[1.0625rem] leading-tight text-foreground">
            {t("people.relationLabel")}
          </label>
          <div className="relative min-w-0 flex-1">
            <select
              id="relation"
              value={value}
              onChange={(e) => onChange(e.target.value as Relation)}
              className="h-11 w-full appearance-none rounded-md bg-transparent pr-7 text-right text-[1.0625rem] text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [text-align-last:right]"
            >
              {options}
            </select>
            <ChevronDown
              size={16}
              aria-hidden="true"
              className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <Field id="relation" label={t("people.relationLabel")} error={error}>
      <select
        id="relation"
        value={value}
        onChange={(e) => onChange(e.target.value as Relation)}
        className={`${inputCls} h-11 pl-3.5`}
      >
        {options}
      </select>
    </Field>
  );
}
