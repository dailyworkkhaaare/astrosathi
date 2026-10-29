import { useTranslation } from "react-i18next";

/** Cancel / title / Save bar shared by the add- and edit-person sheets. */
export function PersonSheetHeader({
  title,
  formId,
  submitting,
  onCancel,
}: {
  title: string;
  formId: string;
  submitting: boolean;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center px-2 pb-1 pt-1">
      <button
        type="button"
        onClick={onCancel}
        className="tap-press inline-flex min-h-11 items-center justify-self-start rounded-full px-3 text-[1.0625rem] text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {t("people.cancel")}
      </button>
      <h1 className="text-[1.0625rem] font-semibold text-foreground">{title}</h1>
      <button
        type="submit"
        form={formId}
        disabled={submitting}
        aria-busy={submitting}
        className="tap-press inline-flex min-h-11 items-center justify-self-end rounded-full px-3 text-[1.0625rem] font-semibold text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      >
        {submitting ? t("people.saving") : t("people.save")}
      </button>
    </div>
  );
}
