"use client";

import { useEffect, useMemo, useState } from "react";
import { text } from "@/constants/text";
import { moveMoment } from "@/lib/moments";
import { displayTitle, momentMatches, previewText, type Moment, type Space } from "@/lib/model";
import { momentsInSpace, SpaceMissingError } from "@/lib/spaces";
import { cn } from "@/lib/utils";

export function AddMomentsDialog({
  spaceId,
  spaceName,
  moments,
  spaces,
  onCancel,
  onMoved,
  onRefresh,
}: {
  spaceId: string;
  spaceName: string;
  moments: Moment[];
  spaces: Space[];
  onCancel: () => void;
  onMoved: () => void;
  onRefresh: () => void;
}) {
  const [sourceId, setSourceId] = useState<string>("none");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  const visible = useMemo(() => {
    const source = sourceId === "none" ? null : sourceId;
    const needle = query.trim();
    return momentsInSpace(moments, source).filter((moment) => (needle ? momentMatches(moment, needle) : true));
  }, [moments, query, sourceId]);

  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  async function moveSelected() {
    if (selected.length === 0 || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      for (const id of selected) {
        await moveMoment(id, spaceId);
      }
      onMoved();
    } catch (caught) {
      onRefresh();
      setError(caught instanceof SpaceMissingError ? text.v1.spaceMissing : text.v1.saveError);
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-black/30">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-moments-title"
        className="flex h-full w-full max-w-lg flex-col bg-[#F7F4EF]"
      >
        <header className="px-5 pt-5">
          <div className="flex items-center justify-between gap-3">
            <h2 id="add-moments-title" className="text-[20px] font-semibold text-[#2C2825]">
              {text.v1.addExisting}
            </h2>
            <button type="button" onClick={onCancel} disabled={busy} className="min-h-11 px-2 text-[16px] text-[#8A8178]">
              {text.v1.cancel}
            </button>
          </div>
          <p className="mt-2 text-[14px] leading-relaxed text-[#2C2825]">{text.v1.moveNotCopy}</p>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={text.v1.boomSearch}
            aria-label={text.v1.boomSearch}
            className="mt-4 w-full rounded-[14px] border border-[#E7E0D6] px-4 py-3 text-[16px] outline-none focus-visible:ring-2 focus-visible:ring-[#8C7358]"
          />
          <label className="mt-3 flex min-h-11 items-center gap-3 text-[15px]">
            <span className="shrink-0 text-[#8A8178]">{text.v1.spaces}</span>
            <select
              value={sourceId}
              onChange={(event) => setSourceId(event.target.value)}
              aria-label={text.v1.spaces}
              className="min-w-0 flex-1 bg-transparent py-2 text-[16px] text-[#2C2825] outline-none"
            >
              <option value="none">{text.v1.unclassified}</option>
              {spaces
                .filter((space) => space.id !== spaceId)
                .map((space) => (
                  <option key={space.id} value={space.id}>
                    {space.name}
                  </option>
                ))}
            </select>
          </label>
        </header>
        <div className="mt-2 min-h-0 flex-1 overflow-y-auto px-5 pb-3">
          {visible.length === 0 ? <p className="py-10 text-center text-[15px] text-[#8A8178]">{text.v1.addExistingEmpty}</p> : null}
          <div className="flex flex-col gap-3">
            {visible.map((moment) => {
              const active = selected.includes(moment.id);
              const preview = previewText(moment).replace(/\s+/g, " ").trim();
              return (
                <button
                  key={moment.id}
                  type="button"
                  aria-pressed={active}
                  disabled={busy}
                  onClick={() => toggle(moment.id)}
                  className={cn(
                    "flex min-h-11 w-full min-w-0 flex-col items-start rounded-[16px] border px-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8C7358] focus-visible:ring-offset-2",
                    active
                      ? "border-[#8C7358] bg-[#EFE8DF]"
                      : "border-[#E7E0D6] bg-[#FBF8F4] [@media(hover:hover)]:hover:border-[#D9D0C4]",
                  )}
                >
                  <span className="block w-full truncate text-[16px] font-medium text-[#2C2825]">{displayTitle(moment)}</span>
                  {preview ? <span className="mt-1 block w-full truncate text-[13px] text-[#8A8178]">{preview}</span> : null}
                </button>
              );
            })}
          </div>
          {error ? <p className="py-3 text-[14px] text-[#2C2825]">{error}</p> : null}
        </div>
        <div className="border-t border-[#E7E0D6] px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => void moveSelected()}
            disabled={busy || selected.length === 0}
            className="min-h-11 w-full rounded-[14px] bg-[#2C2825] text-[15px] text-[#F7F4EF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8C7358] focus-visible:ring-offset-2 disabled:bg-[#E7E0D6] disabled:text-[#8A8178]"
          >
            {text.v1.moveSelected(selected.length, spaceName)}
          </button>
        </div>
      </div>
    </div>
  );
}
