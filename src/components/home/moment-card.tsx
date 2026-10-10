"use client";

import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";
import { text } from "@/constants/text";
import { displayTitle, firstImageId, formatWhen, previewText, type Moment } from "@/lib/model";
import { useAssetUrl } from "@/components/moment/use-asset-url";

export function MomentCard({
  moment,
  onMenu,
}: {
  moment: Moment;
  onMenu: (moment: Moment) => void;
}) {
  const title = displayTitle(moment);
  const preview = previewText(moment);
  const imageId = firstImageId(moment);
  const cover = useAssetUrl(imageId, true);
  const pressed = useRef(false);
  const timer = useRef<number | null>(null);

  function clearTimer() {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }

  return (
    <article className="relative mb-3 break-inside-avoid rounded-[14px] border border-[#EAEAEA] bg-white">
      <Link
        href={`/moments/${moment.id}`}
        className="block text-left"
        onPointerDown={() => {
          pressed.current = false;
          clearTimer();
          timer.current = window.setTimeout(() => {
            pressed.current = true;
            onMenu(moment);
          }, 520);
        }}
        onPointerUp={clearTimer}
        onPointerLeave={clearTimer}
        onPointerCancel={clearTimer}
        onClick={(event) => {
          if (pressed.current) {
            event.preventDefault();
            pressed.current = false;
          }
        }}
      >
        {imageId ? (
          cover.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover.url} alt="" className="max-h-72 w-full rounded-t-[14px] object-cover" />
          ) : (
            <div className="flex h-28 items-center justify-center rounded-t-[14px] bg-[#EAEAEA] text-[13px] text-[#8A8A8E]">
              {cover.missing ? text.v1.missingImage : ""}
            </div>
          )
        ) : null}
        <div className="px-3 py-3 pr-10">
          <h2 className="text-[16px] leading-snug font-medium text-[#171717]">{title}</h2>
          {preview ? (
            <p className="mt-1 line-clamp-4 text-[14px] leading-relaxed whitespace-pre-wrap text-[#8A8A8E]">
              {preview}
            </p>
          ) : null}
          <p className="mt-2 text-[12px] text-[#8A8A8E]">{formatWhen(moment.updatedAt)}</p>
        </div>
      </Link>
      <button
        type="button"
        aria-label={text.v1.more}
        onClick={() => onMenu(moment)}
        className="absolute right-1 bottom-1 flex size-11 items-center justify-center rounded-full text-[#8A8A8E]"
      >
        <MoreHorizontal className="size-5" aria-hidden="true" />
      </button>
    </article>
  );
}

export function MomentListRow({
  moment,
  onMenu,
}: {
  moment: Moment;
  onMenu: (moment: Moment) => void;
}) {
  const title = displayTitle(moment);
  const preview = previewText(moment);

  return (
    <article className="relative border-b border-[#EAEAEA]">
      <Link href={`/moments/${moment.id}`} className="block py-3 pr-12 pl-1">
        <h2 className="truncate text-[16px] font-medium text-[#171717]">{title}</h2>
        {preview ? <p className="mt-1 truncate text-[14px] text-[#8A8A8E]">{preview}</p> : null}
        <p className="mt-1 text-[12px] text-[#8A8A8E]">{formatWhen(moment.updatedAt)}</p>
      </Link>
      <button
        type="button"
        aria-label={text.v1.more}
        onClick={() => onMenu(moment)}
        className="absolute top-1/2 right-0 flex size-11 -translate-y-1/2 items-center justify-center text-[#8A8A8E]"
      >
        <MoreHorizontal className="size-5" aria-hidden="true" />
      </button>
    </article>
  );
}
