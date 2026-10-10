"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useAssetUrl } from "@/components/moment/use-asset-url";
import { text } from "@/constants/text";
import { BoomDuplicateLinkError, BoomSelfLinkError, createLink, deleteLink, linksFor } from "@/lib/boom";
import { getMoment } from "@/lib/moments";
import { displayTitle, type BoomLink, type Moment } from "@/lib/model";

export function BoomCompareScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const leftId = params.get("a") ?? "";
  const rightId = params.get("b") ?? "";
  const [moments, setMoments] = useState<[Moment | null, Moment | null] | null>(null);
  const [link, setLink] = useState<BoomLink | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!leftId || !rightId || leftId === rightId) {
      return;
    }
    let cancelled = false;
    void Promise.all([getMoment(leftId), getMoment(rightId), linksFor(leftId)])
      .then(([left, right, rows]) => {
        if (cancelled) {
          return;
        }
        setMoments([left, right]);
        setLink(rows.find((item) => item.aId === rightId || item.bId === rightId) ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setError(text.v1.loadError);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [leftId, rightId]);

  async function connectOnly() {
    if (busy || leftId === rightId) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setLink(await createLink(leftId, rightId));
    } catch (caught) {
      setError(
        caught instanceof BoomDuplicateLinkError
          ? text.v1.alreadyConnected
          : caught instanceof BoomSelfLinkError
            ? text.v1.selfLink
            : text.v1.saveError,
      );
    } finally {
      setBusy(false);
    }
  }

  function connectAndCreate() {
    if (leftId === rightId) {
      return;
    }
    router.push(`/moments/new?link=${encodeURIComponent(leftId)}&link=${encodeURIComponent(rightId)}`);
  }

  async function unlink() {
    if (!link || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await deleteLink(link.id);
      setLink(null);
    } catch {
      setError(text.v1.saveError);
    } finally {
      setBusy(false);
    }
  }

  if (!leftId || !rightId || leftId === rightId) {
    return (
      <CompareFrame>
        <p className="text-[15px] text-[#8A8A8E]">{leftId && leftId === rightId ? text.v1.selfLink : text.v1.boomPair}</p>
      </CompareFrame>
    );
  }

  if (error && !moments) {
    return (
      <CompareFrame>
        <p className="text-[15px] text-[#8A8A8E]">{error}</p>
      </CompareFrame>
    );
  }

  if (!moments) {
    return (
      <CompareFrame>
        <p className="text-[15px] text-[#8A8A8E]">{text.v1.loading}</p>
      </CompareFrame>
    );
  }

  return (
    <CompareFrame>
      <div className="flex flex-col gap-8">
        <MomentColumn moment={moments[0]} />
        <MomentColumn moment={moments[1]} />
      </div>
      {link ? <p className="mt-8 text-[15px] text-[#171717]">{text.v1.boomLinked}</p> : null}
      {error ? <p className="mt-4 text-[14px] text-[#171717]">{error}</p> : null}
      <div className="mt-6 flex flex-col gap-2 pb-8">
        {link ? (
          <button
            type="button"
            onClick={() => void unlink()}
            disabled={busy}
            className="min-h-11 rounded-[14px] border border-[#EAEAEA] px-4 text-[15px] text-[#171717] disabled:text-[#8A8A8E]"
          >
            {text.v1.unlink}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void connectOnly()}
            disabled={busy}
            className="min-h-11 rounded-[14px] bg-[#171717] px-4 text-[15px] text-white disabled:bg-[#EAEAEA] disabled:text-[#8A8A8E]"
          >
            {text.v1.connect}
          </button>
        )}
        <button
          type="button"
          onClick={connectAndCreate}
          className="min-h-11 rounded-[14px] border border-[#EAEAEA] px-4 text-[15px] text-[#171717]"
        >
          {text.v1.connectCreate}
        </button>
        <p className="text-[13px] leading-relaxed text-[#8A8A8E]">{text.v1.boomSaveNote}</p>
      </div>
    </CompareFrame>
  );
}

function CompareFrame({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-lg bg-white">
      <header className="px-4 pt-4">
        <Link href="/boom" className="inline-flex min-h-11 items-center px-2 text-[16px] text-[#8A8A8E]">
          {text.back}
        </Link>
        <h1 className="px-2 text-[28px] font-semibold tracking-[-0.03em] text-[#171717]">{text.v1.boom}</h1>
      </header>
      <main className="px-5 pt-4 pb-10">{children}</main>
    </div>
  );
}

function MomentColumn({ moment }: { moment: Moment | null }) {
  if (!moment) {
    return <p className="text-[15px] text-[#8A8A8E]">{text.v1.missingMoment}</p>;
  }
  return (
    <article className="border-b border-[#EAEAEA] pb-8">
      <h2 className="text-[22px] leading-tight font-semibold text-[#171717]">{displayTitle(moment)}</h2>
      <div className="mt-4 flex flex-col gap-4">
        {moment.blocks.map((block) =>
          block.type === "text" ? (
            <p key={block.id} className="text-[16px] leading-relaxed whitespace-pre-wrap text-[#171717]">
              {block.text}
            </p>
          ) : (
            <CompareImage key={block.id} assetId={block.assetId} alt={block.alt} />
          ),
        )}
      </div>
    </article>
  );
}

function CompareImage({ assetId, alt }: { assetId: string; alt?: string }) {
  const image = useAssetUrl(assetId, false);
  if (image.missing) {
    return <p className="text-[14px] text-[#8A8A8E]">{text.v1.missingImage}</p>;
  }
  if (!image.url) {
    return <div className="h-40 rounded-[14px] bg-[#EAEAEA]" />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={image.url} alt={alt || text.v1.imageAlt} className="w-full rounded-[14px] object-cover" />
  );
}
