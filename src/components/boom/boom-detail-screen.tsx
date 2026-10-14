"use client";

import { ChevronRight, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ToastNotice } from "@/components/navigation/bottom-nav";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { text } from "@/constants/text";
import { deleteBoom, getBoom } from "@/lib/boom";
import { getMoment } from "@/lib/moments";
import { displayTitle, formatWhen, previewText, type Boom, type Moment } from "@/lib/model";

export function BoomDetailScreen({ id }: { id: string }) {
  const router = useRouter();
  const [boom, setBoom] = useState<Boom | null | undefined>(undefined);
  const [sources, setSources] = useState<Array<Moment | null>>([]);
  const [result, setResult] = useState<Moment | null>(null);
  const [menu, setMenu] = useState(false);
  const [pendingRemove, setPendingRemove] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getBoom(id)
      .then(async (next) => {
        if (cancelled) {
          return;
        }
        setBoom(next);
        if (!next) {
          return;
        }
        const loadedSources = await Promise.all(next.sourceMomentIds.map((sourceId) => getMoment(sourceId)));
        const loadedResult = next.resultMomentId ? await getMoment(next.resultMomentId) : null;
        if (!cancelled) {
          setSources(loadedSources);
          setResult(loadedResult);
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
  }, [id]);

  async function confirmRemove() {
    setPendingRemove(false);
    try {
      await deleteBoom(id);
      router.push("/boom");
    } catch {
      setError(text.v1.saveError);
    }
  }

  if (boom === undefined && !error) {
    return <p className="px-5 py-16 text-center text-[15px] text-[#8A8178]">{text.v1.loading}</p>;
  }

  if (!boom) {
    return (
      <div className="mx-auto min-h-dvh w-full max-w-lg bg-[#F7F4EF] px-5 py-16 text-center">
        <p className="text-[16px] text-[#2C2825]">{text.v1.boomGone}</p>
        <Link href="/boom" className="mt-4 inline-flex min-h-11 items-center text-[15px]">
          {text.back}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-dvh w-full max-w-lg bg-[#F7F4EF] md:max-w-3xl">
      <header className="px-4 pt-4">
        <div className="flex items-center justify-between">
          <Link
            href={`/boom#event-${boom.id}`}
            className="inline-flex min-h-11 items-center px-2 text-[16px] text-[#8A8178] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8C7358]"
          >
            {text.back}
          </Link>
          <button
            type="button"
            aria-label={text.v1.more}
            onClick={() => setMenu(true)}
            className="flex size-11 items-center justify-center rounded-full text-[#8A8178] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8C7358]"
          >
            <MoreHorizontal className="size-5" aria-hidden="true" />
          </button>
        </div>
        <h1 className="px-2 text-center text-[22px] font-semibold text-[#2C2825]">{text.v1.boomDetailTitle}</h1>
        <p className="mt-1 text-center text-[13px] text-[#8A8178]">
          {formatWhen(boom.createdAt)} · {text.v1.boomSourceCount(boom.sourceMomentIds.length)}
        </p>
      </header>
      <main className="px-5 pt-5 pb-16">
        {error ? <p className="mb-3 text-[14px] text-[#2C2825]">{error}</p> : null}
        <h2 className="text-[13px] font-medium tracking-[0.04em] text-[#8C7358]">{text.v1.boomSources}</h2>
        <div className="mt-2 flex flex-col">
          {boom.sourceMomentIds.map((sourceId, index) => (
            <MomentRow key={sourceId} moment={sources[index] ?? null} />
          ))}
        </div>
        {boom.resultMomentId ? (
          <section className="mt-6">
            <h2 className="text-[13px] font-medium tracking-[0.04em] text-[#8C7358]">{text.v1.boomNewMoment}</h2>
            <div className="mt-2">
              <MomentRow moment={result} />
            </div>
          </section>
        ) : null}
      </main>
      <ToastNotice />
      {menu ? (
        <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setMenu(false)}>
          <div
            role="menu"
            className="absolute inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] mx-auto max-w-sm rounded-[14px] bg-[#FBF8F4] p-2"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              role="menuitem"
              className="flex min-h-11 w-full items-center rounded-[10px] px-3 text-left text-[16px]"
              onClick={() => {
                setMenu(false);
                setPendingRemove(true);
              }}
            >
              {text.v1.removeBoom}
            </button>
            <button
              type="button"
              className="flex min-h-11 w-full items-center rounded-[10px] px-3 text-left text-[16px] text-[#8A8178]"
              onClick={() => setMenu(false)}
            >
              {text.v1.cancel}
            </button>
          </div>
        </div>
      ) : null}
      {pendingRemove ? (
        <ConfirmDialog
          title={text.v1.removeBoomTitle}
          body={text.v1.removeBoomBody}
          confirmLabel={text.v1.removeBoom}
          cancelLabel={text.v1.cancel}
          onCancel={() => setPendingRemove(false)}
          onConfirm={() => void confirmRemove()}
        />
      ) : null}
    </div>
  );
}

function MomentRow({ moment }: { moment: Moment | null }) {
  if (!moment) {
    return <p className="border-b border-[#E7E0D6] py-4 text-[14px] text-[#8A8178]">{text.v1.missingMoment}</p>;
  }
  const preview = previewText(moment).replace(/\s+/g, " ").trim();
  return (
    <Link
      href={`/moments/${moment.id}`}
      className="flex items-center gap-3 border-b border-[#E7E0D6] py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8C7358] focus-visible:ring-offset-2"
    >
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-[14px] leading-[18px] font-semibold text-[#2C2825] [overflow-wrap:anywhere]">
          {displayTitle(moment)}
        </span>
        {preview ? <span className="mt-1 line-clamp-1 text-[12px] leading-4 text-[#6F675F]">{preview}</span> : null}
      </span>
      <ChevronRight className="size-4 shrink-0 text-[#8A8178]" aria-hidden="true" />
    </Link>
  );
}
