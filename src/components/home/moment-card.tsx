"use client";

import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";
import { text } from "@/constants/text";
import { displayTitle, firstImageId, formatWhen, previewText, type Moment } from "@/lib/model";
import { useAssetUrl } from "@/components/moment/use-asset-url";

export function MomentCard({
  moment,
  spaceName,
  onMenu,
}: {
  moment: Moment;
  spaceName: string;
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
    <article className="relative flex h-[210px] min-w-0 flex-col overflow-hidden rounded-[14px] border border-[#EAEAEA] bg-white transition duration-150 active:scale-[0.98] [@media(hover:hover)]:hover:border-[#CFCFCF]">
      <Link
        href={`/moments/${moment.id}`}
        className="flex min-h-0 flex-1 flex-col text-left"
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
          <div className="h-14 shrink-0 overflow-hidden bg-[#EAEAEA]">
            {cover.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cover.url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-[12px] text-[#8A8A8E]">
                {cover.missing ? text.v1.missingImage : ""}
              </div>
            )}
          </div>
        ) : null}
        <div className="flex min-h-0 flex-1 flex-col px-3 pt-2 pb-2">
          <h2 className="line-clamp-2 shrink-0 text-[15px] leading-5 font-medium text-[#171717] [overflow-wrap:anywhere]">
            {title}
          </h2>
          {preview ? (
            <p className="mt-1 line-clamp-3 min-h-0 text-[13px] leading-[18px] text-[#8A8A8E] [overflow-wrap:anywhere]">
              {preview}
            </p>
          ) : null}
          <div className="mt-auto flex shrink-0 items-end gap-1 pt-1.5">
            <div className="min-w-0 flex-1">
              <span className="inline-block max-w-full truncate rounded-full border border-[#EAEAEA] px-2 py-0.5 text-[11px] leading-4 text-[#171717]">
                {spaceName}
              </span>
              <span className="mt-0.5 block truncate text-[11px] leading-4 text-[#8A8A8E]">
                {formatWhen(moment.createdAt)}
              </span>
            </div>
            <span className="w-8 shrink-0" aria-hidden="true" />
          </div>
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
