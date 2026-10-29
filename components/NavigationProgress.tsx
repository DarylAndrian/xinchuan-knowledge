"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** Thin bar shown while a client navigation is in flight. */
export default function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;
  const routeKeyRef = useRef(routeKey);
  const shownAt = useRef(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    routeKeyRef.current = routeKey;
    let frames = 0;
    let timer = 0;
    function tick() {
      frames += 1;
      const elapsed = Date.now() - shownAt.current;
      const stillLoading = !!document.querySelector("[data-route-loading]");
      if ((stillLoading || elapsed < 350) && frames < 80) {
        timer = window.setTimeout(tick, 50);
        return;
      }
      setVisible(false);
    }
    timer = window.setTimeout(tick, 0);
    return () => window.clearTimeout(timer);
  }, [routeKey]);

  useEffect(() => {
    let showTimer = 0;
    let hideTimer = 0;

    function arm() {
      const started = routeKeyRef.current;
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
      showTimer = window.setTimeout(() => {
        if (routeKeyRef.current === started) {
          shownAt.current = Date.now();
          setVisible(true);
        }
      }, 90);
      hideTimer = window.setTimeout(() => setVisible(false), 12000);
    }

    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest("a");
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      arm();
    }

    function onSubmit(event: SubmitEvent) {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      if ((form.method || "get").toLowerCase() !== "get") return;
      arm();
    }

    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    window.addEventListener("popstate", arm);
    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
      window.removeEventListener("popstate", arm);
    };
  }, []);

  return (
    <div className="route-progress-slot" aria-hidden={visible ? undefined : true}>
      {visible && <div className="route-progress" role="progressbar" aria-label="Loading page" />}
      <span className="sr-only" role="status" aria-live="polite">
        {visible ? "Loading page" : ""}
      </span>
    </div>
  );
}
