"use client";

import { useEffect, useRef, useState } from "react";
import { text } from "@/constants/text";

export function NameDialog({
  title,
  initial = "",
  onCancel,
  onConfirm,
}: {
  title: string;
  initial?: string;
  onCancel: () => void;
  onConfirm: (name: string) => void;
}) {
  const [value, setValue] = useState(initial);
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

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:items-center">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="space-name-title"
        className="w-full max-w-sm rounded-[14px] bg-white p-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (name) {
            onConfirm(name);
          }
        }}
      >
        <h2 id="space-name-title" className="text-[18px] font-semibold text-[#171717]">
          {title}
        </h2>
        <input
          ref={inputRef}
          value={value}
          maxLength={40}
          aria-label={text.v1.spaceName}
          placeholder={text.v1.spaceName}
          onChange={(event) => setValue(event.target.value)}
          className="mt-4 w-full rounded-[14px] border border-[#EAEAEA] px-3 py-3 text-[16px] text-[#171717] outline-none"
        />
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 flex-1 rounded-[14px] border border-[#EAEAEA] text-[15px] text-[#171717]"
          >
            {text.v1.cancel}
          </button>
          <button
            type="submit"
            disabled={!name}
            className="min-h-11 flex-1 rounded-[14px] bg-[#171717] text-[15px] text-white disabled:bg-[#EAEAEA] disabled:text-[#8A8A8E]"
          >
            {text.v1.save}
          </button>
        </div>
      </form>
    </div>
  );
}
