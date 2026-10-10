"use client";

import { Image, Link, Mic, Send } from "lucide-react";
import { useCaptureFlow } from "@/components/capture/capture-flow";
import { text } from "@/constants/text";
import { cn } from "@/lib/utils";

const tools = [
  { label: text.photo, icon: Image },
  { label: text.voice, icon: Mic },
  { label: text.link, icon: Link },
] as const;

export function CaptureComposer() {
  const { draft, setDraft, analyze, pending, error } = useCaptureFlow();
  const canSend = draft.trim().length > 0 && !pending;

  return (
    <section
      aria-label={text.captureIdea}
      className="rounded-[28px] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-black/5"
    >
      <textarea
        rows={5}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder={text.placeholder}
        aria-label={text.placeholder}
        className="min-h-40 w-full resize-none bg-transparent text-[17px] leading-relaxed text-neutral-950 placeholder:text-neutral-400 selection:bg-neutral-200 selection:text-neutral-950 focus:outline-none"
      />
      <div className="mt-2 grid grid-cols-4 gap-2 border-t border-neutral-100 pt-3">
        {tools.map(({ label, icon: Icon }) => (
          <button
            key={label}
            type="button"
            className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-medium text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 active:bg-neutral-100"
          >
            <Icon className="size-5" strokeWidth={1.75} aria-hidden="true" />
            {label}
          </button>
        ))}
        <button
          type="button"
          onClick={analyze}
          disabled={!canSend}
          aria-disabled={!canSend}
          className={cn(
            "flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300",
            canSend
              ? "bg-neutral-950 text-white active:bg-neutral-800"
              : "bg-neutral-200 text-neutral-400",
          )}
        >
          <Send className="size-5" strokeWidth={1.75} aria-hidden="true" />
          {text.send}
        </button>
      </div>
      {error ? <p className="mt-3 px-1 text-[15px] text-neutral-500">{error}</p> : null}
    </section>
  );
}
