"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ImageViewer } from "@/components/moment/image-viewer";
import { useAssetUrl } from "@/components/moment/use-asset-url";
import { BottomNav } from "@/components/navigation/bottom-nav";
import { MomentSpaceDialog } from "@/components/space/moment-space-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { text } from "@/constants/text";
import { deleteLink, relatedMoments } from "@/lib/boom";
import { countLinks, deleteMoment, getMoment, moveMoment } from "@/lib/moments";
import { deliverFiles, renderMomentFiles } from "@/lib/share-image";
import { displayTitle, previewText, formatWhen, type BoomLink, type ContentBlock, type Moment, type Space } from "@/lib/model";
import { getSpace, listSpaces } from "@/lib/spaces";

export function MomentDetail({ id }: { id: string }) {
  const router = useRouter();
  const [moment, setMoment] = useState<Moment | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [viewer, setViewer] = useState<Extract<ContentBlock, { type: "image" }> | null>(null);
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);
  const [moving, setMoving] = useState(false);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [spaceName, setSpaceName] = useState<string | undefined>(undefined);
  const [related, setRelated] = useState<{ link: BoomLink; moment: Moment | null }[] | null>(null);
  const [pendingUnlink, setPendingUnlink] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareNote, setShareNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getMoment(id)
      .then(async (next) => {
        if (cancelled) {
          return;
        }
        setMoment(next);
        if (!next?.spaceId) {
          if (!cancelled) {
            setSpaceName(text.v1.unclassified);
          }
          return;
        }
        const space = await getSpace(next.spaceId);
        if (!cancelled) {
          setSpaceName(space?.name ?? text.v1.unclassified);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(text.v1.loadError);
        }
      });
    void relatedMoments(id)
      .then((rows) => {
        if (!cancelled) {
          setRelated(rows);
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

  async function openMove() {
    try {
      setSpaces(await listSpaces());
      setMoving(true);
    } catch {
      setError(text.v1.loadError);
    }
  }

  async function confirmMove(spaceId: string | null) {
    setMoving(false);
    try {
      const next = await moveMoment(id, spaceId);
      setMoment(next);
      setSpaceName(next.spaceId ? (await getSpace(next.spaceId))?.name ?? text.v1.unclassified : text.v1.unclassified);
    } catch {
      setError(text.v1.saveError);
    }
  }

  async function confirmUnlink() {
    const linkId = pendingUnlink;
    setPendingUnlink(null);
    if (!linkId) {
      return;
    }
    try {
      await deleteLink(linkId);
      setRelated(await relatedMoments(id));
    } catch {
      setError(text.v1.saveError);
    }
  }

  async function shareMoment() {
    if (!moment || sharing) {
      return;
    }
    setSharing(true);
    setShareNote(null);
    setError(null);
    try {
      const files = await renderMomentFiles(moment);
      const result = await deliverFiles(files);
      if (result === "saved") {
        setShareNote(text.v1.shareSaved);
      }
    } catch {
      setError(text.v1.shareError);
    } finally {
      setSharing(false);
    }
  }

  async function askDelete() {
    try {
      setPendingDelete(await countLinks(id));
    } catch {
      setError(text.v1.loadError);
    }
  }

  async function confirmDelete() {
    setPendingDelete(null);
    try {
      await deleteMoment(id);
      router.push("/");
    } catch {
      setError(text.v1.saveError);
    }
  }

  if (error && !moment) {
    return (
      <Centered>
        <p className="text-[15px] text-[#8A8A8E]">{error}</p>
        <Link href="/" className="mt-4 inline-flex min-h-11 items-center text-[15px]">
          {text.v1.backHome}
        </Link>
      </Centered>
    );
  }

  if (moment === undefined) {
    return (
      <Centered>
        <p className="text-[15px] text-[#8A8A8E]">{text.v1.loading}</p>
      </Centered>
    );
  }

  if (!moment) {
    return (
      <Centered>
        <p className="text-[16px] text-[#171717]">{text.v1.missing}</p>
        <Link href="/" className="mt-4 inline-flex min-h-11 items-center text-[15px]">
          {text.v1.backHome}
        </Link>
      </Centered>
    );
  }

  const title = moment.title?.trim();
  const hasText = moment.blocks.some((block) => block.type === "text" && block.text.trim());

  return (
    <div className="mx-auto min-h-dvh w-full max-w-lg bg-white">
      <header className="flex flex-wrap items-center gap-x-1 px-4 pt-4">
        <button type="button" onClick={() => router.back()} className="mr-auto min-h-11 px-2 text-[16px] text-[#8A8A8E]">
          {text.back}
        </button>
        <div className="flex flex-wrap items-center justify-end">
          <button
            type="button"
            onClick={() => void shareMoment()}
            disabled={sharing}
            className="inline-flex min-h-11 items-center px-3 text-[15px] text-[#171717] disabled:text-[#8A8A8E]"
          >
            {sharing ? text.v1.sharing : text.v1.share}
          </button>
          <Link href={`/moments/${moment.id}/edit`} className="inline-flex min-h-11 items-center px-3 text-[15px] text-[#171717]">
            {text.v1.edit}
          </Link>
          <button type="button" onClick={() => void openMove()} className="inline-flex min-h-11 items-center px-3 text-[15px] text-[#171717]">
            {text.v1.move}
          </button>
          <button type="button" onClick={() => void askDelete()} className="inline-flex min-h-11 items-center px-3 text-[15px] text-[#171717]">
            {text.v1.delete}
          </button>
        </div>
      </header>
      <main className="px-5 pt-4 pb-32">
        {title || !hasText ? (
          <h1 className="text-[32px] leading-tight font-semibold tracking-[-0.03em] text-[#171717]">
            {title || displayTitle(moment)}
          </h1>
        ) : null}
        <p className="mt-2 text-[13px] text-[#8A8A8E]">
          {formatWhen(moment.updatedAt)}
          {spaceName ? ` · ${spaceName}` : ""}
        </p>
        <div className="mt-8 flex flex-col gap-5">
          {moment.blocks.map((block) =>
            block.type === "text" ? (
              <p key={block.id} className="text-[17px] leading-relaxed whitespace-pre-wrap text-[#171717]">
                {block.text}
              </p>
            ) : (
              <DetailImage key={block.id} assetId={block.assetId} alt={block.alt} onOpen={() => setViewer(block)} />
            ),
          )}
        </div>
        <section className="mt-10">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[18px] font-semibold text-[#171717]">{text.v1.related}</h2>
            <Link href={`/boom?with=${moment.id}`} className="inline-flex min-h-11 items-center text-[14px] text-[#171717]">
              {text.v1.boomWith}
            </Link>
          </div>
          {related && related.length === 0 ? (
            <p className="py-4 text-[15px] text-[#8A8A8E]">{text.v1.relatedEmpty}</p>
          ) : null}
          {related?.map((row) => (
            <div key={row.link.id} className="border-b border-[#EAEAEA] py-2">
              {row.moment ? (
                <Link href={`/moments/${row.moment.id}`} className="block py-1">
                  <p className="truncate text-[16px] font-medium text-[#171717]">{displayTitle(row.moment)}</p>
                  {previewText(row.moment) ? (
                    <p className="mt-1 line-clamp-2 text-[14px] text-[#8A8A8E]">{previewText(row.moment)}</p>
                  ) : null}
                </Link>
              ) : (
                <p className="py-2 text-[15px] text-[#8A8A8E]">{text.v1.missingMoment}</p>
              )}
              <button
                type="button"
                onClick={() => setPendingUnlink(row.link.id)}
                className="min-h-11 text-[14px] text-[#8A8A8E]"
              >
                {text.v1.unlink}
              </button>
            </div>
          ))}
        </section>
        {shareNote ? <p className="mt-6 text-[14px] text-[#171717]">{shareNote}</p> : null}
        {error ? <p className="mt-6 text-[14px] text-[#171717]">{error}</p> : null}
      </main>
      {viewer ? null : <BottomNav />}
      {viewer ? <ViewerGate block={viewer} onClose={() => setViewer(null)} /> : null}
      {moving ? (
        <MomentSpaceDialog
          spaces={spaces}
          currentId={moment.spaceId}
          onCancel={() => setMoving(false)}
          onSelect={(spaceId) => void confirmMove(spaceId)}
        />
      ) : null}
      {pendingUnlink ? (
        <ConfirmDialog
          title={text.v1.unlinkTitle}
          body={text.v1.unlinkBody}
          confirmLabel={text.v1.unlink}
          cancelLabel={text.v1.cancel}
          onCancel={() => setPendingUnlink(null)}
          onConfirm={() => void confirmUnlink()}
        />
      ) : null}
      {pendingDelete !== null ? (
        <ConfirmDialog
          title={text.v1.deleteTitle}
          body={text.v1.deleteBody(pendingDelete)}
          confirmLabel={text.v1.delete}
          cancelLabel={text.v1.cancel}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void confirmDelete()}
        />
      ) : null}
    </div>
  );
}

function DetailImage({ assetId, alt, onOpen }: { assetId: string; alt?: string; onOpen: () => void }) {
  const image = useAssetUrl(assetId, false);
  if (image.missing) {
    return <p className="text-[14px] text-[#8A8A8E]">{text.v1.missingImage}</p>;
  }
  if (!image.url) {
    return <div className="h-40 rounded-[14px] bg-[#EAEAEA]" />;
  }
  return (
    <button type="button" onClick={onOpen} className="block w-full text-left">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image.url} alt={alt || text.v1.imageAlt} className="w-full rounded-[14px] object-cover" />
    </button>
  );
}

function ViewerGate({
  block,
  onClose,
}: {
  block: Extract<ContentBlock, { type: "image" }>;
  onClose: () => void;
}) {
  const image = useAssetUrl(block.assetId, false);
  if (!image.url) {
    return null;
  }
  return <ImageViewer url={image.url} alt={block.alt} onClose={onClose} />;
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col items-center justify-center px-6 text-center">
      {children}
      <BottomNav />
    </div>
  );
}
