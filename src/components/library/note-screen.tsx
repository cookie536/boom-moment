"use client";

import { ChevronLeft, FileText, Plus } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useLibraryTree } from "@/components/library/library-provider";
import { BottomTabBar } from "@/components/navigation/bottom-tab-bar";
import { text } from "@/constants/text";
import { findNode, readingSections, type KnowledgeSection, type SectionContent } from "@/lib/library-tree";
import { cn } from "@/lib/utils";

export function NodeDetailScreen() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const {
    nodes,
    editingSectionId,
    editingContentId,
    onAddSection,
    onCommitSection,
    onCancelSection,
    onAddContent,
    onCommitContent,
    onCancelContent,
  } = useLibraryTree();
  const node = findNode(nodes, id);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [readingId, setReadingId] = useState<string | null>(null);

  const sections = node ? readingSections(node) : [];
  const selected = sections.find((section) => section.id === selectedId) ?? sections[0] ?? null;
  const contentCount = sections.reduce((sum, section) => sum + section.contents.length, 0);
  const reading = selected?.contents.find((content) => content.id === readingId) ?? null;

  useEffect(() => {
    if (editingSectionId) {
      setSelectedId(editingSectionId);
    }
  }, [editingSectionId]);

  if (!node) {
    return (
      <div className="mx-auto min-h-dvh w-full max-w-lg px-6 pt-6">
        <BackButton onClick={() => router.push("/library")} />
        <p className="mt-10 text-[17px] text-neutral-500">{text.missingNode}</p>
        <BottomTabBar />
      </div>
    );
  }

  if (reading && selected) {
    return (
      <div className="mx-auto min-h-dvh w-full max-w-lg">
        <header className="px-6 pt-6">
          <BackButton onClick={() => setReadingId(null)} />
        </header>
        <main className="px-6 pt-8 pb-32">
          <p className="text-[13px] text-neutral-400">{selected.title}</p>
          <article className="mt-4 text-[17px] leading-relaxed whitespace-pre-wrap text-neutral-950">
            {reading.text}
          </article>
        </main>
        <BottomTabBar />
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-dvh w-full max-w-lg">
      <header className="px-6 pt-6">
        <BackButton onClick={() => router.back()} />
        <h1 className="mt-8 text-[34px] leading-tight font-semibold tracking-[-0.03em] text-neutral-950">
          {node.title}
        </h1>
        <p className="mt-2 text-[15px] text-neutral-400">{text.detailMeta(contentCount, sections.length)}</p>
      </header>
      <main className="pt-8 pb-32">
        <div className="flex gap-3 overflow-x-auto px-6 pb-1">
          {sections.map((section) => (
            <SectionCard
              key={section.id}
              section={section}
              selected={section.id === selected?.id}
              editing={section.id === editingSectionId}
              onSelect={() => {
                setSelectedId(section.id);
                setReadingId(null);
              }}
              onCommit={(title) => onCommitSection(node.id, section.id, title)}
              onCancel={() => onCancelSection(node.id, section.id)}
              submitOnEnter
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => onAddSection(node.id)}
          className="mt-3 ml-6 inline-flex min-h-11 items-center gap-1 text-[15px] text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300"
        >
          <Plus className="size-4" aria-hidden="true" />
          {text.addSection}
        </button>

        {selected ? (
          <section className="mt-8 px-6">
            <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-neutral-950">{selected.title}</h2>
            <p className="mt-1 text-[13px] text-neutral-400">{text.contentCount(selected.contents.length)}</p>
            <ul className="mt-4 flex flex-col gap-3">
              {selected.contents.map((content) => (
                <li key={content.id}>
                  {content.id === editingContentId ? (
                    <div className="rounded-2xl bg-white px-4 ring-1 ring-black/5">
                      <DraftField
                        initialValue={content.text}
                        placeholder={text.contentPlaceholder}
                        label={text.contentPlaceholder}
                        onCommit={(value) => onCommitContent(node.id, selected.id, content.id, value)}
                        onCancel={() => onCancelContent(node.id, selected.id, content.id)}
                      />
                    </div>
                  ) : (
                    <ContentCard content={content} onOpen={() => setReadingId(content.id)} />
                  )}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => onAddContent(node.id, selected.id)}
              className="mt-4 flex min-h-11 w-full items-center justify-center gap-1 text-[15px] text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300"
            >
              <Plus className="size-4" aria-hidden="true" />
              {text.addContent}
            </button>
          </section>
        ) : null}
      </main>
      <BottomTabBar />
    </div>
  );
}

function SectionCard({
  section,
  selected,
  editing,
  onSelect,
  onCommit,
  onCancel,
  submitOnEnter,
}: {
  section: KnowledgeSection;
  selected: boolean;
  editing: boolean;
  onSelect: () => void;
  onCommit: (title: string) => void;
  onCancel: () => void;
  submitOnEnter?: boolean;
}) {
  if (editing) {
    return (
      <div className="w-[104px] shrink-0 rounded-2xl bg-white px-3 ring-2 ring-neutral-950">
        <FileText className="mt-3 size-5 text-neutral-700" aria-hidden="true" />
        <DraftField
          initialValue={section.title}
          placeholder={text.sectionName}
          label={text.sectionName}
          onCommit={onCommit}
          onCancel={onCancel}
          submitOnEnter={submitOnEnter}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex w-[104px] shrink-0 flex-col items-start rounded-2xl bg-white px-3 py-3 text-left ring-1 ring-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300",
        selected && "ring-2 ring-neutral-950",
      )}
    >
      <FileText className="size-5 text-neutral-700" aria-hidden="true" />
      <span className="mt-3 line-clamp-2 text-[15px] leading-snug font-medium text-neutral-950">
        {section.title}
      </span>
      <span className="mt-1 text-[13px] text-neutral-400">{section.contents.length}</span>
    </button>
  );
}

function ContentCard({ content, onOpen }: { content: SectionContent; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-2xl bg-white px-4 py-4 text-left ring-1 ring-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300"
    >
      <p className="line-clamp-3 text-[16px] leading-relaxed text-neutral-950">{content.text}</p>
      {content.createdAt ? <p className="mt-3 text-[13px] text-neutral-400">{content.createdAt}</p> : null}
    </button>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 text-[17px] text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300"
    >
      <ChevronLeft className="size-5" aria-hidden="true" />
      {text.back}
    </button>
  );
}

function DraftField({
  initialValue,
  placeholder,
  label,
  onCommit,
  onCancel,
  submitOnEnter = false,
}: {
  initialValue: string;
  placeholder: string;
  label: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
  submitOnEnter?: boolean;
}) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const cancelingRef = useRef(false);
  const committedRef = useRef(false);
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;

  function commit(raw: string) {
    if (cancelingRef.current || committedRef.current) {
      return;
    }

    committedRef.current = true;
    onCommitRef.current(raw);
  }

  useEffect(() => {
    const field = inputRef.current;
    field?.focus();
    field?.scrollIntoView({ block: "nearest" });

    return () => {
      const next = field?.value.trim() ?? "";
      if (!next || cancelingRef.current || committedRef.current) {
        return;
      }

      committedRef.current = true;
      onCommitRef.current(next);
    };
  }, []);

  return (
    <textarea
      ref={inputRef}
      value={value}
      rows={2}
      placeholder={placeholder}
      aria-label={label}
      onChange={(event) => setValue(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter" && submitOnEnter && !event.shiftKey) {
          event.preventDefault();
          commit(event.currentTarget.value);
        }
        if (event.key === "Escape") {
          event.preventDefault();
          cancelingRef.current = true;
          onCancel();
        }
      }}
      onBlur={(event) => commit(event.currentTarget.value)}
      className="mt-2 w-full resize-none bg-transparent py-2 text-[15px] leading-snug text-neutral-950 caret-neutral-950 placeholder:text-neutral-400 focus:outline-none"
    />
  );
}
