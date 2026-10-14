"use client";

import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ImageGroup } from "@/components/moment/image-strip";
import { MomentSpaceDialog } from "@/components/space/moment-space-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { text } from "@/constants/text";
import { boomsFor, deleteBoom, deleteLink, relatedMoments } from "@/lib/boom";
import { countBooms, countLinks, deleteMoment, getMoment, moveMoment } from "@/lib/moments";
import { deliverFiles, renderMomentFiles } from "@/lib/share-image";
import { displayTitle, previewText, formatWhen, type Boom, type BoomLink, type ContentBlock, type Moment, type Space } from "@/lib/model";
import { getSpace, listSpaces } from "@/lib/spaces";
import { showToast } from "@/lib/toast";

export function MomentDetail({
  id,
  onBack,
  passive = false,
}: {
  id: string;
  onBack?: () => void;
  passive?: boolean;
}) {
  const router = useRouter();
  const [moment, setMoment] = useState<Moment | null | undefined>(undefined);
  const [menu, setMenu] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ links: number; booms: number } | null>(null);
  const [moving, setMoving] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [spaceName, setSpaceName] = useState<string | undefined>(undefined);
  const [related, setRelated] = useState<{ link: BoomLink; moment: Moment | null }[] | null>(null);
  const [booms, setBooms] = useState<Array<{ boom: Boom; moments: Array<Moment | null> }> | null>(null);
  const [pendingUnlink, setPendingUnlink] = useState<string | null>(null);
  const [pendingBoom, setPendingBoom] = useState<string | null>(null);
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
    void loadBooms(id)
      .then((rows) => {
        if (!cancelled) {
          setBooms(rows);
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
    setMoveError(null);
    try {
      setSpaces(await listSpaces());
      setMoving(true);
    } catch {
      setError(text.v1.loadError);
    }
  }

  async function confirmMove(spaceId: string | null) {
    if (spaceId === (moment?.spaceId ?? null)) {
      setMoving(false);
      return;
    }
    try {
      const next = await moveMoment(id, spaceId);
      setMoment(next);
      setSpaceName(next.spaceId ? (await getSpace(next.spaceId))?.name ?? text.v1.unclassified : text.v1.unclassified);
      setMoving(false);
      setMoveError(null);
      showToast(text.v1.moved);
    } catch {
      setMoveError(text.v1.saveError);
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

  async function confirmRemoveBoom() {
    const boomId = pendingBoom;
    setPendingBoom(null);
    if (!boomId) {
      return;
    }
    try {
      await deleteBoom(boomId);
      setBooms(await loadBooms(id));
    } catch {
      setError(text.v1.saveError);
    }
  }

  async function askDelete() {
    try {
      const [links, boomsForMoment] = await Promise.all([countLinks(id), countBooms(id)]);
      setPendingDelete({ links, booms: boomsForMoment });
    } catch {
      setError(text.v1.loadError);
    }
  }

  async function confirmDelete() {
    setPendingDelete(null);
    try {
      await deleteMoment(id);
      window.dispatchEvent(new Event("reading-close"));
      window.dispatchEvent(new Event("moments-changed"));
      router.push("/");
    } catch {
      setError(text.v1.saveError);
    }
  }

  if (error && !moment) {
    return (
      <Centered>
        <p className="text-[15px] text-[#8A8178]">{error}</p>
        <button type="button" onClick={onBack} className="mt-4 inline-flex min-h-11 items-center text-[15px]">
          {text.back}
        </button>
      </Centered>
    );
  }

  if (moment === undefined) {
    return (
      <Centered>
        <p className="text-[15px] text-[#8A8178]">{text.v1.loading}</p>
        <button type="button" onClick={onBack} className="mt-4 inline-flex min-h-11 items-center text-[15px]">
          {text.back}
        </button>
      </Centered>
    );
  }

  if (!moment) {
    return (
      <Centered>
        <p className="text-[16px] text-[#2C2825]">{text.v1.missing}</p>
        <button type="button" onClick={onBack} className="mt-4 inline-flex min-h-11 items-center text-[15px]">
          {text.back}
        </button>
      </Centered>
    );
  }

  const title = moment.title?.trim();
  const hasText = moment.blocks.some((block) => block.type === "text" && block.text.trim());

  return (
    <div className="mx-auto min-h-dvh w-full max-w-lg bg-[#F7F4EF]">
      <header className="flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button type="button" onClick={() => onBack?.()} className="min-h-11 px-2 text-[16px] text-[#8A8178]">
          {text.back}
        </button>
        {passive ? null : (
          <button
            type="button"
            aria-label={text.v1.more}
            onClick={() => setMenu(true)}
            className="flex size-11 items-center justify-center text-[#8A8178]"
          >
            <MoreHorizontal className="size-5" aria-hidden="true" />
          </button>
        )}
      </header>
      <main className="px-5 pt-6 pb-16">
        {title || !hasText ? (
          <h1 className="text-[32px] leading-tight font-semibold tracking-[-0.03em] text-[#2C2825]">
            {title || displayTitle(moment)}
          </h1>
        ) : null}
        <p className="mt-3 text-[13px] text-[#8A8178]">
          {formatWhen(moment.updatedAt)}
          {spaceName ? ` · ${spaceName}` : ""}
        </p>
        <div className="mt-8 flex flex-col gap-6">
          {contentSegments(moment.blocks).map((segment) =>
            segment.type === "text" ? (
              <p key={segment.block.id} className="text-[16px] leading-[28px] whitespace-pre-wrap text-[#2C2825]">
                {segment.block.text}
              </p>
            ) : (
              <ImageGroup key={segment.blocks.map((block) => block.id).join("-")} blocks={segment.blocks} />
            ),
          )}
        </div>
        <section className="mt-12">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[13px] font-medium tracking-[0.04em] text-[#8C7358]">{text.v1.boomEvents}</h2>
            <Link href={`/boom?with=${moment.id}`} className="inline-flex min-h-11 items-center text-[14px] text-[#2C2825]">
              {text.v1.boomWith}
            </Link>
          </div>
          {booms && booms.length === 0 ? (
            <p className="py-4 text-[15px] text-[#8A8178]">{text.v1.boomForMomentEmpty}</p>
          ) : null}
          {booms?.map((row) => (
            <div key={row.boom.id} className="border-b border-[#E7E0D6] py-3">
              <p className="text-[12px] tracking-[0.04em] text-[#8A8178]">{text.v1.boomSources}</p>
              {row.boom.sourceMomentIds.map((sourceId, index) => (
                <ParticipantLink key={sourceId} moment={row.moments[index] ?? null} currentId={moment.id} />
              ))}
              {row.boom.resultMomentId ? (
                <>
                  <p className="mt-2 text-[12px] tracking-[0.04em] text-[#8A8178]">{text.v1.boomResult}</p>
                  <ParticipantLink
                    moment={row.moments[row.boom.sourceMomentIds.length] ?? null}
                    currentId={moment.id}
                  />
                </>
              ) : null}
              <Link href={`/boom/${row.boom.id}`} className="inline-flex min-h-11 items-center text-[14px] text-[#2C2825]">
                {text.v1.viewBoom}
              </Link>
              <button
                type="button"
                onClick={() => setPendingBoom(row.boom.id)}
                className="min-h-11 px-3 text-[14px] text-[#8A8178]"
              >
                {text.v1.removeBoom}
              </button>
            </div>
          ))}
        </section>
        <section className="mt-12">
          <h2 className="text-[13px] font-medium tracking-[0.04em] text-[#8C7358]">{text.v1.related}</h2>
          {related && related.length === 0 ? (
            <p className="py-4 text-[15px] text-[#8A8178]">{text.v1.relatedEmpty}</p>
          ) : null}
          {related?.map((row) => (
            <div key={row.link.id} className="border-b border-[#E7E0D6] py-2">
              {row.moment ? (
                <Link href={`/moments/${row.moment.id}`} className="block py-1">
                  <p className="truncate text-[16px] font-medium text-[#2C2825]">{displayTitle(row.moment)}</p>
                  {previewText(row.moment) ? (
                    <p className="mt-1 line-clamp-2 text-[14px] text-[#8A8178]">{previewText(row.moment)}</p>
                  ) : null}
                </Link>
              ) : (
                <p className="py-2 text-[15px] text-[#8A8178]">{text.v1.missingMoment}</p>
              )}
              <button
                type="button"
                onClick={() => setPendingUnlink(row.link.id)}
                className="min-h-11 text-[14px] text-[#8A8178]"
              >
                {text.v1.unlink}
              </button>
            </div>
          ))}
        </section>
        {shareNote ? <p className="mt-6 text-[14px] text-[#2C2825]">{shareNote}</p> : null}
        {error ? <p className="mt-6 text-[14px] text-[#2C2825]">{error}</p> : null}
      </main>
      {overlay(
        menu ? (
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setMenu(false)}>
            <div
              role="menu"
              className="absolute inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] mx-auto max-w-sm rounded-[14px] bg-[#FBF8F4] p-2"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                role="menuitem"
                disabled={sharing}
                className="flex min-h-11 w-full items-center px-3 text-left text-[16px] disabled:text-[#8A8178]"
                onClick={() => {
                  setMenu(false);
                  void shareMoment();
                }}
              >
                {sharing ? text.v1.sharing : text.v1.share}
              </button>
              <Link href={`/moments/${moment.id}/edit`} role="menuitem" className="flex min-h-11 w-full items-center px-3 text-[16px]">
                {text.v1.edit}
              </Link>
              <button type="button" role="menuitem" className="flex min-h-11 w-full items-center px-3 text-left text-[16px]" onClick={() => { setMenu(false); void openMove(); }}>
                {text.v1.move}
              </button>
              <button type="button" role="menuitem" className="flex min-h-11 w-full items-center px-3 text-left text-[16px]" onClick={() => { setMenu(false); void askDelete(); }}>
                {text.v1.delete}
              </button>
              <button type="button" className="flex min-h-11 w-full items-center px-3 text-left text-[16px] text-[#8A8178]" onClick={() => setMenu(false)}>
                {text.v1.cancel}
              </button>
            </div>
          </div>
        ) : null,
      )}
      {overlay(
        moving ? (
        <MomentSpaceDialog
          spaces={spaces}
          currentId={moment.spaceId}
          error={moveError}
          onCancel={() => setMoving(false)}
          onSelect={(spaceId) => void confirmMove(spaceId)}
        />
      ) : null,
      )}
      {overlay(
        pendingUnlink ? (
        <ConfirmDialog
          title={text.v1.unlinkTitle}
          body={text.v1.unlinkBody}
          confirmLabel={text.v1.unlink}
          cancelLabel={text.v1.cancel}
          onCancel={() => setPendingUnlink(null)}
          onConfirm={() => void confirmUnlink()}
        />
      ) : null,
      )}
      {overlay(
        pendingBoom ? (
        <ConfirmDialog
          title={text.v1.removeBoomTitle}
          body={text.v1.removeBoomBody}
          confirmLabel={text.v1.removeBoom}
          cancelLabel={text.v1.cancel}
          onCancel={() => setPendingBoom(null)}
          onConfirm={() => void confirmRemoveBoom()}
        />
      ) : null,
      )}
      {overlay(
        pendingDelete !== null ? (
        <ConfirmDialog
          title={text.v1.deleteTitle}
          body={text.v1.deleteBody(pendingDelete.links, pendingDelete.booms)}
          confirmLabel={text.v1.delete}
          cancelLabel={text.v1.cancel}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void confirmDelete()}
        />
      ) : null,
      )}
    </div>
  );
}

function contentSegments(blocks: ContentBlock[]) {
  const segments: Array<
    | { type: "text"; block: Extract<ContentBlock, { type: "text" }> }
    | { type: "images"; blocks: Extract<ContentBlock, { type: "image" }>[] }
  > = [];
  for (const block of blocks) {
    if (block.type === "image") {
      const last = segments[segments.length - 1];
      if (last?.type === "images") {
        last.blocks.push(block);
      } else {
        segments.push({ type: "images", blocks: [block] });
      }
    } else {
      segments.push({ type: "text", block });
    }
  }
  return segments;
}

function overlay(node: ReactNode) {
  if (!node || typeof document === "undefined") {
    return null;
  }
  return createPortal(node, document.body);
}

async function loadBooms(momentId: string) {
  const rows = await boomsFor(momentId);
  return Promise.all(
    rows.map(async (boom) => {
      const ids = boom.resultMomentId ? [...boom.sourceMomentIds, boom.resultMomentId] : boom.sourceMomentIds;
      const moments = await Promise.all(ids.map((item) => getMoment(item)));
      return { boom, moments };
    }),
  );
}

function ParticipantLink({ moment, currentId }: { moment: Moment | null; currentId: string }) {
  if (!moment) {
    return <p className="py-2 text-[15px] text-[#8A8178]">{text.v1.missingMoment}</p>;
  }
  if (moment.id === currentId) {
    return <p className="py-2 text-[16px] font-medium text-[#2C2825]">{displayTitle(moment)}</p>;
  }
  return (
    <Link href={`/moments/${moment.id}`} className="block py-2">
      <p className="truncate text-[16px] font-medium text-[#2C2825]">{displayTitle(moment)}</p>
      {previewText(moment) ? <p className="mt-1 line-clamp-1 text-[12px] text-[#6F675F]">{previewText(moment)}</p> : null}
    </Link>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-lg flex-col items-center justify-center px-6 py-16 text-center">
      {children}
    </div>
  );
}
