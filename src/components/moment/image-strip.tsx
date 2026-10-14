"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ImageViewer } from "@/components/moment/image-viewer";
import { useAssetUrl } from "@/components/moment/use-asset-url";
import { committed, gestureBlocked, prefersReducedMotion, resist, trackAxis } from "@/components/moment/reading-gesture";
import { text } from "@/constants/text";
import type { ContentBlock } from "@/lib/model";

type ImageBlock = Extract<ContentBlock, { type: "image" }>;

export function ImageGroup({ blocks }: { blocks: ImageBlock[] }) {
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const safeIndex = Math.min(index, blocks.length - 1);

  return (
    <div>
      <ImageStrip blocks={blocks} index={safeIndex} onIndex={setIndex} onOpen={() => setOpen(true)} />
      {open ? (
        <GroupViewer blocks={blocks} index={safeIndex} onIndex={setIndex} onClose={() => setOpen(false)} />
      ) : null}
    </div>
  );
}

function ImageStrip({
  blocks,
  index,
  onIndex,
  onOpen,
}: {
  blocks: ImageBlock[];
  index: number;
  onIndex: (index: number) => void;
  onOpen: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState(0);
  const [animate, setAnimate] = useState(false);
  const indexRef = useRef(index);
  indexRef.current = index;

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    return trackAxis(element, {
      startAllowed: () => !gestureBlocked(),
      chooseAxis: (axis) => (axis === "x" ? "x" : null),
      onMove: ({ dx }) => {
        const current = indexRef.current;
        setAnimate(false);
        setDrag(resist(dx, (dx < 0 && current < blocks.length - 1) || (dx > 0 && current > 0)));
      },
      onEnd: ({ dx, dt }) => {
        const width = element.clientWidth || 1;
        const current = indexRef.current;
        const forward = dx < 0 && current < blocks.length - 1 && committed(dx, dt, width);
        const back = dx > 0 && current > 0 && committed(dx, dt, width);
        if (!forward && !back) {
          setAnimate(true);
          setDrag(0);
          return;
        }
        const next = forward ? current + 1 : current - 1;
        if (prefersReducedMotion()) {
          setAnimate(false);
          setDrag(0);
          onIndex(next);
          return;
        }
        setAnimate(true);
        setDrag(forward ? -width : width);
        window.setTimeout(() => {
          setAnimate(false);
          setDrag(0);
          onIndex(next);
        }, 320);
      },
    });
  }, [blocks.length, onIndex]);

  const width = ref.current?.clientWidth ?? 0;

  return (
    <div>
      <div ref={ref} data-image-strip className="overflow-hidden" style={{ touchAction: "pan-y" }}>
        <div
          className="flex"
          style={{
            transform: width ? `translate3d(${-index * width + drag}px, 0, 0)` : undefined,
            transition: animate ? "transform 320ms cubic-bezier(0.2, 0.8, 0.2, 1)" : "none",
          }}
        >
          {blocks.map((block, blockIndex) => (
            <div key={block.id} className="w-full shrink-0">
              <ImageSlide block={block} onOpen={blockIndex === index ? onOpen : undefined} />
            </div>
          ))}
        </div>
      </div>
      {blocks.length > 1 ? (
        <div className="mt-1 flex justify-center">
          {blocks.map((block, blockIndex) => (
            <button
              key={block.id}
              type="button"
              aria-label={`${blockIndex + 1}`}
              aria-current={blockIndex === index ? "true" : undefined}
              onClick={() => onIndex(blockIndex)}
              className="flex size-11 items-center justify-center"
            >
              <span className={blockIndex === index ? "size-1.5 rounded-full bg-[#8C7358]" : "size-1.5 rounded-full bg-[#E7E0D6]"} />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ImageSlide({ block, onOpen }: { block: ImageBlock; onOpen?: () => void }) {
  const image = useAssetUrl(block.assetId, false);
  if (image.missing) {
    return <p className="text-[14px] text-[#8A8178]">{text.v1.missingImage}</p>;
  }
  if (!image.url) {
    return <div className="h-40 rounded-[14px] bg-[#E7E0D6]" />;
  }
  return (
    <button type="button" onClick={onOpen} className="block w-full text-left">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image.url} alt={block.alt || text.v1.imageAlt} className="w-full rounded-[14px]" />
    </button>
  );
}

function GroupViewer({
  blocks,
  index,
  onIndex,
  onClose,
}: {
  blocks: ImageBlock[];
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
}) {
  const [urls, setUrls] = useState<Record<string, string>>({});

  const viewer = (
    <>
      {blocks.map((block) => (
        <UrlSource
          key={block.id}
          assetId={block.assetId}
          onUrl={(url) => setUrls((current) => (current[block.id] === url ? current : { ...current, [block.id]: url }))}
        />
      ))}
      <ImageViewer
        images={blocks.map((block) => ({ url: urls[block.id] ?? "", alt: block.alt }))}
        index={index}
        onIndex={onIndex}
        onClose={onClose}
      />
    </>
  );

  if (typeof document === "undefined") {
    return null;
  }
  return createPortal(viewer, document.body);
}

function UrlSource({ assetId, onUrl }: { assetId: string; onUrl: (url: string) => void }) {
  const image = useAssetUrl(assetId, false);
  useEffect(() => {
    if (image.url) {
      onUrl(image.url);
    }
  }, [image.url, onUrl]);
  return null;
}
