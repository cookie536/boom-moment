"use client";

import { ChevronDown, ChevronRight, Search } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { BottomNav } from "@/components/navigation/bottom-nav";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { text } from "@/constants/text";
import { deleteLink, listBooms, listLinks } from "@/lib/boom";
import { boomHistoryTitle } from "@/lib/boom-flow";
import { boomQuery, readBoomSelection, uniqueIds, writeBoomSelection } from "@/lib/boom-selection";
import { getMoment, listMoments } from "@/lib/moments";
import { displayTitle, formatWhen, momentMatches, previewText, type Boom, type BoomLink, type Moment, type Space } from "@/lib/model";
import { listSpaces } from "@/lib/spaces";
import { cn } from "@/lib/utils";

export function BoomScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const seeded = useRef(false);
  const [tab, setTab] = useState<"create" | "history">("create");
  const [moments, setMoments] = useState<Moment[] | null>(null);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [links, setLinks] = useState<BoomLink[] | null>(null);
  const [booms, setBooms] = useState<Boom[] | null>(null);
  const [query, setQuery] = useState("");
  const [spaceFilter, setSpaceFilter] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [selectedOpen, setSelectedOpen] = useState(false);
  const [highlight, setHighlight] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendingUnlink, setPendingUnlink] = useState<string | null>(null);

  async function load() {
    const [nextMoments, nextLinks, nextBooms, nextSpaces] = await Promise.all([
      listMoments(),
      listLinks(),
      listBooms(),
      listSpaces(),
    ]);
    setMoments(nextMoments);
    setLinks(nextLinks);
    setBooms(nextBooms);
    setSpaces(nextSpaces);
    setError(null);
  }

  useEffect(() => {
    void load().catch(() => setError(text.v1.loadError));
  }, []);

  useEffect(() => {
    if (seeded.current || !moments) {
      return;
    }
    seeded.current = true;
    const known = (id: string) => moments.some((moment) => moment.id === id);
    const fromUrl = uniqueIds(searchParams.getAll("m")).filter(known);
    const withId = searchParams.get("with");
    const stored = readBoomSelection().filter(known);
    const next = fromUrl.length > 0 ? fromUrl : withId && known(withId) ? [withId] : stored;
    setSelected(next);
    writeBoomSelection(next);
    if (searchParams.toString()) {
      router.replace("/boom");
    }
  }, [moments, router, searchParams]);

  useEffect(() => {
    if (!links || !booms) {
      return;
    }
    const hash = window.location.hash.replace(/^#/, "");
    const eventId = hash.startsWith("event-") ? hash.slice("event-".length) : "";
    const linkId = hash.startsWith("boom-") ? hash.slice("boom-".length) : "";
    if ((eventId && booms.some((boom) => boom.id === eventId)) || (linkId && links.some((link) => link.id === linkId))) {
      setTab("history");
      setHighlight(hash);
      document.getElementById(hash)?.scrollIntoView({ block: "center" });
    }
  }, [links, booms]);

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

  const chosen = selected.flatMap((id) => {
    const moment = moments?.find((item) => item.id === id);
    return moment ? [moment] : [];
  });
  const ready = selected.length >= 2;

  function spaceName(moment: Moment) {
    if (!moment.spaceId) {
      return text.v1.unclassified;
    }
    return spaces.find((space) => space.id === moment.spaceId)?.name ?? text.v1.unclassified;
  }

  function toggle(id: string) {
    setError(null);
    setSelected((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      writeBoomSelection(next);
      return next;
    });
  }

  function startBoom() {
    if (selected.length < 2) {
      return;
    }
    router.push(`/boom/write?${boomQuery(selected)}`);
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
    <div className="mx-auto min-h-dvh w-full max-w-lg bg-[#F7F4EF] md:max-w-3xl">
      <header className="px-5 pt-6">
        <h1 className="text-center text-[22px] font-semibold text-[#2C2825]">{text.v1.boom}</h1>
        <div className="mt-3 grid grid-cols-2 border-b border-[#E7E0D6]" role="tablist" aria-label={text.v1.boom}>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "create"}
            onClick={() => setTab("create")}
            className={cn(
              "min-h-11 text-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8C7358]",
              tab === "create" ? "border-b-2 border-[#8C7358] font-semibold text-[#2C2825]" : "text-[#8A8178]",
            )}
          >
            {text.v1.boomCreateTab}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "history"}
            onClick={() => setTab("history")}
            className={cn(
              "min-h-11 text-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8C7358]",
              tab === "history" ? "border-b-2 border-[#8C7358] font-semibold text-[#2C2825]" : "text-[#8A8178]",
            )}
          >
            {text.v1.boomHistoryTab}
          </button>
        </div>
      </header>
      <main className={cn("px-5 pt-4", tab === "create" && ready ? "pb-44" : "pb-32")}>
        {error ? <p className="mb-3 text-[14px] text-[#2C2825]">{error}</p> : null}
        {tab === "create" ? (
          <div>
            <p className="text-[13px] text-[#8A8178]">{text.v1.boomPick}</p>
            <div className="mt-4 flex gap-3">
              <label className="flex min-h-11 min-w-0 flex-1 items-center gap-2 border-b border-[#E7E0D6]">
                <Search className="size-4 shrink-0 text-[#8A8178]" aria-hidden="true" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={text.v1.boomSearch}
                  aria-label={text.v1.boomSearch}
                  className="min-w-0 flex-1 bg-transparent py-2 text-[16px] text-[#2C2825] outline-none placeholder:text-[#8A8178]"
                />
              </label>
              <label className="flex min-h-11 shrink-0 items-center gap-1 border-b border-[#E7E0D6] text-[14px] text-[#2C2825]">
                <span className="text-[#8A8178]">{text.v1.spaces}</span>
                <select
                  value={spaceFilter}
                  onChange={(event) => setSpaceFilter(event.target.value)}
                  aria-label={text.v1.spaces}
                  className="max-w-28 bg-transparent py-2 outline-none"
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
            </div>
            {selected.length > 0 ? (
              <div className="mt-3">
                <button
                  type="button"
                  aria-expanded={selectedOpen}
                  onClick={() => setSelectedOpen((open) => !open)}
                  className="flex min-h-11 w-full items-center justify-between text-[14px] font-medium text-[#8C7358] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8C7358]"
                >
                  {text.v1.boomSelected(selected.length)}
                  <ChevronDown className={cn("size-4", selectedOpen ? "rotate-180" : "")} aria-hidden="true" />
                </button>
                {selectedOpen ? (
                  <ul className="mt-1 flex flex-col">
                    {chosen.map((moment) => (
                      <li key={moment.id} className="flex min-h-11 items-center gap-3 border-b border-[#E7E0D6]">
                        <span className="min-w-0 flex-1 truncate text-[14px] text-[#2C2825]">{displayTitle(moment)}</span>
                        <button
                          type="button"
                          onClick={() => toggle(moment.id)}
                          className="min-h-11 shrink-0 px-1 text-[13px] text-[#8A8178] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8C7358]"
                        >
                          {text.v1.ideaRemove}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
            <div className="mt-4 flex flex-col">
              {moments === null ? <p className="py-8 text-center text-[15px] text-[#8A8178]">{text.v1.loading}</p> : null}
              {moments && moments.length === 0 ? (
                <p className="py-8 text-center text-[15px] text-[#6F675F]">{text.v1.boomNone}</p>
              ) : null}
              {moments && moments.length > 0 && visible.length === 0 ? (
                <p className="py-8 text-center text-[15px] text-[#8A8178]">{text.v1.searchEmpty}</p>
              ) : null}
              {visible.map((moment) => {
                const index = selected.indexOf(moment.id);
                const pressed = index >= 0;
                const preview = previewText(moment).replace(/\s+/g, " ").trim();
                return (
                  <button
                    key={moment.id}
                    type="button"
                    aria-pressed={pressed}
                    onClick={() => toggle(moment.id)}
                    className={cn(
                      "flex w-full items-start gap-3 border-b border-[#E7E0D6] py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8C7358] focus-visible:ring-offset-2",
                      pressed ? "bg-[#EFE8DF]" : "",
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-[14px] leading-[18px] font-semibold text-[#2C2825] [overflow-wrap:anywhere]">
                        {displayTitle(moment)}
                      </span>
                      {preview ? (
                        <span className="mt-1 line-clamp-1 text-[12px] leading-4 text-[#6F675F] [overflow-wrap:anywhere]">
                          {preview}
                        </span>
                      ) : null}
                      <span className="mt-1 block max-w-full truncate text-[12px] leading-4 text-[#8A8178]">
                        {spaceName(moment)}
                      </span>
                    </span>
                    {pressed ? (
                      <span className="shrink-0 text-[13px] font-semibold text-[#8C7358]">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            <section>
              <h2 className="text-[15px] font-semibold text-[#2C2825]">{text.v1.boomSavedList}</h2>
              {booms && booms.length === 0 ? (
                <p className="py-8 text-center text-[15px] text-[#6F675F]">{text.v1.boomEventEmpty}</p>
              ) : null}
              <div className="mt-2 flex flex-col">
                {booms?.map((boom) => (
                  <HistoryRow key={boom.id} boom={boom} moments={moments ?? []} highlighted={highlight === `event-${boom.id}`} />
                ))}
              </div>
            </section>
            <section>
              <h2 className="text-[15px] font-semibold text-[#2C2825]">{text.v1.boomLinks}</h2>
              {links && links.length === 0 ? (
                <p className="py-8 text-center text-[15px] text-[#6F675F]">{text.v1.boomEmpty}</p>
              ) : null}
              <div className="mt-2 flex flex-col">
                {links?.map((link) => (
                  <ConnectionCard
                    key={link.id}
                    link={link}
                    highlighted={highlight === `boom-${link.id}`}
                    onUnlink={() => setPendingUnlink(link.id)}
                  />
                ))}
              </div>
            </section>
          </div>
        )}
      </main>
      {tab === "create" && ready ? (
        <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 mx-auto w-full max-w-lg px-5">
          <button
            type="button"
            onClick={startBoom}
            className="min-h-11 w-full rounded-[14px] bg-[#2C2825] text-[15px] text-[#F7F4EF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8C7358] focus-visible:ring-offset-2"
          >
            {text.v1.boomStart(selected.length)}
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

function HistoryRow({ boom, moments, highlighted }: { boom: Boom; moments: Moment[]; highlighted: boolean }) {
  const title = boomHistoryTitle(boom, moments);
  const preview = boom.sourceMomentIds
    .map((id) => {
      const moment = moments.find((item) => item.id === id);
      return moment ? displayTitle(moment) : "";
    })
    .filter(Boolean)
    .join(" · ");
  return (
    <Link
      id={`event-${boom.id}`}
      href={`/boom/${boom.id}`}
      className={cn(
        "block border-b py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8C7358] focus-visible:ring-offset-2",
        highlighted ? "border-[#8C7358] bg-[#EFE8DF]" : "border-[#E7E0D6]",
      )}
    >
      <span className="flex items-start gap-3">
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-3">
            <span className="line-clamp-2 text-[14px] leading-[18px] font-semibold text-[#2C2825] [overflow-wrap:anywhere]">
              {title || text.v1.missingMoment}
            </span>
            <span className="shrink-0 text-[12px] text-[#8A8178]">{formatWhen(boom.createdAt)}</span>
          </span>
          <span className="mt-1 block text-[12px] text-[#8A8178]">
            {text.v1.boomHistoryMeta(boom.sourceMomentIds.length, Boolean(boom.resultMomentId))}
          </span>
          {preview ? <span className="mt-1 line-clamp-1 text-[12px] text-[#6F675F]">{preview}</span> : null}
        </span>
        <ChevronRight className="mt-1 size-4 shrink-0 text-[#8A8178]" aria-hidden="true" />
      </span>
    </Link>
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

  const title = ends
    ? `${ends[0] ? displayTitle(ends[0]) : text.v1.missingMoment} ↔ ${ends[1] ? displayTitle(ends[1]) : text.v1.missingMoment}`
    : text.v1.loading;

  return (
    <article
      id={`boom-${link.id}`}
      className={cn("border-b py-4", highlighted ? "border-[#8C7358] bg-[#EFE8DF]" : "border-[#E7E0D6]")}
    >
      <p className="truncate text-[14px] font-semibold text-[#2C2825]">{title}</p>
      <p className="mt-1 text-[12px] text-[#8A8178]">{text.v1.oldLinkNote}</p>
      <button
        type="button"
        onClick={onUnlink}
        className="mt-1 min-h-11 px-0 text-[14px] text-[#8A8178] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8C7358]"
      >
        {text.v1.unlink}
      </button>
    </article>
  );
}
