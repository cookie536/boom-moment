"use client";

import { useEffect, useRef, useState } from "react";
import { committed, prefersReducedMotion, resist, trackAxis } from "@/components/moment/reading-gesture";
import { text } from "@/constants/text";

export function ImageViewer({
  images,
  index,
  onIndex,
  onClose,
}: {
  images: { url: string; alt?: string }[];
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState(0);
  const indexRef = useRef(index);
  indexRef.current = index;
  const onIndexRef = useRef(onIndex);
  onIndexRef.current = onIndex;
  const current = images[index];

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
      if (event.key === "ArrowRight") {
        onIndex(Math.min(images.length - 1, index + 1));
      }
      if (event.key === "ArrowLeft") {
        onIndex(Math.max(0, index - 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [images.length, index, onClose, onIndex]);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    return trackAxis(element, {
      startAllowed: () => true,
      chooseAxis: (axis) => (axis === "x" ? "x" : null),
      onMove: ({ dx }) => {
        const currentIndex = indexRef.current;
        setDrag(resist(dx, (dx < 0 && currentIndex < images.length - 1) || (dx > 0 && currentIndex > 0)));
      },
      onEnd: ({ dx, dt }) => {
        const width = element.clientWidth || 1;
        const currentIndex = indexRef.current;
        setDrag(0);
        if (prefersReducedMotion()) {
          if (dx < -24 && currentIndex < images.length - 1) {
            onIndexRef.current(currentIndex + 1);
          } else if (dx > 24 && currentIndex > 0) {
            onIndexRef.current(currentIndex - 1);
          }
          return;
        }
        if (dx < 0 && currentIndex < images.length - 1 && committed(dx, dt, width)) {
          onIndexRef.current(currentIndex + 1);
        } else if (dx > 0 && currentIndex > 0 && committed(dx, dt, width)) {
          onIndexRef.current(currentIndex - 1);
        }
      },
    });
  }, [images.length]);

  if (!current) {
    return null;
  }

  return (
    <div
      ref={ref}
      data-image-viewer
      className="fixed inset-0 z-50 flex flex-col bg-[#2C2825]"
      role="dialog"
      aria-modal="true"
      style={{ touchAction: "none" }}
    >
      <div className="flex justify-end px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button type="button" onClick={onClose} className="min-h-11 rounded-[14px] px-4 text-[15px] text-[#F7F4EF]">
          {text.v1.close}
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4" onClick={onClose}>
        {current.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={current.url}
            alt={current.alt || text.v1.imageAlt}
            className="max-h-full max-w-full object-contain"
            style={{ transform: `translate3d(${drag}px, 0, 0)` }}
            onClick={(event) => event.stopPropagation()}
          />
        ) : (
          <div className="h-40 w-full max-w-sm rounded-[14px] bg-[#E7E0D6]" />
        )}
      </div>
      {images.length > 1 ? (
        <div className="flex justify-center pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {images.map((image, imageIndex) => (
            <button
              key={`${image.url}-${imageIndex}`}
              type="button"
              aria-current={imageIndex === index ? "true" : undefined}
              onClick={() => onIndex(imageIndex)}
              className="flex size-11 items-center justify-center"
            >
              <span className={imageIndex === index ? "size-1.5 rounded-full bg-[#8C7358]" : "size-1.5 rounded-full bg-[#6F675F]"} />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
