"use client";

import { useEffect } from "react";

function isIosDevice() {
  if (typeof window === "undefined") {
    return false;
  }

  const platform = window.navigator?.platform || "";
  const userAgent = window.navigator?.userAgent || "";
  const maxTouchPoints = window.navigator?.maxTouchPoints || 0;

  return /iPad|iPhone|iPod/.test(userAgent) || (platform === "MacIntel" && maxTouchPoints > 1);
}

function isStandaloneDisplay(displayModeQuery) {
  return window.navigator?.standalone === true || Boolean(displayModeQuery?.matches);
}

export default function StandaloneViewportProvider() {
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return undefined;
    }

    const displayModeQuery = window.matchMedia?.("(display-mode: standalone)");
    const root = document.documentElement;
    const body = document.body;

    let isIosStandalone = false;
    let orientationTimeoutId;

    const syncStandaloneViewport = () => {
      isIosStandalone = isIosDevice() && isStandaloneDisplay(displayModeQuery);

      root.classList.toggle("ios-standalone", isIosStandalone);
      body.classList.toggle("ios-standalone", isIosStandalone);
    };

    const syncAfterOrientationChange = () => {
      syncStandaloneViewport();
      window.clearTimeout(orientationTimeoutId);
      orientationTimeoutId = window.setTimeout(syncStandaloneViewport, 250);
    };

    const addDisplayModeListener = () => {
      if (displayModeQuery?.addEventListener) {
        displayModeQuery.addEventListener("change", syncStandaloneViewport);
        return;
      }

      displayModeQuery?.addListener?.(syncStandaloneViewport);
    };

    const removeDisplayModeListener = () => {
      if (displayModeQuery?.removeEventListener) {
        displayModeQuery.removeEventListener("change", syncStandaloneViewport);
        return;
      }

      displayModeQuery?.removeListener?.(syncStandaloneViewport);
    };

    syncStandaloneViewport();

    window.addEventListener("resize", syncStandaloneViewport);
    window.addEventListener("orientationchange", syncAfterOrientationChange);
    addDisplayModeListener();

    return () => {
      window.clearTimeout(orientationTimeoutId);
      root.classList.remove("ios-standalone");
      body.classList.remove("ios-standalone");
      window.removeEventListener("resize", syncStandaloneViewport);
      window.removeEventListener("orientationchange", syncAfterOrientationChange);
      removeDisplayModeListener();
    };
  }, []);

  return null;
}
