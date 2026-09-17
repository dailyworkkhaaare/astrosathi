import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Clock3, ShieldCheck, UserRoundPlus } from "lucide-react";

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
      <header className="motion-fade-up flex items-start gap-3">
        <button
          type="button"
          onClick={() => navigate({ to: "/people" })}
          aria-label={t("people.detail.back")}
          className="tap-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </button>
        <div className="min-w-0">
          <p className="as-micro text-primary">{t("people.new.eyebrow")}</p>
          <h1 className="mt-1 font-display text-2xl leading-tight tracking-tight text-foreground sm:text-3xl">
            {t("people.new.title")}
          </h1>
          <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-muted-foreground">
            {t("people.new.subtitle")}
          </p>
        </div>
      </header>

      <div className="motion-fade-up relative isolate overflow-hidden rounded-[1.75rem] border border-primary/20 bg-card p-5 shadow-[var(--shadow-card)] sm:p-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-80"
          style={{
            background:
              "radial-gradient(58% 70% at 0% 0%, color-mix(in oklab, var(--primary) 12%, transparent), transparent 72%), radial-gradient(45% 65% at 100% 100%, color-mix(in oklab, var(--accent) 10%, transparent), transparent 76%)",
          }}
        />
        <div className="relative flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
            <UserRoundPlus size={19} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground">
              {t("people.new.introTitle")}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {t("people.new.introBody")}
            </p>
          </div>
        </div>
      </div>

      <form
        className="motion-fade-up overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-[var(--shadow-card)]"
        onSubmit={onSubmit}
        noValidate
      >
        <section aria-labelledby="person-relation-title" className="space-y-4 p-5 sm:p-6">
          <div>
            <p className="as-micro text-muted-foreground">{t("people.new.relationEyebrow")}</p>
            <h2 id="person-relation-title" className="mt-1 text-lg font-semibold text-foreground">
              {t("people.new.relationTitle")}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {t("people.new.relationHint")}
            </p>
          </div>
          <RelationSelect value={relation} onChange={setRelation} />
        </section>

        <section
          aria-labelledby="person-birth-details-title"
          className="space-y-5 border-t border-border p-5 sm:p-6"
        >
          <div>
            <p className="as-micro text-muted-foreground">{t("people.new.birthEyebrow")}</p>
            <h2
              id="person-birth-details-title"
              className="mt-1 text-lg font-semibold text-foreground"
            >
              {t("people.new.birthTitle")}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {t("people.new.birthHint")}
            </p>
          </div>
          <BirthDetailsForm value={form} onChange={updateForm} errors={errors} todayMax={today} />
          <aside className="flex gap-2.5 rounded-2xl border border-accent/20 bg-accent/[0.06] px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">
            <Clock3 size={15} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
            <p>{t("people.new.timeUnknownHint")}</p>
          </aside>
        </section>

        <div className="border-t border-border p-5 sm:p-6">
          <div className="mb-4 flex gap-2.5 text-xs leading-relaxed text-muted-foreground">
            <ShieldCheck size={15} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
            <p>{t("people.new.privacyNote")}</p>
          </div>
          <Button
            type="submit"
            variant="primary"
            disabled={submitting}
            aria-busy={submitting}
            className="h-12 w-full"
          >
            {submitting ? t("auth.loading") : t("people.new.submit")}
          </Button>
        </div>
      </form>
    </section>
  );
}
