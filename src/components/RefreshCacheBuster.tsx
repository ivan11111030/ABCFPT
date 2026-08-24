"use client";

import { useEffect } from "react";

export function RefreshCacheBuster() {
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("v", String(Date.now()));
    window.history.replaceState(window.history.state, "", url);
  }, []);

  return null;
}