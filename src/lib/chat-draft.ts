const STORAGE_KEY_PREFIX = "astrosaathi:chat-draft:";

function storageKey(userId: string, conversationId: string | null): string {
  return `${STORAGE_KEY_PREFIX}${encodeURIComponent(userId)}:${conversationId ?? "new"}`;
}

export function readChatDraft(userId: string | null, conversationId: string | null): string {
  if (typeof window === "undefined" || !userId) return "";
  try {
    return window.sessionStorage.getItem(storageKey(userId, conversationId)) ?? "";
  } catch {
    return "";
  }
}

export function saveChatDraft(
  userId: string | null,
  conversationId: string | null,
  draft: string,
): void {
  if (typeof window === "undefined" || !userId) return;
  try {
    const key = storageKey(userId, conversationId);
    if (draft.trim()) {
      window.sessionStorage.setItem(key, draft);
    } else {
      window.sessionStorage.removeItem(key);
    }
  } catch {
    // A private draft is a convenience, never a reason to block typing.
  }
}

export function clearChatDraft(userId: string | null, conversationId: string | null): void {
  if (typeof window === "undefined" || !userId) return;
  try {
    window.sessionStorage.removeItem(storageKey(userId, conversationId));
  } catch {
    // Keep a successful reply independent of unavailable browser storage.
  }
}

export function clearAllChatDrafts(): void {
  if (typeof window === "undefined") return;
  try {
    for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = window.sessionStorage.key(index);
      if (key?.startsWith(STORAGE_KEY_PREFIX)) window.sessionStorage.removeItem(key);
    }
  } catch {
    // Sign-out must still complete when browser storage is unavailable.
  }
}
