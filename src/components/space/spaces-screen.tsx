"use client";

import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BottomNav } from "@/components/navigation/bottom-nav";
import { NameDialog } from "@/components/space/name-dialog";
import { SpaceParentDialog } from "@/components/space/space-parent-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { text } from "@/constants/text";
import { StorageQuotaError } from "@/lib/db";
import { createId } from "@/lib/id";
import { listMoments } from "@/lib/moments";
import type { Moment, Space } from "@/lib/model";
import {
  childSpaces,
  createSpace,
  deleteSpace,
  listSpaces,
  momentsInSpace,
  moveSpace,
  renameSpace,
  rootSpaces,
  SpaceCycleError,
} from "@/lib/spaces";

type NameRequest = { mode: "create" } | { mode: "rename"; space: Space };

export function SpacesScreen() {
  const [spaces, setSpaces] = useState<Space[] | null>(null);
  const [moments, setMoments] = useState<Moment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [menu, setMenu] = useState<Space | null>(null);
  const [naming, setNaming] = useState<NameRequest | null>(null);
  const [moving, setMoving] = useState<Space | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Space | null>(null);

  const load = useCallback(async () => {
    try {
      const [nextSpaces, nextMoments] = await Promise.all([listSpaces(), listMoments()]);
      setSpaces(nextSpaces);
      setMoments(nextMoments);
      setError(null);
    } catch {
      setError(text.v1.loadError);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function confirmName(name: string) {
    const request = naming;
    setNaming(null);
    if (!request) {
      return;
    }
    try {
      if (request.mode === "create") {
        await createSpace({ id: createId(), name, parentId: null });
      } else {
        await renameSpace(request.space.id, name);
      }
      await load();
    } catch (caught) {
      setError(caught instanceof StorageQuotaError ? text.v1.quota : text.v1.saveError);
    }
  }

  async function confirmMove(parentId: string | null) {
    const space = moving;
    setMoving(null);
    if (!space) {
      return;
    }
    try {
      await moveSpace(space.id, parentId);
      await load();
    } catch (caught) {
      setError(caught instanceof SpaceCycleError ? text.v1.cycle : text.v1.saveError);
    }
  }

  async function confirmDelete() {
    const space = pendingDelete;
    setPendingDelete(null);
    if (!space) {
      return;
    }
    try {
      await deleteSpace(space.id);
      await load();
    } catch {
      setError(text.v1.saveError);
    }
  }

  const roots = spaces ? rootSpaces(spaces) : [];
  const unclassified = momentsInSpace(moments, null);
  const empty = spaces !== null && roots.length === 0 && unclassified.length === 0;

  return (
    <div className="mx-auto min-h-dvh w-full max-w-lg bg-white">
      <header className="flex items-center justify-between gap-3 px-5 pt-6">
        <h1 className="text-[28px] font-semibold tracking-[-0.03em] text-[#171717]">{text.v1.spaces}</h1>
        <button
          type="button"
          onClick={() => setNaming({ mode: "create" })}
          className="min-h-11 rounded-[14px] bg-[#171717] px-4 text-[15px] text-white"
        >
          {text.v1.createSpace}
        </button>
      </header>
      <main className="px-5 pt-4 pb-32">
        {error ? <p className="mb-4 text-[14px] text-[#171717]">{error}</p> : null}
        {spaces === null && !error ? (
          <p className="py-16 text-center text-[15px] text-[#8A8A8E]">{text.v1.loading}</p>
        ) : null}
        {empty ? (
          <div className="py-20 text-center">
            <p className="text-[16px] text-[#8A8A8E]">{text.v1.spaceEmpty}</p>
            <button
              type="button"
              onClick={() => setNaming({ mode: "create" })}
              className="mt-6 inline-flex min-h-11 items-center rounded-[14px] bg-[#171717] px-5 text-[15px] text-white"
            >
              {text.v1.spaceEmptyAction}
            </button>
          </div>
        ) : null}
        {spaces && !empty ? (
          <div>
            {roots.map((space) => (
              <SpaceRow
                key={space.id}
                space={space}
                detail={text.v1.spaceCounts(
                  momentsInSpace(moments, space.id).length,
                  childSpaces(spaces, space.id).length,
                )}
                onMenu={setMenu}
              />
            ))}
            {unclassified.length > 0 || roots.length > 0 ? (
              <Link href="/spaces/unclassified" className="block border-b border-[#EAEAEA] py-3">
                <p className="text-[16px] font-medium text-[#171717]">{text.v1.unclassified}</p>
                <p className="mt-1 text-[13px] text-[#8A8A8E]">{text.v1.momentCount(unclassified.length)}</p>
              </Link>
            ) : null}
          </div>
        ) : null}
      </main>
      <BottomNav />
      {menu ? (
        <SpaceMenu
          onRename={() => {
            setNaming({ mode: "rename", space: menu });
            setMenu(null);
          }}
          onMove={() => {
            setMoving(menu);
            setMenu(null);
          }}
          onDelete={() => {
            setPendingDelete(menu);
            setMenu(null);
          }}
          onClose={() => setMenu(null)}
        />
      ) : null}
      {naming ? (
        <NameDialog
          title={naming.mode === "create" ? text.v1.createSpace : text.v1.rename}
          initial={naming.mode === "rename" ? naming.space.name : ""}
          onCancel={() => setNaming(null)}
          onConfirm={(name) => void confirmName(name)}
        />
      ) : null}
      {moving && spaces ? (
        <SpaceParentDialog spaces={spaces} space={moving} onCancel={() => setMoving(null)} onSelect={(parentId) => void confirmMove(parentId)} />
      ) : null}
      {pendingDelete ? (
        <ConfirmDialog
          title={text.v1.deleteSpaceTitle}
          body={text.v1.deleteSpaceBody(
            pendingDelete.name,
            childSpaces(spaces ?? [], pendingDelete.id).length,
            momentsInSpace(moments, pendingDelete.id).length,
            spaces?.find((space) => space.id === pendingDelete.parentId)?.name ?? null,
          )}
          confirmLabel={text.v1.delete}
          cancelLabel={text.v1.cancel}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void confirmDelete()}
        />
      ) : null}
    </div>
  );
}

function SpaceRow({ space, detail, onMenu }: { space: Space; detail: string; onMenu: (space: Space) => void }) {
  return (
    <article className="relative border-b border-[#EAEAEA]">
      <Link href={`/spaces/${space.id}`} className="block py-3 pr-12">
        <h2 className="truncate text-[16px] font-medium text-[#171717]">{space.name}</h2>
        {detail ? <p className="mt-1 text-[13px] text-[#8A8A8E]">{detail}</p> : null}
      </Link>
      <button
        type="button"
        aria-label={text.v1.more}
        onClick={() => onMenu(space)}
        className="absolute top-1/2 right-0 flex size-11 -translate-y-1/2 items-center justify-center text-[#8A8A8E]"
      >
        <MoreHorizontal className="size-5" aria-hidden="true" />
      </button>
    </article>
  );
}

function SpaceMenu({
  onRename,
  onMove,
  onDelete,
  onClose,
}: {
  onRename: () => void;
  onMove: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose}>
      <div
        role="menu"
        className="absolute inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] mx-auto max-w-sm rounded-[14px] bg-white p-2"
        onClick={(event) => event.stopPropagation()}
      >
        <MenuButton label={text.v1.rename} onClick={onRename} />
        <MenuButton label={text.v1.move} onClick={onMove} />
        <MenuButton label={text.v1.delete} onClick={onDelete} />
        <button
          type="button"
          onClick={onClose}
          className="flex min-h-11 w-full items-center rounded-[10px] px-3 text-left text-[16px] text-[#8A8A8E]"
        >
          {text.v1.cancel}
        </button>
      </div>
    </div>
  );
}

function MenuButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex min-h-11 w-full items-center rounded-[10px] px-3 text-left text-[16px] text-[#171717]"
    >
      {label}
    </button>
  );
}
