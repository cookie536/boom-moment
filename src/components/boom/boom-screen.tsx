"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { BottomNav } from "@/components/navigation/bottom-nav";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { text } from "@/constants/text";
import { deleteLink, listLinks } from "@/lib/boom";
import { getMoment, listMoments } from "@/lib/moments";
import { displayTitle, momentMatches, previewText, type BoomLink, type Moment, type Space } from "@/lib/model";
import { listSpaces } from "@/lib/spaces";
import { cn } from "@/lib/utils";

export function BoomScreen() {
  const router = useRouter();
  const withId = useSearchParams().get("with");
  const seeded = useRef(false);
  const [moments, setMoments] = useState<Moment[] | null>(null);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [links, setLinks] = useState<BoomLink[] | null>(null);
  const [query, setQuery] = useState("");
  const [spaceFilter, setSpaceFilter] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pendingUnlink, setPendingUnlink] = useState<string | null>(null);

  async function load() {
    const [nextMoments, nextLinks, nextSpaces] = await Promise.all([listMoments(), listLinks(), listSpaces()]);
    setMoments(nextMoments);
    setLinks(nextLinks);
    setSpaces(nextSpaces);
    setError(null);
  }

  useEffect(() => {
    void load().catch(() => setError(text.v1.loadError));
  }, []);

  useEffect(() => {
    if (seeded.current || !moments || !withId) {
      return;
    }
    seeded.current = true;
    if (moments.some((moment) => moment.id === withId)) {
      setSelected([withId]);
    }
  }, [moments, withId]);

  const visible = useMemo(() => {
    if (!moments) {
      return [];
    }
    const needle = query.trim();
    return moments.filter((moment) => {
      if (spaceFilter === "none" && moment.spaceId !== null) {
        return false;
      }
      if (spaceFilter !== "all" && spaceFilter !== "none" && moment.spaceId !== spaceFilter) {
        return false;
      }
      return needle ? momentMatches(moment, needle) : true;
    });
  }, [moments, query, spaceFilter]);

  const chosen = selected
    .map((id) => moments?.find((moment) => moment.id === id))
    .filter((moment): moment is Moment => Boolean(moment));

  function toggle(id: string) {
    setError(null);
    setSelected((current) => {
      if (current.includes(id)) {
        return current.filter((item) => item !== id);
      }
      if (current.length >= 2) {
        return current;
      }
      return [...current, id];
    });
  }

  function startBoom() {
    if (chosen.length !== 2) {
      return;
    }
    const [left, right] = chosen;
    router.push(`/boom/compare?a=${encodeURIComponent(left.id)}&b=${encodeURIComponent(right.id)}`);
  }

  async function confirmUnlink() {
    const id = pendingUnlink;
    setPendingUnlink(null);
    if (!id) {
      return;
    }
    try {
      await deleteLink(id);
      await load();
    } catch {
      setError(text.v1.saveError);
    }
  }

  return (
    <div className="mx-auto min-h-dvh w-full max-w-lg bg-white">
      <header className="px-5 pt-6">
        <h1 className="text-[28px] font-semibold tracking-[-0.03em] text-[#171717]">{text.v1.boom}</h1>
        <label className="mt-4 flex min-h-11 items-center gap-2 rounded-[14px] border border-[#EAEAEA] px-4">
          <Search className="size-4 text-[#8A8A8E]" aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={text.v1.boomSearch}
            aria-label={text.v1.boomSearch}
            className="min-w-0 flex-1 bg-transparent py-3 text-[16px] text-[#171717] outline-none placeholder:text-[#8A8A8E]"
          />
        </label>
        <label className="mt-3 flex min-h-11 items-center gap-3 text-[15px] text-[#171717]">
          <span className="shrink-0 text-[#8A8A8E]">{text.v1.spaces}</span>
          <select
            value={spaceFilter}
            onChange={(event) => setSpaceFilter(event.target.value)}
            aria-label={text.v1.spaces}
            className="min-w-0 flex-1 bg-transparent py-2 text-[16px] outline-none"
          >
            <option value="all">{text.v1.boomAll}</option>
            <option value="none">{text.v1.unclassified}</option>
            {spaces.map((space) => (
              <option key={space.id} value={space.id}>
                {space.name}
              </option>
            ))}
          </select>
        </label>
      </header>
      <main className={cn("px-5 pt-4", chosen.length === 2 ? "pb-44" : "pb-32")}>
        <p className="text-[14px] text-[#8A8A8E]">{text.v1.boomPick}</p>
        {chosen.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {chosen.map((moment) => (
              <button
                key={moment.id}
                type="button"
                onClick={() => toggle(moment.id)}
                className="min-h-11 rounded-full border border-[#171717] px-4 text-[14px] text-[#171717]"
              >
                {displayTitle(moment)}
              </button>
            ))}
          </div>
        ) : null}
        {error ? <p className="mt-3 text-[14px] text-[#171717]">{error}</p> : null}

        <div className="mt-6">
          {moments === null ? <p className="py-8 text-center text-[15px] text-[#8A8A8E]">{text.v1.loading}</p> : null}
          {moments && moments.length === 0 ? (
            <p className="py-8 text-center text-[15px] text-[#8A8A8E]">{text.v1.boomNone}</p>
          ) : null}
          {moments && moments.length > 0 && visible.length === 0 ? (
            <p className="py-8 text-center text-[15px] text-[#8A8A8E]">{text.v1.searchEmpty}</p>
          ) : null}
          {visible.map((moment) => {
            const active = selected.includes(moment.id);
            const preview = previewText(moment).replace(/\s+/g, " ").trim();
            const spaceName = moment.spaceId
              ? spaces.find((space) => space.id === moment.spaceId)?.name ?? text.v1.unclassified
              : text.v1.unclassified;
            return (
              <label
                key={moment.id}
                className={cn("flex items-start gap-3 border-b border-[#EAEAEA] py-3", active && "bg-[#F7F7F7]")}
              >
                <input
                  type="checkbox"
                  checked={active}
                  disabled={!active && selected.length >= 2}
                  onChange={() => toggle(moment.id)}
                  className="mt-1 size-5 shrink-0 accent-[#171717]"
                />
                <span className="min-w-0">
                  <span className="block truncate text-[16px] font-medium">{displayTitle(moment)}</span>
                  {preview ? <span className="mt-1 line-clamp-2 block text-[14px] text-[#8A8A8E]">{preview}</span> : null}
                  <span className="mt-1 block truncate text-[12px] text-[#8A8A8E]">{spaceName}</span>
                </span>
              </label>
            );
          })}
        </div>

        <section className="mt-10">
          <h2 className="text-[18px] font-semibold text-[#171717]">{text.v1.boomLinks}</h2>
          {links && links.length === 0 ? (
            <p className="py-8 text-center text-[15px] text-[#8A8A8E]">{text.v1.boomEmpty}</p>
          ) : null}
          <div className="mt-3 flex flex-col gap-3">
            {links?.map((link) => (
              <ConnectionCard key={link.id} link={link} onUnlink={() => setPendingUnlink(link.id)} />
            ))}
          </div>
        </section>
      </main>
      {chosen.length === 2 ? (
        <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 mx-auto w-full max-w-lg px-5">
          <button
            type="button"
            onClick={startBoom}
            className="min-h-11 w-full rounded-[14px] bg-[#171717] text-[15px] text-white"
          >
            {text.v1.boomStart}
          </button>
        </div>
      ) : null}
      <BottomNav />
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
    </div>
  );
}

