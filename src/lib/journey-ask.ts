export type JourneyAskDraft = {
  draft: string;
  sourceLabel: string;
};

const STORAGE_KEY_PREFIX = "astrosaathi:journey-ask:";
const JOURNEY_ASK_TOKEN_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isJourneyAskToken(value: string): boolean {
  return JOURNEY_ASK_TOKEN_PATTERN.test(value);
}

export function storeJourneyAskDraft(draft: JourneyAskDraft): string | null {
  if (typeof window === "undefined" || !window.crypto?.randomUUID) return null;
  try {
    const token = window.crypto.randomUUID();
    window.sessionStorage.setItem(`${STORAGE_KEY_PREFIX}${token}`, JSON.stringify(draft));
    return token;
  } catch {
    return null;
  }
}

export function takeJourneyAskDraft(token: string): JourneyAskDraft | null {
  if (typeof window === "undefined" || !isJourneyAskToken(token)) return null;
  try {
    const value = window.sessionStorage.getItem(`${STORAGE_KEY_PREFIX}${token}`);
    window.sessionStorage.removeItem(`${STORAGE_KEY_PREFIX}${token}`);
    if (!value) return null;
    const parsed = JSON.parse(value) as Partial<JourneyAskDraft>;
    return typeof parsed.draft === "string" &&
      parsed.draft.trim() &&
      typeof parsed.sourceLabel === "string"
      ? { draft: parsed.draft, sourceLabel: parsed.sourceLabel }
      : null;
  } catch {
    return null;
  }
}
