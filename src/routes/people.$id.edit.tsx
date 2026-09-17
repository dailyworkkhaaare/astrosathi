import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Clock3, PencilLine, ShieldCheck, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { useRequireOnboarding } from "@/lib/require-auth";
import { Button } from "@/components/ui/button";
import { BirthDetailsForm, type BirthDetailsValue } from "@/components/BirthDetailsForm";
import { RelationSelect } from "@/components/RelationSelect";
import { ErrorState } from "@/components/states/ErrorState";
import { LoadingState } from "@/components/states/LoadingState";
import {
  deleteRelatedChart,
  getRelatedChart,
  updateRelatedChart,
  type Relation,
} from "@/lib/related-charts";

export const Route = createFileRoute("/people/$id/edit")({
  head: () => ({
    meta: [{ title: "Edit person — AstroSaathi" }],
  }),
  component: EditPersonPage,
});

function EditPersonPage() {
  useRequireOnboarding();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = useParams({ from: "/people/$id/edit" });

  const today = useMemo(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }, []);

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getRelatedChart(id).then(({ data }) => {
      if (cancelled) return;
      if (!data) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setRelation(data.relation);
      setForm({
        name: data.full_name,
        gender: data.gender,
        dob: data.birth_date,
        time: data.birth_time ?? "",
        timeUnknown: !data.birth_time_known,
        place: data.birth_place_label,
        placeCoords:
          data.latitude != null && data.longitude != null
            ? { latitude: data.latitude, longitude: data.longitude, timezone: data.birth_timezone }
            : null,
      });
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

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

  const invalidatePerson = () => {
    void queryClient.invalidateQueries({ queryKey: ["related-charts"] });
  };

  const onSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    const res = await updateRelatedChart(id, {
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
      setErrors((prev) => ({ ...prev, name: t("people.saveFailed") }));
      return;
    }
    invalidatePerson();
    navigate({ to: "/people/$id", params: { id } });
  };

  const onDelete = async () => {
    setDeleting(true);
    const res = await deleteRelatedChart(id);
    setDeleting(false);
    if (res.error) return;
    invalidatePerson();
    navigate({ to: "/people" });
  };

  if (loading) {
    return (
      <section className="mx-auto max-w-2xl">
        <LoadingState
          scope="panel"
          label={t("people.edit.loading")}
          description={t("people.edit.loadingBody")}
        />
      </section>
    );
  }

  if (notFound) {
    return (
      <section className="mx-auto max-w-2xl">
        <ErrorState
          scope="panel"
          title={t("people.edit.notFound")}
          description={t("people.edit.notFoundBody")}
        />
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <header className="motion-fade-up flex items-start gap-3">
        <button
          type="button"
          onClick={() => navigate({ to: "/people/$id", params: { id } })}
          aria-label={t("people.detail.back")}
          className="tap-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </button>
        <div className="min-w-0">
          <p className="as-micro text-primary">{t("people.edit.eyebrow")}</p>
          <h1 className="mt-1 font-display text-2xl leading-tight tracking-tight text-foreground sm:text-3xl">
            {t("people.edit.title")}
          </h1>
          <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-muted-foreground">
            {t("people.edit.subtitle")}
          </p>
        </div>
      </header>

      <section className="motion-fade-up relative isolate overflow-hidden rounded-[1.75rem] border border-primary/20 bg-card p-5 shadow-[var(--shadow-card)] sm:p-6">
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
            <PencilLine size={19} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground">
              {t("people.edit.introTitle")}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {t("people.edit.introBody")}
            </p>
          </div>
        </div>
      </section>

      <form
        className="motion-fade-up overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-[var(--shadow-card)]"
        onSubmit={onSubmit}
        noValidate
      >
        <section aria-labelledby="edit-person-identity-title" className="space-y-5 p-5 sm:p-6">
          <div>
            <p className="as-micro text-muted-foreground">{t("people.edit.identityEyebrow")}</p>
            <h2
              id="edit-person-identity-title"
              className="mt-1 text-lg font-semibold text-foreground"
            >
              {t("people.edit.identityTitle")}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {t("people.edit.identityHint")}
            </p>
          </div>
          <RelationSelect value={relation} onChange={setRelation} />
          <BirthDetailsForm
            value={form}
            onChange={updateForm}
            errors={errors}
            todayMax={today}
            section="identity"
          />
        </section>

        <section
          aria-labelledby="edit-person-birth-title"
          className="space-y-5 border-t border-border p-5 sm:p-6"
        >
          <div>
            <p className="as-micro text-muted-foreground">{t("people.edit.birthEyebrow")}</p>
            <h2 id="edit-person-birth-title" className="mt-1 text-lg font-semibold text-foreground">
              {t("people.edit.birthTitle")}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {t("people.edit.birthHint")}
            </p>
          </div>
          <BirthDetailsForm
            value={form}
            onChange={updateForm}
            errors={errors}
            todayMax={today}
            section="birth"
          />
          <aside className="flex gap-2.5 rounded-2xl border border-accent/20 bg-accent/[0.06] px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">
            <Clock3 size={15} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
            <p>{t("people.edit.timeUnknownHint")}</p>
          </aside>
        </section>

        <div className="border-t border-border p-5 sm:p-6">
          <div className="mb-4 flex gap-2.5 text-xs leading-relaxed text-muted-foreground">
            <ShieldCheck size={15} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
            <p>{t("people.edit.saveNote")}</p>
          </div>
          <Button
            type="submit"
            variant="primary"
            disabled={submitting}
            aria-busy={submitting}
            className="h-12 w-full"
          >
            {submitting ? t("auth.loading") : t("people.edit.submit")}
          </Button>
        </div>
      </form>

      <section
        aria-labelledby="edit-person-delete-title"
        className="rounded-[1.5rem] border border-destructive/30 bg-destructive/[0.05] p-5"
      >
        <p className="as-micro text-destructive-strong">{t("people.edit.deleteEyebrow")}</p>
        <h2 id="edit-person-delete-title" className="mt-1 text-lg font-semibold text-foreground">
          {t("people.edit.deleteTitle")}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {t("people.edit.deleteHint")}
        </p>
        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="tap-press mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-destructive/25 bg-background/60 px-4 text-sm font-medium text-destructive-strong transition-colors hover:bg-destructive/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Trash2 size={16} aria-hidden="true" />
            {t("people.edit.delete")}
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-foreground">{t("people.edit.deleteConfirmTitle")}</p>
            <p className="text-xs text-muted-foreground">{t("people.edit.deleteConfirmBody")}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="tap-press flex-1 rounded-xl border border-border px-3 py-2 min-h-11 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {t("people.edit.deleteCancel")}
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={onDelete}
                className="tap-press flex-1 rounded-xl bg-destructive px-3 py-2 min-h-11 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {t("people.edit.deleteConfirm")}
              </button>
            </div>
          </div>
        )}
      </section>
    </section>
  );
}
