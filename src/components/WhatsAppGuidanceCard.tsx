import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";

import { Toggle } from "@/components/settings/primitives";
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
    <div className="motion-fade-up space-y-2">
      <div className="list-hairline overflow-hidden rounded-[0.875rem] bg-card shadow-[var(--as-elevation-1)]">
        <div className="flex min-h-11 items-center justify-between gap-3 py-2 pl-4 pr-2">
          <label
            htmlFor="whatsapp-opt-in"
            className="min-w-0 text-[1.0625rem] leading-snug text-foreground"
          >
            {t("settings.whatsapp.toggleLabel")}
          </label>
          <Toggle
            id="whatsapp-opt-in"
            ariaLabel={t("settings.whatsapp.toggleLabel")}
            checked={optIn}
            onChange={setOptIn}
          />
        </div>

        {optIn && (
          <>
            <div className="flex min-h-11 items-center gap-3 px-4">
              <label
                htmlFor="whatsapp-phone"
                className="shrink-0 whitespace-nowrap text-[1.0625rem] text-foreground"
              >
                {t("settings.whatsapp.phoneLabel")}
              </label>
              <input
                id="whatsapp-phone"
                type="tel"
                inputMode="tel"
                dir="ltr"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onBlur={() => setPhoneTouched(true)}
                placeholder={t("settings.whatsapp.phonePlaceholder")}
                aria-invalid={showPhoneError}
                aria-describedby={showPhoneError ? "whatsapp-phone-error" : undefined}
                className={INPUT_CLS + " text-right"}
              />
            </div>

            <div className="flex min-h-11 items-center gap-3 px-4">
              <label
                htmlFor="whatsapp-hour"
                className="shrink-0 whitespace-nowrap text-[1.0625rem] text-foreground"
              >
                {t("settings.whatsapp.timeLabel")}
              </label>
              <select
                id="whatsapp-hour"
                value={hour}
                onChange={(e) => setHour(Number(e.target.value))}
                className={INPUT_CLS + " text-right [text-align-last:right]"}
              >
                {Array.from({ length: 24 }, (_, h) => h).map((h) => (
                  <option key={h} value={h}>
                    {formatHour(h)}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>

      {optIn && (
        <>
          {showPhoneError ? (
            <p id="whatsapp-phone-error" className="px-4 text-[0.8125rem] text-destructive-strong">
              {t("settings.whatsapp.phoneError")}
            </p>
          ) : null}
          <p className="px-4 text-[0.8125rem] leading-snug text-muted-foreground">
            {t("settings.whatsapp.helperLine")}
          </p>
          <div className="flex items-center gap-3 px-1 pt-3">
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="tap-press inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-6 text-[0.9375rem] font-semibold text-accent-foreground transition-opacity disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {saving ? t("settings.whatsapp.saving") : t("settings.whatsapp.save")}
            </button>
            <span role="status" className="text-[0.8125rem]">
              {saved ? (
                <span className="inline-flex items-center gap-1 font-medium text-feedback-success">
                  <Check size={14} aria-hidden="true" />
                  {t("settings.whatsapp.saved")}
                </span>
              ) : saveError ? (
                <span className="text-destructive-strong">{t("settings.whatsapp.saveError")}</span>
              ) : null}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

const INPUT_CLS =
  "h-11 min-w-0 flex-1 -mx-2 rounded-md bg-transparent px-2 text-[1.0625rem] text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";
