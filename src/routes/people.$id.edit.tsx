import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Clock3, ShieldCheck, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { useRequireOnboarding } from "@/lib/require-auth";
import { triggerHaptic } from "@/lib/native-device";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { BirthDetailsForm, type BirthDetailsValue } from "@/components/BirthDetailsForm";
import { RelationSelect } from "@/components/RelationSelect";
import { PersonSheetHeader } from "@/components/people/PersonSheetHeader";
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
    void triggerHaptic("success");
    invalidatePerson();
    navigate({ to: "/people/$id", params: { id } });
  };

  const onDelete = async () => {
    setDeleting(true);
    const res = await deleteRelatedChart(id);
    setDeleting(false);
    if (res.error) return;
    void triggerHaptic("warning");
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

  const close = () => navigate({ to: "/people/$id", params: { id } });

  return (
    <Drawer open onOpenChange={(open) => !open && close()} shouldScaleBackground={false}>
      <DrawerContent
        aria-label={t("people.edit.title")}
        className="bg-background sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[min(44rem,calc(100dvh-2rem))] sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl"
      >
        <PersonSheetHeader
          title={t("people.edit.title")}
          formId="person-form"
          submitting={submitting}
          onCancel={close}
        />
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(1.5rem+var(--as-safe-bottom))] pt-3">
          <form id="person-form" className="space-y-6" onSubmit={onSubmit} noValidate>
            <RelationSelect value={relation} onChange={setRelation} variant="grouped" />
            <BirthDetailsForm
              value={form}
              onChange={updateForm}
              errors={errors}
              todayMax={today}
              variant="grouped"
              subject="other"
            />
            {form.timeUnknown ? (
              <p className="-mt-3 flex gap-2 px-4 text-xs leading-relaxed text-muted-foreground">
                <Clock3 size={14} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
                {t("people.edit.timeUnknownHint")}
              </p>
            ) : null}
            <p className="flex gap-2 px-4 text-xs leading-relaxed text-muted-foreground">
              <ShieldCheck size={14} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
              {t("people.edit.saveNote")}
            </p>
          </form>

          <section aria-label={t("people.edit.deleteTitle")} className="mt-8">
            {!confirmDelete ? (
              <>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="tap-press flex min-h-12 w-full items-center justify-center gap-2 rounded-[0.875rem] bg-card text-[1.0625rem] font-semibold text-destructive-strong shadow-[var(--as-elevation-1)] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Trash2 size={17} aria-hidden="true" />
                  {t("people.edit.deletePerson")}
                </button>
                <p className="mt-2 px-4 text-center text-xs text-muted-foreground">
                  {t("people.edit.deleteNote")}
                </p>
              </>
            ) : (
              <div
                role="alertdialog"
                aria-labelledby="delete-person-title"
                aria-describedby="delete-person-body"
                className="rounded-[0.875rem] bg-card p-4 shadow-[var(--as-elevation-1)]"
              >
                <p id="delete-person-title" className="text-base font-semibold text-foreground">
                  {t("people.edit.deleteConfirmTitle")}
                </p>
                <p id="delete-person-body" className="mt-1 text-[0.8125rem] text-muted-foreground">
                  {t("people.edit.deleteConfirmBody")}
                </p>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="tap-press min-h-11 flex-1 rounded-full bg-foreground/[0.07] px-3 text-sm font-semibold text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {t("people.edit.deleteCancel")}
                  </button>
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={onDelete}
                    className="tap-press min-h-11 flex-1 rounded-full bg-destructive/15 px-3 text-sm font-semibold text-destructive-strong disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {t("people.edit.deleteConfirm")}
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
