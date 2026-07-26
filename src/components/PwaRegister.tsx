import { useEffect } from "react";

// PWA/service worker intentionally disabled. The generated worker isn't served
// on our Nitro→Vercel output, and we want zero stale-cache risk on frequent
// deploys. This also unregisters any worker a browser registered earlier.
export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((reg) => void reg.unregister());
    });
  }, []);

  return null;
}
