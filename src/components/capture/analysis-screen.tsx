"use client";

import { ChevronDown, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useCaptureFlow } from "@/components/capture/capture-flow";
import { useLibraryTree } from "@/components/library/library-provider";
import { BottomTabBar } from "@/components/navigation/bottom-tab-bar";
import { characterCount, text } from "@/constants/text";
import { cn } from "@/lib/utils";

export function AnalysisScreen() {
  const router = useRouter();
  const { analysis, clearCapture } = useCaptureFlow();
  const { saveCapture } = useLibraryTree();
  const [title, setTitle] = useState(analysis?.title ?? "");
  const [picked, setPicked] = useState<string[]>(
    () => analysis?.categories.filter((category) => category.selected).map((category) => category.path) ?? [],
  );
  const [showSource, setShowSource] = useState(false);
  const [phase, setPhase] = useState<"boom" | "saved" | null>(null);
  const [savedTo, setSavedTo] = useState("");
  const titleRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!analysis && phase === null) {
      router.replace("/");
    }
  }, [analysis, phase, router]);

  useEffect(() => {
    const field = titleRef.current;
    if (!field) {
      return;
    }

    field.style.height = "auto";
    field.style.height = `${field.scrollHeight}px`;
  }, [title]);

  useEffect(() => {
    if (phase === "boom") {
      const timer = window.setTimeout(() => setPhase("saved"), 900);
      return () => window.clearTimeout(timer);
    }

    if (phase === "saved") {
      const timer = window.setTimeout(() => {
        clearCapture();
        router.push("/library");
      }, 1200);
      return () => window.clearTimeout(timer);
    }
  }, [clearCapture, phase, router]);

  if (!analysis) {
    return null;
  }

  const canSave = picked.length > 0 && title.trim().length > 0 && phase === null;

  function toggleCategory(name: string) {
    const pinned = analysis?.categories.some((category) => category.path === name && category.pinned);
    setPicked((current) => {
      if (current.includes(name)) {
        return pinned ? current : current.filter((item) => item !== name);
      }
      return [...current, name];
    });
  }

  function save() {
    if (!canSave || !analysis) {
      return;
    }

    const capture = {
      title,
      description: analysis.originalContent,
      notes: [analysis.understanding],
      knowledgePoints: analysis.knowledgePoints,
    };
    const labels = picked.map((path) => saveCapture(path, capture));
    setSavedTo(labels.join("和"));
    setPhase("boom");
  }

  return (
    <div className="mx-auto min-h-dvh w-full max-w-lg">
      <header className="px-6 pt-6">
        <Link href="/" className="inline-flex items-center gap-1 text-[17px] text-neutral-500">
          <ChevronLeft className="size-5" aria-hidden="true" />
          {text.back}
        </Link>
      </header>
      <main className="px-6 pt-10 pb-48">
        <section>
          <label className="block">
            <span className="text-[13px] font-medium text-neutral-400">{text.suggestedTitle}</span>
            <textarea
              ref={titleRef}
              rows={1}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              aria-label={text.suggestedTitle}
              className="mt-3 w-full resize-none overflow-hidden bg-transparent text-[28px] leading-tight font-semibold tracking-[-0.03em] text-neutral-950 focus:outline-none"
            />
          </label>
        </section>

        <section className="mt-14">
          <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-neutral-950">
            {text.aiUnderstanding}
          </h2>
          <p className="mt-4 text-[17px] leading-relaxed text-neutral-600">{analysis.understanding}</p>
        </section>

        <section className="mt-14">
          <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-neutral-950">
            {text.suggestedLibrary}
          </h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {analysis.categories.map((category) => {
              const selected = picked.includes(category.path);

              return (
                <li key={category.path}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleCategory(category.path)}
                    className={cn(
                      "inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-4 text-[15px] text-neutral-950 ring-1 ring-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300",
                      selected && "ring-2 ring-neutral-950",
                    )}
                  >
                    <span className={selected ? "text-neutral-950" : "text-neutral-300"} aria-hidden="true">
                      {selected ? "✓" : "○"}
                    </span>
                    {nodeName(category.path)}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="mt-14">
          <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-neutral-950">
            {text.boomConnections}
          </h2>
          <ul className="mt-4 -mx-6 flex gap-3 overflow-x-auto px-6 pb-1">
            {([] as { title: string }[]).map((idea) => (
              <li
                key={idea.title}
                className="flex min-h-28 w-40 shrink-0 items-end rounded-2xl bg-white px-4 py-4 text-[17px] leading-snug text-neutral-950 ring-1 ring-black/5"
              >
                {idea.title}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-14">
          <button
            type="button"
            aria-expanded={showSource}
            onClick={() => setShowSource((current) => !current)}
            className="flex min-h-[56px] w-full items-center justify-between rounded-2xl bg-white px-5 text-left text-[17px] text-neutral-950 ring-1 ring-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300"
          >
            {text.original(characterCount(analysis.originalContent))}
            <ChevronDown
              className={cn("size-4 text-neutral-400 transition-transform", showSource && "rotate-180")}
              aria-hidden="true"
            />
          </button>
          {showSource ? (
            <p className="mt-4 px-1 text-[17px] leading-relaxed whitespace-pre-wrap text-neutral-600">
              {analysis.originalContent}
            </p>
          ) : null}
        </section>
      </main>
      <div className="fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 px-5">
        <div className="mx-auto max-w-lg">
          <button
            type="button"
            onClick={save}
            disabled={!canSave}
            className={cn(
              "flex h-14 w-full items-center justify-center rounded-2xl text-[17px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300",
              canSave ? "bg-neutral-950 text-white active:bg-neutral-800" : "bg-neutral-200 text-neutral-400",
            )}
          >
            {text.plant}
          </button>
        </div>
      </div>
      <BottomTabBar />
      {phase ? <SaveMoment phase={phase} category={savedTo} /> : null}
    </div>
  );
}

function nodeName(path: string) {
  const parts = path.split("/").map((part) => part.trim()).filter(Boolean);
  return parts.at(-1) ?? path;
}

function SaveMoment({ phase, category }: { phase: "boom" | "saved"; category: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-100 px-8">
      {phase === "boom" ? (
        <p className="boom-mark text-center text-[64px] leading-none font-semibold tracking-[-0.04em] text-neutral-950">
          {text.planted}
        </p>
      ) : (
        <p className="saved-line text-center text-[28px] leading-tight font-semibold tracking-[-0.03em] text-neutral-950">
          {text.savedTo(category)}
        </p>
      )}
    </div>
  );
}
