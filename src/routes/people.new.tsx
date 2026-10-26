import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Clock3, ShieldCheck } from "lucide-react";

import { useRequireOnboarding } from "@/lib/require-auth";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { BirthDetailsForm, type BirthDetailsValue } from "@/components/BirthDetailsForm";
import { RelationSelect } from "@/components/RelationSelect";
import { PersonSheetHeader } from "@/components/people/PersonSheetHeader";
import { useQueryClient } from "@tanstack/react-query";
import { createRelatedChart, type Relation } from "@/lib/related-charts";
import { triggerHaptic } from "@/lib/native-device";

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
    void triggerHaptic("success");
    void queryClient.invalidateQueries({ queryKey: ["related-charts", "list"] });
    navigate({ to: "/people" });
  };

  const close = () => navigate({ to: "/people" });

  return (
    <Drawer open onOpenChange={(open) => !open && close()} shouldScaleBackground={false}>
      <DrawerContent
        aria-label={t("people.new.title")}
        className="bg-background sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[min(44rem,calc(100dvh-2rem))] sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl"
      >
        <PersonSheetHeader
          title={t("people.new.title")}
          formId="person-form"
          submitting={submitting}
          onCancel={close}
        />
        <form
          id="person-form"
          className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 pb-[calc(1.5rem+var(--as-safe-bottom))] pt-3"
          onSubmit={onSubmit}
          noValidate
        >
          <RelationSelect value={relation} onChange={setRelation} variant="grouped" />
          <BirthDetailsForm
            value={form}
            onChange={updateForm}
            errors={errors}
            todayMax={today}
            variant="grouped"
          />
          {form.timeUnknown ? (
            <p className="-mt-3 flex gap-2 px-4 text-xs leading-relaxed text-muted-foreground">
              <Clock3 size={14} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
              {t("people.new.timeUnknownHint")}
            </p>
          ) : null}
          <p className="flex gap-2 px-4 text-xs leading-relaxed text-muted-foreground">
            <ShieldCheck size={14} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
            {t("people.new.privacyNote")}
          </p>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
