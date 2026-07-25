import { useEffect } from "react";

// TanStack Start has no static index.html, so vite-plugin-pwa's automatic
// registration (which patches index.html at build time) never fires here —
// register the built service worker manually instead.
export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js");
  }, []);

  return null;
}
