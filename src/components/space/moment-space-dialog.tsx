"use client";

import { useEffect } from "react";
import { text } from "@/constants/text";
import type { Space } from "@/lib/model";
import { spaceTree } from "@/lib/spaces";

export function MomentSpaceDialog({
  spaces,
  currentId,
  error = null,
  onCancel,
  onSelect,
}: {
  spaces: Space[];
  currentId: string | null;
  error?: string | null;
  onCancel: () => void;
  onSelect: (spaceId: string | null) => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const options: { id: string | null; label: string; depth: number }[] = [
    { id: null, label: text.v1.unclassified, depth: 0 },
    ...spaceTree(spaces).map(({ space, depth }) => ({ id: space.id, label: space.name, depth })),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="move-moment-title"
        className="max-h-[70dvh] w-full max-w-sm overflow-y-auto rounded-[14px] bg-[#FBF8F4] p-3"
      >
        <h2 id="move-moment-title" className="px-2 py-2 text-[18px] font-semibold text-[#2C2825]">
          {text.v1.moveMoment}
        </h2>
        {error ? <p className="px-2 pb-2 text-[14px] text-[#2C2825]">{error}</p> : null}
        {options.map((option) => {
          const selected = option.id === currentId;
          return (
            <button
              key={option.id ?? "unclassified"}
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(option.id)}
              className="flex min-h-11 w-full items-center rounded-[10px] px-3 text-left text-[16px] text-[#2C2825]"
              style={{ paddingLeft: 12 + option.depth * 16 }}
            >
              <span className="min-w-0 flex-1 truncate">{option.label}</span>
              {selected ? <span className="text-[13px] text-[#8A8178]">{text.v1.currentSpace}</span> : null}
            </button>
          );
        })}
        <button
          type="button"
          onClick={onCancel}
          className="mt-1 flex min-h-11 w-full items-center rounded-[10px] px-3 text-left text-[16px] text-[#8A8178]"
        >
          {text.v1.cancel}
        </button>
      </div>
    </div>
  );
}
