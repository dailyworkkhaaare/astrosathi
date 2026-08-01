import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { useRequireOnboarding } from "@/lib/require-auth";
import { Button } from "@/components/ui/button";
import { BirthDetailsForm, type BirthDetailsValue } from "@/components/BirthDetailsForm";
import { RelationSelect } from "@/components/RelationSelect";
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
        <div className="h-40 animate-pulse rounded-2xl border border-border bg-card" />
      </section>
    );
  }

  if (notFound) {
    return (
      <section className="mx-auto max-w-2xl">
        <p className="text-sm text-muted-foreground">{t("people.detail.loadError")}</p>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <div className="motion-fade-up flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate({ to: "/people/$id", params: { id } })}
          aria-label={t("people.detail.back")}
          className="tap-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </button>
        <h1 className="font-display text-2xl leading-tight tracking-tight text-foreground sm:text-3xl">
          {t("people.edit.title")}
        </h1>
      </div>

      <form className="space-y-6" onSubmit={onSubmit} noValidate>
        <RelationSelect value={relation} onChange={setRelation} />
        <BirthDetailsForm value={form} onChange={updateForm} errors={errors} todayMax={today} />
        <Button type="submit" variant="primary" disabled={submitting} className="mt-2 h-12 w-full">
          {submitting ? t("auth.loading") : t("people.edit.submit")}
        </Button>
      </form>

      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="tap-press flex min-h-11 w-full items-center justify-center gap-2 rounded-lg text-sm font-medium text-destructive-strong transition-colors hover:bg-destructive/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                className="tap-press flex-1 rounded-lg border border-border px-3 py-2 min-h-11 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {t("people.edit.deleteCancel")}
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={onDelete}
                className="tap-press flex-1 rounded-lg bg-destructive px-3 py-2 min-h-11 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {t("people.edit.deleteConfirm")}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
