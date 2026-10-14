"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { MomentEditor } from "@/components/editor/moment-editor";
import { useAssetUrl } from "@/components/moment/use-asset-url";
import { text } from "@/constants/text";
import { boomQuery, uniqueIds, writeBoomSelection } from "@/lib/boom-selection";
import { getMoment } from "@/lib/moments";
import { displayTitle, previewText, type Moment } from "@/lib/model";
import { cn } from "@/lib/utils";

export function BoomWriteScreen() {
  const params = useSearchParams();
  const ids = uniqueIds(params.getAll("m"));
  const idKey = ids.join("\0");
  const [moments, setMoments] = useState<Array<Moment | null> | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const next = idKey ? idKey.split("\0") : [];
    writeBoomSelection(next);
    if (next.length === 0) {
      setMoments([]);
      return;
    }
    let cancelled = false;
    void Promise.all(next.map((id) => getMoment(id)))
      .then((loaded) => {
        if (!cancelled) {
          setMoments(loaded);
          setOpenId((current) => (current && next.includes(current) ? current : null));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(text.v1.loadError);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [idKey]);

  const backHref = ids.length > 0 ? `/boom?${boomQuery(ids)}` : "/boom";

  return (
    <div className="mx-auto min-h-dvh w-full max-w-lg bg-[#F7F4EF] md:max-w-3xl">
      <header className="px-4 pt-4">
        <div className="flex items-center">
          <Link
            href={backHref}
            className="inline-flex min-h-11 items-center px-2 text-[16px] text-[#8A8178] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8C7358]"
          >
            {text.back}
          </Link>
          <h1 className="flex-1 pr-11 text-center text-[17px] font-semibold text-[#2C2825]">{text.v1.boom}</h1>
        </div>
        <p className="px-2 text-center text-[13px] text-[#8A8178]">{text.v1.boomSourceCount(ids.length)}</p>
      </header>
      <main className="px-5 pt-4 pb-12">
        {error ? <p className="mb-3 text-[14px] text-[#2C2825]">{error}</p> : null}
        {ids.length < 2 ? <p className="mb-4 text-[14px] text-[#2C2825]">{text.v1.boomNeed}</p> : null}
        <div className="flex flex-col">
          {ids.map((id, index) => (
            <SourceRow
              key={id}
              index={index}
              moment={moments ? moments[index] ?? null : undefined}
              open={openId === id}
              onToggle={() => setOpenId((current) => (current === id ? null : id))}
            />
          ))}
        </div>
        <h2 className="mt-8 text-[13px] font-medium tracking-[0.04em] text-[#8C7358]">{text.v1.boomNewMoment}</h2>
        <div className="mt-3">
          <MomentEditor embedded linkTo={ids} />
        </div>
      </main>
    </div>
  );
}

function SourceRow({
  index,
  moment,
  open,
  onToggle,
}: {
  index: number;
  moment: Moment | null | undefined;
  open: boolean;
  onToggle: () => void;
}) {
  const preview = moment ? previewText(moment).replace(/\s+/g, " ").trim() : "";
  return (
    <article className={cn("border-b border-[#E7E0D6]", open ? "bg-[#EFE8DF]" : "")}>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full items-start gap-3 px-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8C7358] focus-visible:ring-inset"
      >
        <span className="shrink-0 text-[13px] font-semibold text-[#8C7358]">{String(index + 1).padStart(2, "0")}</span>
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 text-[14px] leading-[18px] font-semibold text-[#2C2825] [overflow-wrap:anywhere]">
            {moment === undefined ? text.v1.loading : moment ? displayTitle(moment) : text.v1.missingMoment}
          </span>
          {preview && !open ? (
            <span className="mt-1 line-clamp-1 text-[12px] leading-4 text-[#6F675F] [overflow-wrap:anywhere]">{preview}</span>
          ) : null}
        </span>
        <ChevronDown className={cn("mt-0.5 size-4 shrink-0 text-[#8A8178]", open ? "rotate-180" : "")} aria-hidden="true" />
      </button>
      {open && moment ? (
        <div className="flex flex-col gap-3 border-t border-[#E7E0D6] px-3 py-3">
          {moment.blocks.map((block) =>
            block.type === "text" ? (
              <p key={block.id} className="text-[16px] leading-[28px] whitespace-pre-wrap text-[#2C2825]">
                {block.text}
              </p>
            ) : (
              <SourceImage key={block.id} assetId={block.assetId} alt={block.alt} />
            ),
          )}
        </div>
      ) : null}
    </article>
  );
}

function SourceImage({ assetId, alt }: { assetId: string; alt?: string }) {
  const image = useAssetUrl(assetId, false);
  if (image.missing) {
    return <p className="text-[14px] text-[#8A8178]">{text.v1.missingImage}</p>;
  }
  if (!image.url) {
    return <div className="h-40 rounded-[14px] bg-[#EFE8DF]" />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={image.url} alt={alt || text.v1.imageAlt} className="max-h-80 w-full rounded-[14px] object-cover" />
  );
}
