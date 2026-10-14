"use client";

import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";
import { text } from "@/constants/text";
import { displayTitle, firstImageId, formatWhen, previewText, type Moment } from "@/lib/model";
import { markReadingOrigin } from "@/components/moment/reading-origin";
import { useAssetUrl } from "@/components/moment/use-asset-url";
import { cn } from "@/lib/utils";

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
    <article
      className={cn(
        "relative mb-4 flex w-full break-inside-avoid overflow-hidden rounded-[16px] active:bg-[#EFE8DF]",
        imageId ? "h-[210px]" : "h-[150px]",
      )}
    >
      <Link
        href={`/moments/${moment.id}`}
        scroll={false}
        className="flex min-h-0 min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8C7358] focus-visible:ring-inset"
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
            return;
          }
          markReadingOrigin(event.currentTarget, moment.id);
        }}
      >
        {imageId ? (
          <div className="h-full w-[84px] shrink-0 overflow-hidden bg-[#E7E0D6]">
            {cover.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cover.url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center px-1 text-center text-[12px] text-[#8A8178]">
                {cover.missing ? text.v1.missingImage : ""}
              </div>
            )}
          </div>
        ) : null}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col px-3.5 pt-3 pb-2">
          <h2 className="line-clamp-2 shrink-0 text-[15px] leading-[20px] font-semibold text-[#2C2825] [overflow-wrap:anywhere]">
            {title}
          </h2>
          {preview ? (
            <p className="mt-1 line-clamp-1 shrink-0 text-[13px] leading-[18px] text-[#6F675F] [overflow-wrap:anywhere]">
              {preview}
            </p>
          ) : null}
          <div className="mt-auto flex min-w-0 shrink-0 flex-col gap-0.5 pt-1.5 pr-6">
            <span className="block max-w-full truncate text-[12px] leading-4 text-[#8A8178]">
              {spaceName}
            </span>
            <span className="block truncate text-[11px] leading-4 text-[#8A8178]">
              {formatWhen(moment.createdAt)}
            </span>
          </div>
        </div>
      </Link>
      <button
        type="button"
        aria-label={text.v1.more}
        onClick={() => onMenu(moment)}
        className="absolute right-0 bottom-0 flex size-11 items-center justify-center rounded-full text-[#8A8178] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8C7358]"
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
    <article className="relative border-b border-[#E7E0D6]">
      <Link
        href={`/moments/${moment.id}`}
        scroll={false}
        className="block py-3 pr-12 pl-1"
        onClick={(event) => markReadingOrigin(event.currentTarget, moment.id)}
      >
        <h2 className="truncate text-[16px] font-medium text-[#2C2825]">{title}</h2>
        {preview ? <p className="mt-1 truncate text-[14px] text-[#8A8178]">{preview}</p> : null}
        <p className="mt-1 text-[12px] text-[#8A8178]">{formatWhen(moment.updatedAt)}</p>
      </Link>
      <button
        type="button"
        aria-label={text.v1.more}
        onClick={() => onMenu(moment)}
        className="absolute top-1/2 right-0 flex size-11 -translate-y-1/2 items-center justify-center text-[#8A8178]"
      >
        <MoreHorizontal className="size-5" aria-hidden="true" />
      </button>
    </article>
  );
}
