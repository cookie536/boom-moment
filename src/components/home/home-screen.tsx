"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { MomentCard, MomentListRow } from "@/components/home/moment-card";
import { BottomNav } from "@/components/navigation/bottom-nav";
import { MomentSpaceDialog } from "@/components/space/moment-space-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { text } from "@/constants/text";
import { readHomeView, writeHomeView } from "@/lib/db";
import { countLinks, deleteMoment, listMoments, moveMoment } from "@/lib/moments";
import type { HomeView, Moment, Space } from "@/lib/model";
import { listSpaces } from "@/lib/spaces";
import { cn } from "@/lib/utils";

export function HomeScreen() {
  const router = useRouter();
  const [moments, setMoments] = useState<Moment[] | null>(null);
  const [view, setView] = useState<HomeView>("cards");
  const [error, setError] = useState<string | null>(null);
  const [menu, setMenu] = useState<Moment | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ moment: Moment; links: number } | null>(null);
  const [moving, setMoving] = useState<Moment | null>(null);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const viewChosen = useRef(false);

  const load = useCallback(async () => {
    try {
      const [nextMoments, nextView] = await Promise.all([listMoments(), readHomeView()]);
      setMoments(nextMoments);
      if (!viewChosen.current) {
        setView(nextView);
      }
      setError(null);
    } catch {
      setError(text.v1.loadError);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!menu) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenu(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menu]);

  async function chooseView(next: HomeView) {
    viewChosen.current = true;
    setView(next);
    try {
      await writeHomeView(next);
    } catch {
      setError(text.v1.saveError);
    }
  }

  async function openMove(moment: Moment) {
    setMenu(null);
    try {
      setSpaces(await listSpaces());
      setMoving(moment);
    } catch {
      setError(text.v1.loadError);
    }
  }

  async function confirmMove(spaceId: string | null) {
    if (!moving) {
      return;
    }
    const id = moving.id;
    setMoving(null);
    try {
      await moveMoment(id, spaceId);
      await load();
    } catch {
      setError(text.v1.saveError);
    }
  }

  async function askDelete(moment: Moment) {
    setMenu(null);
    try {
      const links = await countLinks(moment.id);
      setPendingDelete({ moment, links });
    } catch {
      setError(text.v1.loadError);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) {
      return;
    }
    const id = pendingDelete.moment.id;
    setPendingDelete(null);
    try {
      await deleteMoment(id);
      setMoments((current) => current?.filter((moment) => moment.id !== id) ?? current);
    } catch {
      setError(text.v1.saveError);
    }
  }

  return (
    <div className="mx-auto min-h-dvh w-full max-w-lg bg-white">
      <header className="px-5 pt-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-[28px] font-semibold tracking-[-0.03em] text-[#171717]">{text.v1.appName}</h1>
          <div className="flex rounded-[14px] border border-[#EAEAEA] p-1">
            <button
              type="button"
              aria-pressed={view === "cards"}
              onClick={() => void chooseView("cards")}
              className={cn(
                "min-h-11 rounded-[10px] px-3 text-[14px]",
                view === "cards" ? "bg-[#171717] text-white" : "text-[#8A8A8E]",
              )}
            >
              {text.v1.cards}
            </button>
            <button
              type="button"
              aria-pressed={view === "list"}
              onClick={() => void chooseView("list")}
              className={cn(
                "min-h-11 rounded-[10px] px-3 text-[14px]",
                view === "list" ? "bg-[#171717] text-white" : "text-[#8A8A8E]",
              )}
            >
              {text.v1.list}
            </button>
          </div>
        </div>
        <Link
          href="/search"
          className="mt-4 flex min-h-11 items-center gap-2 rounded-[14px] border border-[#EAEAEA] px-4 text-[15px] text-[#8A8A8E]"
        >
          <Search className="size-4" aria-hidden="true" />
          {text.v1.search}
        </Link>
      </header>
      <main className="px-5 pt-4 pb-32">
        {error ? (
          <div className="py-16 text-center">
            <p className="text-[15px] text-[#8A8A8E]">{error}</p>
            <button type="button" onClick={() => void load()} className="mt-4 min-h-11 px-4 text-[15px] text-[#171717]">
              {text.v1.retry}
            </button>
          </div>
        ) : moments === null ? (
          <p className="py-16 text-center text-[15px] text-[#8A8A8E]">{text.v1.loading}</p>
        ) : moments.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-[16px] text-[#8A8A8E]">{text.v1.emptyTitle}</p>
            <Link
              href="/moments/new"
              className="mt-6 inline-flex min-h-11 items-center rounded-[14px] bg-[#171717] px-5 text-[15px] text-white"
            >
              {text.v1.emptyAction}
            </Link>
          </div>
        ) : view === "cards" ? (
          <div className="columns-2 gap-3">
            {moments.map((moment) => (
              <MomentCard key={moment.id} moment={moment} onMenu={setMenu} />
            ))}
          </div>
        ) : (
          <div>
            {moments.map((moment) => (
              <MomentListRow key={moment.id} moment={moment} onMenu={setMenu} />
            ))}
          </div>
        )}
      </main>
      <BottomNav />
      {menu ? (
        <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setMenu(null)}>
          <div
            role="menu"
            className="absolute inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] mx-auto max-w-sm rounded-[14px] bg-white p-2"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              role="menuitem"
              className="flex min-h-11 w-full items-center rounded-[10px] px-3 text-left text-[16px]"
              onClick={() => router.push(`/moments/${menu.id}/edit`)}
            >
              {text.v1.edit}
            </button>
            <button
              type="button"
              role="menuitem"
              className="flex min-h-11 w-full items-center rounded-[10px] px-3 text-left text-[16px]"
              onClick={() => void openMove(menu)}
            >
              {text.v1.move}
            </button>
            <button
              type="button"
              role="menuitem"
              className="flex min-h-11 w-full items-center rounded-[10px] px-3 text-left text-[16px]"
              onClick={() => void askDelete(menu)}
            >
              {text.v1.delete}
            </button>
            <button
              type="button"
              className="flex min-h-11 w-full items-center rounded-[10px] px-3 text-left text-[16px] text-[#8A8A8E]"
              onClick={() => setMenu(null)}
            >
              {text.v1.cancel}
            </button>
          </div>
        </div>
      ) : null}
      {moving ? (
        <MomentSpaceDialog
          spaces={spaces}
          currentId={moving.spaceId}
          onCancel={() => setMoving(null)}
          onSelect={(spaceId) => void confirmMove(spaceId)}
        />
      ) : null}
      {pendingDelete ? (
        <ConfirmDialog
          title={text.v1.deleteTitle}
          body={text.v1.deleteBody(pendingDelete.links)}
          confirmLabel={text.v1.delete}
          cancelLabel={text.v1.cancel}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void confirmDelete()}
        />
      ) : null}
    </div>
  );
}
