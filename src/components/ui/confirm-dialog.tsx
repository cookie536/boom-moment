"use client";

import { useEffect, useRef } from "react";

export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  cancelLabel,
  danger = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
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
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="w-full max-w-sm rounded-[14px] bg-[#FBF8F4] p-5"
      >
        <h2 id="confirm-title" className="text-[18px] font-semibold text-[#2C2825]">
          {title}
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-[#6F675F]">{body}</p>
        <div className="mt-5 flex gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="min-h-11 flex-1 rounded-[14px] border border-[#E7E0D6] text-[15px] text-[#2C2825]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={
              danger
                ? "min-h-11 flex-1 rounded-[14px] bg-[#2C2825] text-[15px] text-[#F7F4EF]"
                : "min-h-11 flex-1 rounded-[14px] bg-[#2C2825] text-[15px] text-[#F7F4EF]"
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
