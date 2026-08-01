import { useTranslation } from "react-i18next";

import { Field, inputCls } from "@/components/BirthDetailsForm";
import { RELATIONS, type Relation } from "@/lib/related-charts";

export function RelationSelect({
  value,
  onChange,
  error,
}: {
  value: Relation;
  onChange: (v: Relation) => void;
  error?: string;
}) {
  const { t } = useTranslation();
  return (
    <Field id="relation" label={t("people.relationLabel")} error={error}>
      <select
        id="relation"
        value={value}
        onChange={(e) => onChange(e.target.value as Relation)}
        className={`${inputCls} h-11 pl-3.5`}
      >
        {RELATIONS.map((r) => (
          <option key={r} value={r}>
            {t(`people.relations.${r}`)}
          </option>
        ))}
      </select>
    </Field>
  );
}
