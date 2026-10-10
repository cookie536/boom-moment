"use client";

import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { BottomNav } from "@/components/navigation/bottom-nav";
import { AddMomentsDialog } from "@/components/space/add-moments-dialog";
import { NameDialog } from "@/components/space/name-dialog";
import { SpaceParentDialog } from "@/components/space/space-parent-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { text } from "@/constants/text";
import { StorageQuotaError } from "@/lib/db";
import { createId } from "@/lib/id";
import { listMoments } from "@/lib/moments";
import { displayTitle, formatWhen, type Moment, type Space } from "@/lib/model";
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

  async function confirmName(name: string) {
    const mode = naming;
    setNaming(null);
    try {
      if (mode === "child") {
        await createSpace({ id: createId(), name, parentId: id });
      } else if (mode === "rename" && space) {
        await renameSpace(space.id, name);
      }
      await load();
    } catch (caught) {
      setError(caught instanceof StorageQuotaError ? text.v1.quota : text.v1.saveError);
    }
  }

  async function confirmMove(parentId: string | null) {
    setMoving(false);
    if (!space) {
      return;
    }
    try {
      const next = await moveSpace(space.id, parentId);
      if (next.parentId) {
        router.push(`/spaces/${next.parentId}`);
        return;
      }
      router.push("/spaces");
    } catch (caught) {
      setError(caught instanceof SpaceCycleError ? text.v1.cycle : text.v1.saveError);
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
    <div className="mx-auto min-h-dvh w-full max-w-lg bg-white">
      <header className="px-4 pt-4">
        <div className="flex items-center justify-between">
          <Link href={backHref} className="inline-flex min-h-11 items-center px-2 text-[16px] text-[#8A8A8E]">
            {text.back}
          </Link>
          {space ? (
            <button
              type="button"
              aria-label={text.v1.more}
              onClick={() => setMenu(space)}
              className="flex size-11 items-center justify-center text-[#8A8A8E]"
            >
              <MoreHorizontal className="size-5" aria-hidden="true" />
            </button>
          ) : null}
        </div>
        <h1 className="px-2 text-[28px] font-semibold tracking-[-0.03em] text-[#171717]">{title}</h1>
      </header>
      <main className="px-5 pt-4 pb-32">
        {error ? <p className="mb-4 text-[14px] text-[#171717]">{error}</p> : null}
        {directMoments === null ? <p className="py-16 text-center text-[15px] text-[#8A8A8E]">{text.v1.loading}</p> : null}
        {space ? (
          <button
            type="button"
            onClick={() => setNaming("child")}
            className="mb-4 inline-flex min-h-11 items-center rounded-[14px] border border-[#EAEAEA] px-4 text-[15px] text-[#171717]"
          >
            {text.v1.createChildSpace}
          </button>
        ) : null}
        {children.map((child) => (
          <Link key={child.id} href={`/spaces/${child.id}`} className="block border-b border-[#EAEAEA] py-3">
            <p className="text-[16px] font-medium text-[#171717]">{child.name}</p>
            <p className="mt-1 text-[13px] text-[#8A8A8E]">
              {text.v1.spaceCounts(
                allMoments ? momentsInSpace(allMoments, child.id).length : 0,
                childSpaces(spaces, child.id).length,
              )}
            </p>
          </Link>
        ))}
        {space ? (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mt-2 mb-2 inline-flex min-h-11 items-center rounded-[14px] border border-[#EAEAEA] px-4 text-[15px] text-[#171717]"
          >
            {text.v1.addExisting}
          </button>
        ) : null}
        {directMoments?.map((moment) => (
          <Link key={moment.id} href={`/moments/${moment.id}`} className="block border-b border-[#EAEAEA] py-3">
            <p className="truncate text-[16px] font-medium text-[#171717]">{displayTitle(moment)}</p>
            <p className="mt-1 text-[12px] text-[#8A8A8E]">{formatWhen(moment.updatedAt)}</p>
          </Link>
        ))}
        {directMoments && directMoments.length === 0 && children.length === 0 ? (
          <p className="py-16 text-center text-[15px] text-[#8A8A8E]">
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
            void load();
          }}
          onRefresh={() => void load()}
        />
      ) : null}
      {menu && space ? (
        <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setMenu(null)}>
          <div
            role="menu"
            className="absolute inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] mx-auto max-w-sm rounded-[14px] bg-white p-2"
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" role="menuitem" className="flex min-h-11 w-full items-center px-3 text-left text-[16px]" onClick={() => { setNaming("rename"); setMenu(null); }}>
              {text.v1.rename}
            </button>
            <button type="button" role="menuitem" className="flex min-h-11 w-full items-center px-3 text-left text-[16px]" onClick={() => { setMoving(true); setMenu(null); }}>
              {text.v1.move}
            </button>
            <button type="button" role="menuitem" className="flex min-h-11 w-full items-center px-3 text-left text-[16px]" onClick={() => { setPendingDelete(true); setMenu(null); }}>
              {text.v1.delete}
            </button>
            <button type="button" className="flex min-h-11 w-full items-center px-3 text-left text-[16px] text-[#8A8A8E]" onClick={() => setMenu(null)}>
              {text.v1.cancel}
            </button>
          </div>
        </div>
      ) : null}
      {naming ? (
        <NameDialog
          title={naming === "child" ? text.v1.createChildSpace : text.v1.rename}
          initial={naming === "rename" ? space?.name ?? "" : ""}
          onCancel={() => setNaming(null)}
          onConfirm={(name) => void confirmName(name)}
        />
      ) : null}
      {moving && space ? (
        <SpaceParentDialog spaces={spaces} space={space} onCancel={() => setMoving(false)} onSelect={(parentId) => void confirmMove(parentId)} />
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

function Status({ text: message, children }: { text: string; children?: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col items-center justify-center px-6 text-center">
      <p className="text-[16px] text-[#171717]">{message}</p>
      {children}
      <BottomNav />
    </div>
  );
}
