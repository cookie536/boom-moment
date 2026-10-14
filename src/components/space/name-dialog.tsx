"use client";

import { useEffect, useRef, useState } from "react";
import { SpaceBadge } from "@/components/space/space-badge";
import { text } from "@/constants/text";
import { StorageQuotaError } from "@/lib/db";
import { DEFAULT_SPACE_ICON, SPACE_ICON_IDS, type SpaceIcon } from "@/lib/model";
import { SpaceMissingError } from "@/lib/spaces";
import { cn } from "@/lib/utils";

export function NameDialog({
  title,
  initial = "",
  initialIcon = DEFAULT_SPACE_ICON,
  hint,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title: string;
  initial?: string;
  initialIcon?: SpaceIcon;
  hint: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: (name: string, icon: SpaceIcon) => Promise<void>;
}) {
  const [value, setValue] = useState(initial);
  const [icon, setIcon] = useState<SpaceIcon>(initialIcon);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const name = value.trim();

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  async function submit() {
    if (!name || pending) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      await onConfirm(name, icon);
    } catch (caught) {
      setPending(false);
      setError(
        caught instanceof StorageQuotaError
          ? text.v1.quota
          : caught instanceof SpaceMissingError
            ? text.v1.spaceMissing
            : text.v1.saveError,
      );
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:items-center">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="space-name-title"
        className="max-h-[85dvh] w-full max-w-sm overflow-y-auto rounded-[14px] bg-[#FBF8F4] p-5"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <h2 id="space-name-title" className="text-[18px] font-semibold text-[#2C2825]">
          {title}
        </h2>
        <label className="mt-4 block text-[13px] text-[#8A8178]" htmlFor="space-name-input">
          {text.v1.spaceName}
        </label>
        <input
          id="space-name-input"
          ref={inputRef}
          value={value}
          maxLength={40}
          placeholder={text.v1.spaceName}
          onChange={(event) => setValue(event.target.value)}
          className="mt-2 w-full rounded-[14px] border border-[#E7E0D6] px-3 py-3 text-[16px] text-[#2C2825] outline-none focus-visible:ring-2 focus-visible:ring-[#8C7358]"
        />
        <p className="mt-4 text-[13px] text-[#8A8178]">{text.v1.spaceIcon}</p>
        <div role="radiogroup" aria-label={text.v1.spaceIcon} className="mt-2 grid grid-cols-4 gap-2">
          {SPACE_ICON_IDS.map((id) => {
            const selected = id === icon;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={text.v1.spaceIcons[id]}
                onClick={() => setIcon(id)}
                className={cn(
                  "flex min-h-11 items-center justify-center rounded-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8C7358] focus-visible:ring-offset-2",
                  selected ? "ring-2 ring-[#8C7358] ring-offset-2" : "",
                )}
              >
                <SpaceBadge icon={id} />
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-[13px] leading-5 text-[#8A8178]">{hint}</p>
        {error ? <p className="mt-3 text-[14px] text-[#2C2825]">{error}</p> : null}
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 flex-1 rounded-[14px] border border-[#E7E0D6] text-[15px] text-[#2C2825] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8C7358] focus-visible:ring-offset-2"
          >
            {text.v1.cancel}
          </button>
          <button
            type="submit"
            disabled={!name || pending}
            className="min-h-11 flex-1 rounded-[14px] bg-[#2C2825] text-[15px] text-[#F7F4EF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8C7358] focus-visible:ring-offset-2 disabled:bg-[#E7E0D6] disabled:text-[#8A8178]"
          >
            {confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
