type Drag = {
  x: number;
  y: number;
  t: number;
  axis: "x" | "y" | null;
  dx: number;
  dy: number;
  pointerId: number | null;
};

export function resist(distance: number, allowed: boolean) {
  if (allowed) {
    return distance;
  }
  const sign = Math.sign(distance);
  if (!sign) {
    return 0;
  }
  return sign * Math.min(8, Math.abs(distance) * 0.15);
}

export function committed(distance: number, dt: number, size: number) {
  return Math.abs(distance) > size * 0.3 || Math.abs(distance) / Math.max(1, dt) > 0.55;
}

export function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function trackAxis(
  element: HTMLElement,
  {
    startAllowed,
    chooseAxis,
    onMove,
    onEnd,
  }: {
    startAllowed: (point: { x: number; y: number; target: EventTarget | null }) => boolean;
    chooseAxis: (axis: "x" | "y", point: { dx: number; dy: number; target: EventTarget | null }) => "x" | "y" | null;
    onMove: (point: { axis: "x" | "y"; dx: number; dy: number }) => void;
    onEnd: (point: { axis: "x" | "y"; dx: number; dy: number; dt: number }) => void;
  },
) {
  let drag: Drag | null = null;
  let target: EventTarget | null = null;
  let suppressClick = false;

  function begin(x: number, y: number, t: number, nextTarget: EventTarget | null, pointerId: number | null) {
    if (x < 24 || !startAllowed({ x, y, target: nextTarget })) {
      drag = null;
      return;
    }
    target = nextTarget;
    drag = { x, y, t, axis: null, dx: 0, dy: 0, pointerId };
  }

  function move(x: number, y: number, event: Event) {
    if (!drag) {
      return;
    }
    const dx = x - drag.x;
    const dy = y - drag.y;
    if (!drag.axis) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
        return;
      }
      const chosen = chooseAxis(Math.abs(dx) > Math.abs(dy) ? "x" : "y", { dx, dy, target });
      if (!chosen) {
        drag = null;
        return;
      }
      drag.axis = chosen;
      if (drag.pointerId !== null) {
        try {
          element.setPointerCapture(drag.pointerId);
        } catch {
          // The pointer can already be gone.
        }
      }
    }
    drag.dx = dx;
    drag.dy = dy;
    if (drag.axis === "x" && event.cancelable) {
      event.preventDefault();
    }
    onMove({ axis: drag.axis, dx, dy });
  }

  function finish(t: number) {
    if (!drag?.axis) {
      drag = null;
      return;
    }
    const { axis, dx, dy } = drag;
    const dt = Math.max(1, t - drag.t);
    if (Math.abs(axis === "x" ? dx : dy) > 10) {
      suppressClick = true;
    }
    drag = null;
    onEnd({ axis, dx, dy, dt });
  }

  const onTouchStart = (event: TouchEvent) => {
    if (event.touches.length !== 1) {
      return;
    }
    const touch = event.touches[0];
    begin(touch.clientX, touch.clientY, event.timeStamp, event.target, null);
  };
  const onTouchMove = (event: TouchEvent) => {
    if (!drag || event.touches.length !== 1) {
      return;
    }
    const touch = event.touches[0];
    move(touch.clientX, touch.clientY, event);
  };
  const onTouchEnd = (event: TouchEvent) => finish(event.timeStamp);
  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType === "touch" || event.button !== 0) {
      return;
    }
    begin(event.clientX, event.clientY, event.timeStamp, event.target, event.pointerId);
  };
  const onPointerMove = (event: PointerEvent) => {
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    move(event.clientX, event.clientY, event);
  };
  const onPointerUp = (event: PointerEvent) => {
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    finish(event.timeStamp);
  };
  const onClick = (event: MouseEvent) => {
    if (!suppressClick) {
      return;
    }
    suppressClick = false;
    event.preventDefault();
    event.stopPropagation();
  };

  element.addEventListener("touchstart", onTouchStart, { passive: true });
  element.addEventListener("touchmove", onTouchMove, { passive: false });
  element.addEventListener("touchend", onTouchEnd);
  element.addEventListener("touchcancel", onTouchEnd);
  element.addEventListener("pointerdown", onPointerDown);
  element.addEventListener("pointermove", onPointerMove);
  element.addEventListener("pointerup", onPointerUp);
  element.addEventListener("pointercancel", onPointerUp);
  element.addEventListener("click", onClick, true);

  return () => {
    element.removeEventListener("touchstart", onTouchStart);
    element.removeEventListener("touchmove", onTouchMove);
    element.removeEventListener("touchend", onTouchEnd);
    element.removeEventListener("touchcancel", onTouchEnd);
    element.removeEventListener("pointerdown", onPointerDown);
    element.removeEventListener("pointermove", onPointerMove);
    element.removeEventListener("pointerup", onPointerUp);
    element.removeEventListener("pointercancel", onPointerUp);
    element.removeEventListener("click", onClick, true);
  };
}

export function gestureBlocked() {
  return Boolean(document.querySelector("[role='dialog'], [role='menu'], [data-image-viewer]"));
}