function ConnectionCard({ link, onUnlink }: { link: BoomLink; onUnlink: () => void }) {
  const [ends, setEnds] = useState<[Moment | null, Moment | null] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([getMoment(link.aId), getMoment(link.bId)]).then((next) => {
      if (!cancelled) {
        setEnds(next);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [link.aId, link.bId]);

  return (
    <article className="rounded-[14px] border border-[#EAEAEA] p-3">
      <EndLink moment={ends?.[0] ?? null} />
      <EndLink moment={ends?.[1] ?? null} />
      <button type="button" onClick={onUnlink} className="mt-1 min-h-11 px-1 text-[14px] text-[#8A8A8E]">
        {text.v1.unlink}
      </button>
    </article>
  );
}

function EndLink({ moment }: { moment: Moment | null }) {
  if (!moment) {
    return <p className="py-2 text-[15px] text-[#8A8A8E]">{text.v1.missingMoment}</p>;
  }
  const preview = previewText(moment).replace(/\s+/g, " ").trim();
  return (
    <Link href={`/moments/${moment.id}`} className="block py-2">
      <p className="truncate text-[16px] font-medium text-[#171717]">{displayTitle(moment)}</p>
      {preview ? <p className="mt-1 line-clamp-2 text-[14px] text-[#8A8A8E]">{preview}</p> : null}
    </Link>
  );
}
