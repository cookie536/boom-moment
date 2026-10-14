"use client";

import { useEffect, useState } from "react";
import { ReadingLayer } from "@/components/moment/reading-layer";
import { markReadingOrigin, rememberReadingScroll } from "@/components/moment/reading-origin";

const MOMENT_HREF = /^\/moments\/([^/?#]+)$/;
let backgroundPath = "/";

function restoreBackground() {
  const state = window.history.state as { readingLayer?: string } | null;
  if (!state?.readingLayer) {
    return;
  }
  const next = { ...state };
  delete next.readingLayer;
  window.history.replaceState(next, "", backgroundPath);
}

export function ReadingHost() {
  const [id, setId] = useState<string | null>(null);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!link) {
        return;
      }
      const href = link.getAttribute("href") ?? "";
      const blocking = document.querySelector("[role='dialog'], [role='menu'], [data-image-viewer]");
      if (blocking && !blocking.contains(link)) {
        return;
      }
      const match = href.match(MOMENT_HREF);
      const inside = Boolean(link.closest("[data-reading-layer]"));
      if (/\/moments\/[^/]+\/edit$/.test(href) || (inside && (!match || match[1] === "new"))) {
        restoreBackground();
        setId(null);
        return;
      }
      if (!match || match[1] === "new") {
        return;
      }
      if (inside) {
        event.preventDefault();
        event.stopPropagation();
        window.dispatchEvent(new CustomEvent("reading-switch", { detail: match[1] }));
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      markReadingOrigin(link, match[1]);
      rememberReadingScroll(window.scrollY);
      backgroundPath = `${window.location.pathname}${window.location.search}`;
      window.history.pushState(
        { ...(window.history.state ?? {}), __NA: true, readingLayer: match[1] },
        "",
        `/moments/${match[1]}`,
      );
      setId(match[1]);
    };
    const onPop = () => {
      if (!MOMENT_HREF.test(window.location.pathname) || window.location.pathname === "/moments/new") {
        setId(null);
      }
    };
    const onClose = () => {
      restoreBackground();
      setId(null);
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPop);
    window.addEventListener("reading-close", onClose);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("reading-close", onClose);
    };
  }, []);

  if (!id) {
    return null;
  }
  return <ReadingLayer id={id} overlay />;
}
