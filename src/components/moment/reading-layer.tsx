"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MomentDetail } from "@/components/moment/moment-detail";
import { committed, gestureBlocked, prefersReducedMotion, resist, trackAxis } from "@/components/moment/reading-gesture";
import { readingOriginFor, takeReadingScroll, type ReadingRect } from "@/components/moment/reading-origin";

const EASE = "cubic-bezier(0.2, 0.8, 0.2, 1)";

export function ReadingLayer({ id, overlay = false }: { id: string; overlay?: boolean }) {
  const router = useRouter();
  const frameRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLElement>(null);
  const openedId = useRef(id);
  const lockedY = useRef(0);
  const closing = useRef(false);
  const busy = useRef(false);
  const closeRef = useRef<() => void>(() => {});
  const [currentId, setCurrentId] = useState(id);
  const [order, setOrder] = useState<string[]>([id]);
  const [finger, setFinger] = useState(0);
  const [shift, setShift] = useState(0);
  const [pull, setPull] = useState(0);
  const [animate, setAnimate] = useState(false);
  const currentRef = useRef(currentId);
  const orderRef = useRef(order);
  currentRef.current = currentId;
  orderRef.current = order;

  const place = Math.max(0, order.indexOf(currentId));
  const previousId = place > 0 ? order[place - 1] : null;
  const followingId = place < order.length - 1 ? order[place + 1] : null;

  useEffect(() => {
    const ids: string[] = [];
    document.querySelectorAll("a[href]").forEach((node) => {
      if (!(node instanceof HTMLAnchorElement) || node.closest("[data-reading-layer]")) {
        return;
      }
      const match = (node.getAttribute("href") ?? "").match(/^\/moments\/([^/?#]+)$/);
      if (!match || match[1] === "new" || ids.includes(match[1])) {
        return;
      }
      ids.push(match[1]);
    });
    if (!ids.includes(openedId.current)) {
      ids.unshift(openedId.current);
    }
    setOrder(ids);
  }, []);

  useLayoutEffect(() => {
    if (!overlay) {
      return;
    }
    const y = takeReadingScroll() ?? window.scrollY;
    lockedY.current = y;
    const body = document.body;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
    };
    window.scrollTo(0, y);
    body.style.position = "fixed";
    body.style.top = `-${y}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";
    return () => {
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.width = previous.width;
      body.style.overflow = previous.overflow;
      const restore = lockedY.current;
      window.scrollTo(0, restore);
      const started = Date.now();
      const timer = window.setInterval(() => {
        if (Math.abs(window.scrollY - restore) > 1) {
          window.scrollTo(0, restore);
        }
        if (Date.now() - started > 500) {
          window.clearInterval(timer);
        }
      }, 40);
    };
  }, [overlay]);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame || !overlay) {
      return;
    }
    const animation = playEnter(frame, readingOriginFor(openedId.current));
    return () => animation.cancel();
  }, [overlay]);

  useEffect(() => {
    if (currentId === openedId.current && window.location.pathname === `/moments/${currentId}`) {
      return;
    }
    const path = `/moments/${currentId}`;
    if (window.location.pathname !== path) {
      window.history.replaceState(window.history.state, "", path);
    }
  }, [currentId]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }
    return trackAxis(element, {
      startAllowed: ({ target }) =>
        !busy.current && !gestureBlocked() && !(target instanceof Element && target.closest("[data-image-strip]")),
      chooseAxis: (axis, { dy }) => {
        if (axis === "x") {
          return "x";
        }
        if (dy > 0 && element.scrollTop <= 0) {
          return "y";
        }
        return null;
      },
      onMove: ({ axis, dx, dy }) => {
        setAnimate(false);
        if (axis === "y") {
          setPull(Math.max(0, dy));
          setFinger(0);
          return;
        }
        const ids = orderRef.current;
        const index = ids.indexOf(currentRef.current);
        setPull(0);
        setFinger(resist(dx, (dx < 0 && index < ids.length - 1) || (dx > 0 && index > 0)));
      },
      onEnd: ({ axis, dx, dy, dt }) => {
        if (axis === "y") {
          if (dy > 80 || dy / dt > 0.55) {
            closeRef.current();
            return;
          }
          setAnimate(true);
          setPull(0);
          return;
        }
        const width = element.clientWidth || 1;
        const ids = orderRef.current;
        const index = ids.indexOf(currentRef.current);
        const forward = dx < 0 && index < ids.length - 1 && committed(dx, dt, width);
        const back = dx > 0 && index > 0 && committed(dx, dt, width);
        if (!forward && !back) {
          setAnimate(true);
          setFinger(0);
          return;
        }
        const nextId = ids[index + (forward ? 1 : -1)];
        if (prefersReducedMotion()) {
          setFinger(0);
          setShift(0);
          setCurrentId(nextId);
          element.scrollTop = 0;
          return;
        }
        busy.current = true;
        setAnimate(true);
        setFinger(0);
        setShift(forward ? -1 : 1);
        window.setTimeout(() => {
          busy.current = false;
          setAnimate(false);
          setShift(0);
          setCurrentId(nextId);
          element.scrollTop = 0;
        }, 320);
      },
    });
  }, [currentId]);

  function requestClose() {
    if (closing.current) {
      return;
    }
    closing.current = true;
    const frame = frameRef.current;
    if (overlay && currentId !== openedId.current) {
      alignToMoment(currentId);
    }
    const rect = overlay ? momentRect(currentId) : null;
    if (!frame || !overlay) {
      leave();
      return;
    }
    playExit(frame, rect, leave);
  }
  closeRef.current = requestClose;

  function alignToMoment(momentId: string) {
    const node = momentNode(momentId);
    if (!node) {
      return;
    }
    const absoluteTop = node.getBoundingClientRect().top + lockedY.current;
    const nextY = Math.max(0, absoluteTop - window.innerHeight * 0.25);
    lockedY.current = nextY;
    document.body.style.top = `-${nextY}px`;
    node.getBoundingClientRect();
  }

  function leave() {
    if (overlay) {
      window.history.back();
      return;
    }
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/");
  }

  useEffect(() => {
    const onSwitch = (event: Event) => {
      const next = (event as CustomEvent<string>).detail;
      if (!next || next === currentRef.current) {
        return;
      }
      setOrder((ids) => (ids.includes(next) ? ids : [next]));
      setCurrentId(next);
      if (scrollRef.current) {
        scrollRef.current.scrollTop = 0;
      }
    };
    window.addEventListener("reading-switch", onSwitch);
    return () => window.removeEventListener("reading-switch", onSwitch);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (gestureBlocked()) {
        return;
      }
      if (event.key === "Escape") {
        closeRef.current();
      }
      const nextId = event.key === "ArrowLeft" ? previousId : event.key === "ArrowRight" ? followingId : null;
      if (nextId) {
        setCurrentId(nextId);
        if (scrollRef.current) {
          scrollRef.current.scrollTop = 0;
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [followingId, previousId]);

  const motion = prefersReducedMotion() ? "120ms linear" : `320ms ${EASE}`;

  return (
    <div
      ref={frameRef}
      data-reading-layer
      className={overlay ? "fixed inset-0 z-30 overflow-hidden bg-[#F7F4EF]" : "h-dvh overflow-hidden bg-[#F7F4EF]"}
    >
      <div
        className="flex h-full w-[300%]"
        style={{
          transform: `translate3d(calc(${(-1 + shift) * (100 / 3)}% + ${finger}px), ${pull}px, 0)`,
          transition: animate ? `transform ${motion}` : "none",
        }}
      >
        <section className="pointer-events-none h-full w-1/3 overflow-hidden" aria-hidden="true">
          {previousId ? <MomentDetail id={previousId} passive /> : null}
        </section>
        <section ref={scrollRef} className="h-full w-1/3 overflow-y-auto overscroll-y-contain">
          <MomentDetail id={currentId} onBack={requestClose} />
        </section>
        <section className="pointer-events-none h-full w-1/3 overflow-hidden" aria-hidden="true">
          {followingId ? <MomentDetail id={followingId} passive /> : null}
        </section>
      </div>
    </div>
  );
}

function momentNode(momentId: string) {
  const link = [...document.querySelectorAll<HTMLAnchorElement>(`a[href="/moments/${momentId}"]`)].find(
    (node) => !node.closest("[data-reading-layer]"),
  );
  return link?.closest("article") ?? link ?? null;
}

function momentRect(momentId: string): ReadingRect | null {
  const node = momentNode(momentId);
  if (!node) {
    return null;
  }
  const rect = node.getBoundingClientRect();
  if (rect.width < 8 || rect.height < 8) {
    return null;
  }
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}

function playEnter(frame: HTMLElement, origin: ReadingRect | null) {
  const reduce = prefersReducedMotion();
  if (reduce || !origin) {
    const animation = frame.animate(
      reduce
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [
            { opacity: 0, transform: "translateY(12px)" },
            { opacity: 1, transform: "none" },
          ],
      { duration: reduce ? 120 : 320, easing: reduce ? "linear" : EASE, fill: "both" },
    );
    animation.onfinish = () => animation.cancel();
    return animation;
  }
  const animation = frame.animate(
    [
      {
        transformOrigin: "0 0",
        transform: `translate(${origin.left}px, ${origin.top}px) scale(${origin.width / window.innerWidth}, ${origin.height / window.innerHeight})`,
        borderRadius: "16px",
      },
      { transformOrigin: "0 0", transform: "none", borderRadius: "0px" },
    ],
    { duration: 320, easing: EASE, fill: "both" },
  );
  animation.onfinish = () => animation.cancel();
  return animation;
}

function playExit(frame: HTMLElement, rect: ReadingRect | null, done: () => void) {
  let finished = false;
  const finish = () => {
    if (finished) {
      return;
    }
    finished = true;
    done();
  };
  const reduce = prefersReducedMotion();
  const animation = frame.animate(
    reduce || !rect
      ? [{ opacity: 1, transform: "none" }, { opacity: 0, transform: reduce ? "none" : "translateY(12px)" }]
      : [
          { transformOrigin: "0 0", transform: "none", borderRadius: "0px" },
          {
            transformOrigin: "0 0",
            transform: `translate(${rect.left}px, ${rect.top}px) scale(${rect.width / window.innerWidth}, ${rect.height / window.innerHeight})`,
            borderRadius: "16px",
          },
        ],
    { duration: reduce ? 120 : 320, easing: reduce ? "linear" : EASE, fill: "forwards" },
  );
  animation.onfinish = finish;
  window.setTimeout(finish, (reduce ? 120 : 320) + 50);
}
