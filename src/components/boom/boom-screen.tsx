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
  const [slots, setSlots] = useState<[string | null, string | null]>([null, null]);
  const [focus, setFocus] = useState<0 | 1>(0);
  const [armed, setArmed] = useState(false);
  const [highlight, setHighlight] = useState("");
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
      setSlots([withId, null]);
      setFocus(1);
    }
  }, [moments, withId]);

  useEffect(() => {
    if (!links) {
      return;
    }
    const id = window.location.hash.replace(/^#boom-/, "");
    if (!id || !links.some((link) => link.id === id)) {
      return;
    }
    setHighlight(id);
    document.getElementById(`boom-${id}`)?.scrollIntoView({ block: "center" });
  }, [links]);

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

  const chosen = slots.map((id) => (id ? moments?.find((moment) => moment.id === id) ?? null : null));
  const ready = Boolean(chosen[0] && chosen[1]);

  function spaceName(moment: Moment) {
    if (!moment.spaceId) {
      return text.v1.unclassified;
    }
    return spaces.find((space) => space.id === moment.spaceId)?.name ?? text.v1.unclassified;
  }

  function pick(id: string) {
    setError(null);
    const occupied = slots[0] === id ? 0 : slots[1] === id ? 1 : null;
    if (occupied !== null) {
      const next: [string | null, string | null] = [slots[0], slots[1]];
      next[occupied] = null;
      setSlots(next);
      setFocus(occupied);
      setArmed(false);
      return;
    }
    let target: 0 | 1 | null = null;
    if (armed) {
      target = focus;
    } else if (!slots[0]) {
      target = 0;
    } else if (!slots[1]) {
      target = 1;
    }
    if (target === null) {
      return;
    }
    const next: [string | null, string | null] = [slots[0], slots[1]];
    next[target] = id;
    setSlots(next);
    setArmed(false);
    if (!next[0]) {
      setFocus(0);
    } else if (!next[1]) {
      setFocus(1);
    } else {
      setFocus(target);
    }
  }

  function clearSlot(index: 0 | 1) {
    setError(null);
    setSlots((current) => {
      const next: [string | null, string | null] = [current[0], current[1]];
      next[index] = null;
      return next;
    });
    setFocus(index);
  }

  function startBoom() {
    if (chosen.length !== 2) {
      return;
    }
    const [left, right] = chosen;
    if (!left || !right) {
      return;
    }
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
    <div className="mx-auto min-h-dvh w-full max-w-lg bg-[#F7F4EF] md:max-w-5xl">
      <header className="px-5 pt-6">
        <h1 className="text-[28px] font-semibold tracking-[-0.03em] text-[#171717]">{text.v1.boom}</h1>
        <p className="mt-2 text-[14px] text-[#8A8A8E]">{text.v1.boomPick}</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {([0, 1] as const).map((index) => (
            <IdeaSlot
              key={index}
              index={index}
              moment={chosen[index]}
              spaceLabel={chosen[index] ? spaceName(chosen[index]) : ""}
              focused={focus === index}
              onFocus={() => {
                setFocus(index);
                setArmed(true);
              }}
              onClear={() => clearSlot(index)}
            />
          ))}
        </div>
        {ready ? (
          <button
            type="button"
            onClick={startBoom}
            className="mt-4 hidden min-h-11 w-full rounded-[14px] bg-[#171717] text-[15px] text-white transition-colors duration-200 md:block"
          >
            {text.v1.boomStart}
          </button>
        ) : null}
      </header>
      <main className={cn("px-5 pt-5", ready ? "pb-44 md:pb-32" : "pb-32")}>
        {error ? <p className="mb-3 text-[14px] text-[#171717]">{error}</p> : null}
        <div className="lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)] lg:items-start lg:gap-8">
          <div>
            <label className="flex min-h-11 items-center gap-2 rounded-[14px] border border-[#E7E2DA] bg-white px-4">
              <Search className="size-4 text-[#8A8A8E]" aria-hidden="true" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={text.v1.boomSearch}
                aria-label={text.v1.boomSearch}
                className="min-w-0 flex-1 bg-transparent py-3 text-[16px] text-[#171717] outline-none placeholder:text-[#8A8A8E]"
              />
            </label>
            <label className="mt-3 flex min-h-11 items-center gap-3 rounded-[14px] border border-[#E7E2DA] bg-white px-4 text-[15px] text-[#171717]">
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
            <div className="mt-4 flex flex-col gap-2">
              {moments === null ? <p className="py-8 text-center text-[15px] text-[#8A8A8E]">{text.v1.loading}</p> : null}
              {moments && moments.length === 0 ? (
                <p className="py-8 text-center text-[15px] text-[#8A8A8E]">{text.v1.boomNone}</p>
              ) : null}
              {moments && moments.length > 0 && visible.length === 0 ? (
                <p className="py-8 text-center text-[15px] text-[#8A8A8E]">{text.v1.searchEmpty}</p>
              ) : null}
              {visible.map((moment) => {
                const slot = slots[0] === moment.id ? 0 : slots[1] === moment.id ? 1 : -1;
                const preview = previewText(moment).replace(/\s+/g, " ").trim();
                return (
                  <button
                    key={moment.id}
                    type="button"
                    aria-pressed={slot >= 0}
                    onClick={() => pick(moment.id)}
                    className={cn(
                      "flex min-h-11 w-full items-start gap-3 rounded-[14px] border px-3 py-3 text-left transition duration-200 active:scale-[0.99]",
                      slot >= 0
                        ? "border-[#C8B8A4] bg-[#F3EEE6]"
                        : "border-[#E7E2DA] bg-white [@media(hover:hover)]:hover:border-[#D9D0C5]",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] transition-colors duration-200",
                        slot >= 0 ? "bg-[#8A7355] text-white" : "border border-[#E7E2DA] text-transparent",
                      )}
                      aria-hidden="true"
                    >
                      {slot === 0 ? "01" : slot === 1 ? "02" : ""}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[16px] font-medium text-[#171717] [overflow-wrap:anywhere]">
                        {displayTitle(moment)}
                      </span>
                      {preview ? (
                        <span className="mt-1 line-clamp-2 block text-[14px] text-[#8A8A8E] [overflow-wrap:anywhere]">
                          {preview}
                        </span>
                      ) : null}
                      <span className="mt-1 block truncate text-[12px] text-[#8A8A8E]">{spaceName(moment)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <section className="mt-10 lg:mt-0">
            <h2 className="text-[18px] font-semibold text-[#171717]">{text.v1.boomLinks}</h2>
            {links && links.length === 0 ? (
              <p className="py-8 text-center text-[15px] text-[#8A8A8E]">{text.v1.boomEmpty}</p>
            ) : null}
            <div className="mt-3 flex flex-col gap-3">
              {links?.map((link) => (
                <ConnectionCard
                  key={link.id}
                  link={link}
                  highlighted={highlight === link.id}
                  onUnlink={() => setPendingUnlink(link.id)}
                />
              ))}
            </div>
          </section>
        </div>
      </main>
      {ready ? (
        <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 mx-auto w-full max-w-lg px-5 md:hidden">
          <button
            type="button"
            onClick={startBoom}
            className="min-h-11 w-full rounded-[14px] bg-[#171717] text-[15px] text-white transition-transform duration-200 active:scale-[0.99]"
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

function IdeaSlot({
  index,
  moment,
  spaceLabel,
  focused,
  onFocus,
  onClear,
}: {
  index: 0 | 1;
  moment: Moment | null;
  spaceLabel: string;
  focused: boolean;
  onFocus: () => void;
  onClear: () => void;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[124px] flex-col rounded-[14px] border bg-white p-3 transition-[border-color,transform] duration-200",
        focused ? "border-[#8A7355]" : "border-[#E7E2DA]",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] tracking-[0.04em] text-[#8A7355]">{index === 0 ? text.v1.idea01 : text.v1.idea02}</span>
        {moment ? (
          <button type="button" onClick={onClear} className="min-h-11 px-1 text-[13px] text-[#8A8A8E]">
            {text.v1.ideaRemove}
          </button>
        ) : null}
      </div>
      <button type="button" onClick={onFocus} className="mt-1 flex min-h-11 flex-1 flex-col items-start text-left">
        {moment ? (
          <>
            <span className="line-clamp-2 text-[15px] leading-5 font-medium text-[#171717] [overflow-wrap:anywhere]">
              {displayTitle(moment)}
            </span>
            <span className="mt-1 block w-full truncate text-[12px] text-[#8A8A8E]">{spaceLabel}</span>
          </>
        ) : (
          <span className="text-[14px] leading-5 text-[#8A8A8E]">{text.v1.ideaEmpty}</span>
        )}
      </button>
    </div>
  );
}

function ConnectionCard({
  link,
  highlighted,
  onUnlink,
}: {
  link: BoomLink;
  highlighted: boolean;
  onUnlink: () => void;
}) {
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
    <article
      id={`boom-${link.id}`}
      className={cn(
        "rounded-[14px] border bg-white p-3 transition-[border-color,background-color] duration-200",
        highlighted ? "border-[#8A7355] bg-[#F3EEE6]" : "border-[#E7E2DA]",
      )}
    >
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
