"use client";

import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { BottomNav } from "@/components/navigation/bottom-nav";
import { AddMomentsDialog } from "@/components/space/add-moments-dialog";
import { NameDialog } from "@/components/space/name-dialog";
import { SpaceBadge } from "@/components/space/space-badge";
import { SpaceParentDialog } from "@/components/space/space-parent-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { text } from "@/constants/text";
import { createId } from "@/lib/id";
import { listMoments } from "@/lib/moments";
import { displayTitle, formatWhen, previewText, resolveSpaceIcon, type Moment, type Space, type SpaceIcon } from "@/lib/model";
import {
  childSpaces,
  createSpace,
  deleteSpace,
  getSpace,
  listSpaces,
  momentsInSpace,
  moveSpace,
  renameSpace,
  SpaceCycleError,
} from "@/lib/spaces";
import { queueToast, showToast } from "@/lib/toast";

export function SpaceDetailScreen({ id }: { id: string }) {
  const router = useRouter();
  const unclassified = id === "unclassified";
  const [space, setSpace] = useState<Space | null | undefined>(unclassified ? null : undefined);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [allMoments, setAllMoments] = useState<Moment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [menu, setMenu] = useState<Space | null>(null);
  const [naming, setNaming] = useState<"child" | "rename" | null>(null);
  const [moving, setMoving] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      const [nextSpaces, nextMoments, current] = await Promise.all([
        listSpaces(),
        listMoments(),
        unclassified ? Promise.resolve(null) : getSpace(id),
      ]);
      setSpaces(nextSpaces);
      setAllMoments(nextMoments);
      setSpace(current);
      setError(null);
    } catch {
      setError(text.v1.loadError);
    }
  }, [id, unclassified]);

  useEffect(() => {
    void load();
  }, [load]);

  async function confirmName(name: string, icon: SpaceIcon) {
    const mode = naming;
    if (mode === "child") {
      await createSpace({ id: createId(), name, parentId: id, icon });
    } else if (mode === "rename" && space) {
      await renameSpace(space.id, name, icon);
    } else {
      return;
    }
    setNaming(null);
    showToast(text.v1.saved);
    await load();
  }

  async function confirmMove(parentId: string | null) {
    if (!space) {
      return;
    }
    if (parentId === space.parentId) {
      setMoving(false);
      return;
    }
    try {
      const next = await moveSpace(space.id, parentId);
      setMoving(false);
      setMoveError(null);
      queueToast(text.v1.moved);
      router.push(next.parentId ? `/spaces/${next.parentId}` : "/spaces");
    } catch (caught) {
      setMoveError(caught instanceof SpaceCycleError ? text.v1.cycle : text.v1.saveError);
    }
  }

  async function confirmDelete() {
    setPendingDelete(false);
    if (!space) {
      return;
    }
    try {
      const result = await deleteSpace(space.id);
      router.push(result?.parentId ? `/spaces/${result.parentId}` : "/spaces");
    } catch {
      setError(text.v1.saveError);
    }
  }

  if (!unclassified && space === undefined && !error) {
    return <Status text={text.v1.loading} />;
  }

  if (!unclassified && space === null && !error) {
    return (
      <Status text={text.v1.spaceGone}>
        <Link href="/spaces" className="mt-4 inline-flex min-h-11 items-center text-[15px]">
          {text.v1.backSpaces}
        </Link>
      </Status>
    );
  }

  const directMoments = allMoments ? momentsInSpace(allMoments, unclassified ? null : id) : null;
  const children = unclassified || !space ? [] : childSpaces(spaces, space.id);
  const backHref = space?.parentId ? `/spaces/${space.parentId}` : "/spaces";
  const title = unclassified ? text.v1.unclassified : space?.name ?? "";
  const parentName = space?.parentId ? spaces.find((item) => item.id === space.parentId)?.name ?? null : null;

  return (
    <div className="mx-auto min-h-dvh w-full max-w-lg bg-[#F7F4EF] md:max-w-3xl lg:max-w-5xl">
      <header className="px-5 pt-4">
        <div className="flex items-center justify-between">
          <Link
            href={backHref}
            className="-ml-2 inline-flex min-h-11 items-center rounded-[14px] px-2 text-[16px] text-[#8A8178] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8C7358]"
          >
            {text.back}
          </Link>
          {space ? (
            <button
              type="button"
              aria-label={text.v1.more}
              onClick={() => setMenu(space)}
              className="flex size-11 items-center justify-center rounded-full text-[#8A8178] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8C7358]"
            >
              <MoreHorizontal className="size-5" aria-hidden="true" />
            </button>
          ) : null}
        </div>
        <div className="mt-3 flex items-center gap-3">
          <SpaceBadge icon={space?.icon} />
          <h1 className="min-w-0 truncate text-[28px] font-semibold tracking-[-0.03em] text-[#2C2825]">{title}</h1>
        </div>
      </header>
      <main className="px-5 pt-6 pb-32">
        {error ? <p className="mb-4 text-[14px] text-[#2C2825]">{error}</p> : null}
        {directMoments === null ? <p className="py-16 text-center text-[15px] text-[#8A8178]">{text.v1.loading}</p> : null}
        {space ? (
          <button
            type="button"
            onClick={() => setNaming("child")}
            className="mb-1 inline-flex min-h-11 items-center text-[15px] text-[#8C7358] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8C7358] focus-visible:ring-offset-2"
          >
            {text.v1.createChildSpace}
          </button>
        ) : null}
        {children.length > 0 ? (
          <div className="mb-4 grid grid-cols-1 md:grid-cols-2 md:gap-x-10">
            {children.map((child) => (
              <Link key={child.id} href={`/spaces/${child.id}`} className={spaceRowClass}>
                <SpaceBadge icon={child.icon} />
                <span className="min-w-0">
                  <p className="truncate text-[16px] font-medium text-[#2C2825]">{child.name}</p>
                  <p className="mt-1 truncate text-[13px] text-[#8A8178]">
                    {text.v1.spaceCounts(
                      allMoments ? momentsInSpace(allMoments, child.id).length : 0,
                      childSpaces(spaces, child.id).length,
                    )}
                  </p>
                </span>
              </Link>
            ))}
          </div>
        ) : null}
        {space ? (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mb-1 inline-flex min-h-11 items-center text-[15px] text-[#8C7358] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8C7358] focus-visible:ring-offset-2"
          >
            {text.v1.addExisting}
          </button>
        ) : null}
        {directMoments && directMoments.length > 0 ? (
          <div className="flex flex-col">
            {directMoments.map((moment) => {
              const preview = previewText(moment).replace(/\s+/g, " ").trim();
              return (
                <Link key={moment.id} href={`/moments/${moment.id}`} className={rowLinkClass}>
                  <p className="truncate text-[16px] font-medium text-[#2C2825]">{displayTitle(moment)}</p>
                  {preview ? <p className="mt-1 truncate text-[12px] text-[#6F675F]">{preview}</p> : null}
                  <p className="mt-1 text-[12px] text-[#8A8178]">{formatWhen(moment.createdAt)}</p>
                </Link>
              );
            })}
          </div>
        ) : null}
        {directMoments && directMoments.length === 0 && children.length === 0 ? (
          <p className="py-16 text-center text-[15px] text-[#6F675F]">
            {unclassified ? text.v1.unclassifiedEmpty : text.v1.spaceInsideEmpty}
          </p>
        ) : null}
      </main>
      <BottomNav />
      {adding && space && allMoments ? (
        <AddMomentsDialog
          spaceId={space.id}
          spaceName={space.name}
          moments={allMoments}
          spaces={spaces}
          onCancel={() => setAdding(false)}
          onMoved={() => {
            setAdding(false);
            showToast(text.v1.moved);
            void load();
          }}
          onRefresh={() => void load()}
        />
      ) : null}
      {menu && space ? (
        <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setMenu(null)}>
          <div
            role="menu"
            className="absolute inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] mx-auto max-w-sm rounded-[14px] bg-[#FBF8F4] p-2"
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" role="menuitem" className="flex min-h-11 w-full items-center px-3 text-left text-[16px]" onClick={() => { setNaming("rename"); setMenu(null); }}>
              {text.v1.editSpace}
            </button>
            <button type="button" role="menuitem" className="flex min-h-11 w-full items-center px-3 text-left text-[16px]" onClick={() => { setMoveError(null); setMoving(true); setMenu(null); }}>
              {text.v1.move}
            </button>
            <button type="button" role="menuitem" className="flex min-h-11 w-full items-center px-3 text-left text-[16px]" onClick={() => { setPendingDelete(true); setMenu(null); }}>
              {text.v1.delete}
            </button>
            <button type="button" className="flex min-h-11 w-full items-center px-3 text-left text-[16px] text-[#8A8178]" onClick={() => setMenu(null)}>
              {text.v1.cancel}
            </button>
          </div>
        </div>
      ) : null}
      {naming ? (
        <NameDialog
          title={naming === "child" ? text.v1.createChildSpace : text.v1.editSpace}
          initial={naming === "rename" ? space?.name ?? "" : ""}
          initialIcon={naming === "rename" ? resolveSpaceIcon(space?.icon) : undefined}
          hint={naming === "child" ? text.v1.spaceIconCreateHint : text.v1.spaceIconEditHint}
          confirmLabel={naming === "child" ? text.v1.createAction : text.v1.save}
          onCancel={() => setNaming(null)}
          onConfirm={confirmName}
        />
      ) : null}
      {moving && space ? (
        <SpaceParentDialog
          spaces={spaces}
          space={space}
          error={moveError}
          onCancel={() => setMoving(false)}
          onSelect={(parentId) => void confirmMove(parentId)}
        />
      ) : null}
      {pendingDelete && space ? (
        <ConfirmDialog
          title={text.v1.deleteSpaceTitle}
          body={text.v1.deleteSpaceBody(space.name, children.length, directMoments?.length ?? 0, parentName)}
          confirmLabel={text.v1.delete}
          cancelLabel={text.v1.cancel}
          onCancel={() => setPendingDelete(false)}
          onConfirm={() => void confirmDelete()}
        />
      ) : null}
    </div>
  );
}

const rowLinkClass =
  "block min-w-0 border-b border-[#E7E0D6] py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8C7358] focus-visible:ring-offset-2 active:bg-[#EFE8DF]";

const spaceRowClass =
  "flex min-w-0 items-center gap-3 border-b border-[#E7E0D6] py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8C7358] focus-visible:ring-offset-2 active:bg-[#EFE8DF]";

function Status({ text: message, children }: { text: string; children?: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col items-center justify-center bg-[#F7F4EF] px-6 text-center md:max-w-3xl lg:max-w-5xl">
      <p className="text-[16px] text-[#2C2825]">{message}</p>
      {children}
      <BottomNav />
    </div>
  );
}
