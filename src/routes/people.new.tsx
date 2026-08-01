import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";

import { useRequireOnboarding } from "@/lib/require-auth";
import { Button } from "@/components/ui/button";
import { BirthDetailsForm, type BirthDetailsValue } from "@/components/BirthDetailsForm";
import { RelationSelect } from "@/components/RelationSelect";
import { useQueryClient } from "@tanstack/react-query";
import { createRelatedChart, type Relation } from "@/lib/related-charts";

export const Route = createFileRoute("/people/new")({
  head: () => ({
    meta: [{ title: "Add a person — AstroSaathi" }],
  }),
  component: NewPersonPage,
});

function NewPersonPage() {
  useRequireOnboarding();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const today = useMemo(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }, []);

  const [relation, setRelation] = useState<Relation>("other");
  const [form, setForm] = useState<BirthDetailsValue>({
    name: "",
    gender: undefined,
    dob: "",
    time: "",
    timeUnknown: false,
    place: "",
    placeCoords: null,
  });
  const updateForm = (patch: Partial<BirthDetailsValue>) =>
    setForm((prev) => ({ ...prev, ...patch }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = t("birth.errors.nameRequired");
    if (!form.dob) e.dob = t("birth.errors.dobRequired");
    else if (form.dob > today) e.dob = t("birth.errors.dobFuture");
    if (!form.timeUnknown && !form.time) e.time = t("birth.errors.timeRequired");
    if (!form.place.trim() || !form.placeCoords) e.place = t("birth.errors.placeRequired");
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    const res = await createRelatedChart({
      relation,
      full_name: form.name.trim(),
      gender: form.gender ?? null,
      birth_date: form.dob,
      birth_time: form.timeUnknown ? null : form.time,
      birth_time_known: !form.timeUnknown,
      birth_place_label: form.place.trim(),
      latitude: form.placeCoords?.latitude ?? null,
      longitude: form.placeCoords?.longitude ?? null,
      birth_timezone: form.placeCoords?.timezone ?? "Asia/Kolkata",
    });
    setSubmitting(false);
    if (res.error) {
      setErrors((prev) => ({
        ...prev,
        name: res.limitReached ? t("people.limitReached") : t("people.saveFailed"),
      }));
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["related-charts", "list"] });
    navigate({ to: "/people" });
  };

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <div className="motion-fade-up flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate({ to: "/people" })}
          aria-label={t("people.detail.back")}
          className="tap-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </button>
        <h1 className="font-display text-2xl leading-tight tracking-tight text-foreground sm:text-3xl">
          {t("people.new.title")}
        </h1>
      </div>

      <form className="space-y-6" onSubmit={onSubmit} noValidate>
        <RelationSelect value={relation} onChange={setRelation} />
        <BirthDetailsForm value={form} onChange={updateForm} errors={errors} todayMax={today} />
        <Button type="submit" variant="primary" disabled={submitting} className="mt-2 h-12 w-full">
          {submitting ? t("auth.loading") : t("people.new.submit")}
        </Button>
      </form>
    </section>
  );
}
