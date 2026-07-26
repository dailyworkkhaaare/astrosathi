import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DEFAULT_WHATSAPP_HOUR,
  isValidE164Phone,
  saveWhatsAppPrefs,
  useWhatsAppPrefs,
} from "@/lib/queries";

const DEFAULT_PHONE_PREFIX = "+91";
const SAVED_FLASH_MS = 2200;

function formatHour(hour: number): string {
  const period = hour < 12 ? "AM" : "PM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:00 ${period}`;
}

export function WhatsAppGuidanceCard() {
  const { t, i18n } = useTranslation();
  const prefsQuery = useWhatsAppPrefs();

  const [optIn, setOptIn] = useState(false);
  const [phone, setPhone] = useState(DEFAULT_PHONE_PREFIX);
  const [hour, setHour] = useState(DEFAULT_WHATSAPP_HOUR);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);

  // Sync local form state once the saved row loads — after that, this stays
  // a purely local draft until Save is pressed.
  useEffect(() => {
    if (!prefsQuery.data) return;
    setOptIn(prefsQuery.data.opt_in);
    setPhone(prefsQuery.data.phone_e164 || DEFAULT_PHONE_PREFIX);
    setHour(prefsQuery.data.send_hour_local);
  }, [prefsQuery.data]);

  const phoneValid = !optIn || isValidE164Phone(phone);
  const showPhoneError = phoneTouched && optIn && !phoneValid;

  const onSave = async () => {
    setPhoneTouched(true);
    setSaved(false);
    setSaveError(false);
    if (optIn && !isValidE164Phone(phone)) return;

    setSaving(true);
    const res = await saveWhatsAppPrefs({
      phone_e164: phone.trim(),
      opt_in: optIn,
      send_hour_local: hour,
      lang: (i18n.language || "en").slice(0, 2),
    });
    setSaving(false);

    if (res.error) {
      setSaveError(true);
      return;
    }
    setSaved(true);
    void prefsQuery.refetch();
    setTimeout(() => setSaved(false), SAVED_FLASH_MS);
  };

  return (
    <div className="motion-fade-up">
      <h2 className="mb-2.5 flex items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        <span className="text-accent">
          <MessageCircle size={14} aria-hidden="true" />
        </span>
        {t("settings.whatsapp.title")}
      </h2>
      <div className="overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-[var(--shadow-soft)]">
        <div className="flex items-start justify-between gap-3 px-4 py-3 min-h-11">
          <div className="min-w-0">
            <label htmlFor="whatsapp-opt-in" className="block text-sm font-medium text-foreground">
              {t("settings.whatsapp.toggleLabel")}
            </label>
            <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
              {t("settings.whatsapp.toggleHelp")}
            </p>
          </div>
          <button
            id="whatsapp-opt-in"
            type="button"
            role="switch"
            aria-checked={optIn}
            onClick={() => setOptIn((v) => !v)}
            className="grid place-items-center min-h-11 min-w-11 focus:outline-none"
          >
            <span
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-[var(--motion-micro)] focus-visible:ring-2 focus-visible:ring-ring ${
                optIn ? "bg-primary" : "bg-muted-foreground/30"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-background shadow transition-transform duration-[var(--motion-micro)] ${
                  optIn ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </span>
          </button>
        </div>

        {optIn && (
          <>
            <div className="h-px bg-border" role="presentation" />
            <div className="space-y-1.5 px-4 py-3">
              <label htmlFor="whatsapp-phone" className="block text-sm font-medium text-foreground">
                {t("settings.whatsapp.phoneLabel")}
              </label>
              <input
                id="whatsapp-phone"
                type="tel"
                inputMode="tel"
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onBlur={() => setPhoneTouched(true)}
                placeholder={t("settings.whatsapp.phonePlaceholder")}
                aria-invalid={showPhoneError}
                className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {showPhoneError && (
                <p className="text-xs text-accent">{t("settings.whatsapp.phoneError")}</p>
              )}
            </div>

            <div className="h-px bg-border" role="presentation" />
            <div className="flex flex-col gap-2 px-4 py-3 min-h-11 md:flex-row md:items-center md:justify-between">
              <span className="text-sm font-medium text-foreground">
                {t("settings.whatsapp.timeLabel")}
              </span>
              <div className="w-full md:w-auto">
                <label htmlFor="whatsapp-hour" className="sr-only">
                  {t("settings.whatsapp.timeLabel")}
                </label>
                <select
                  id="whatsapp-hour"
                  value={hour}
                  onChange={(e) => setHour(Number(e.target.value))}
                  className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring md:w-auto"
                >
                  {Array.from({ length: 24 }, (_, h) => h).map((h) => (
                    <option key={h} value={h}>
                      {formatHour(h)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="h-px bg-border" role="presentation" />
            <div className="space-y-3 px-4 py-3">
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {t("settings.whatsapp.helperLine")}
              </p>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={onSave}
                  disabled={saving}
                  className="min-h-11"
                >
                  {saving ? t("settings.whatsapp.saving") : t("settings.whatsapp.save")}
                </Button>
                {saved && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-accent">
                    <Check size={14} aria-hidden="true" />
                    {t("settings.whatsapp.saved")}
                  </span>
                )}
                {saveError && (
                  <span className="text-xs text-muted-foreground">
                    {t("settings.whatsapp.saveError")}
                  </span>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
