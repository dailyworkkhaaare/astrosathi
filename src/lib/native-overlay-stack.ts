import { useCallback, useEffect, useRef } from "react";

type OverlayCloser = () => void;

const openOverlays: OverlayCloser[] = [];

function removeOverlay(closer: OverlayCloser) {
  const index = openOverlays.lastIndexOf(closer);
  if (index >= 0) openOverlays.splice(index, 1);
}

export function registerNativeOverlay(closer: OverlayCloser) {
  openOverlays.push(closer);
  let registered = true;
  return () => {
    if (!registered) return;
    registered = false;
    removeOverlay(closer);
  };
}

export function closeTopNativeOverlay() {
  const closer = openOverlays.pop();
  if (!closer) return false;
  closer();
  return true;
}

export function useNativeOverlayRegistration(
  open: boolean | undefined,
  onOpenChange?: (open: boolean) => void,
) {
  const onOpenChangeRef = useRef(onOpenChange);
  const unregisterRef = useRef<(() => void) | null>(null);
  const handleOpenChangeRef = useRef<(nextOpen: boolean) => void>(() => {});

  onOpenChangeRef.current = onOpenChange;

  const unregister = useCallback(() => {
    unregisterRef.current?.();
    unregisterRef.current = null;
  }, []);

  const register = useCallback(() => {
    if (unregisterRef.current) return;
    unregisterRef.current = registerNativeOverlay(() => handleOpenChangeRef.current(false));
  }, []);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) register();
      else unregister();
      onOpenChangeRef.current?.(nextOpen);
    },
    [register, unregister],
  );

  handleOpenChangeRef.current = handleOpenChange;

  useEffect(() => {
    if (open === true) register();
    if (open === false) unregister();
    return unregister;
  }, [open, register, unregister]);

  return handleOpenChange;
}
