"use client";

import { ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useLibraryTree } from "@/components/library/library-provider";
import { text } from "@/constants/text";
import type { LibraryNode as LibraryNodeData } from "@/lib/library-tree";
import { cn } from "@/lib/utils";

type LibraryNodeProps = {
  node: LibraryNodeData;
  depth: number;
};

export function LibraryNode({ node, depth }: LibraryNodeProps) {
  const {
    expandedIds,
    editingId,
    searching,
    onToggle,
    onAdd,
    onCommit,
    onCancel,
    onOpenNote,
  } = useLibraryTree();
  const hasChildren = node.children.length > 0;
  const expanded = hasChildren && (searching || expandedIds.has(node.id));
  const editing = editingId === node.id;

  return (
    <li id={`library-node-${node.id}`}>
      <div
        className="flex min-h-[52px] items-center rounded-2xl bg-white pr-1 ring-1 ring-black/5"
        style={{ marginLeft: depth * 22 }}
      >
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={`${expanded ? text.collapse(node.title || text.untitled) : text.expand(node.title || text.untitled)}`}
          onClick={(event) => {
            event.stopPropagation();
            if (searching || !hasChildren) {
              return;
            }
            onToggle(node.id);
          }}
          className="flex size-11 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300"
        >
          <ChevronRight
            className={cn(
              "size-[18px] transition-transform duration-200",
              expanded ? "rotate-90 text-neutral-700" : "text-neutral-300",
            )}
            strokeWidth={1.75}
            aria-hidden="true"
          />
        </button>
        {editing ? (
          <NodeNameField
            initialTitle={node.title}
            onCommit={(title) => onCommit(node.id, title)}
            onCancel={() => onCancel(node.id)}
          />
        ) : (
          <div className="flex min-w-0 flex-1 items-center">
            <Link
              href={`/library/${node.id}`}
              onClick={(event) => {
                event.stopPropagation();
                onOpenNote();
              }}
              className="max-w-full truncate py-3 text-left text-[17px] leading-snug text-neutral-950"
            >
              {node.title}
            </Link>
          </div>
        )}
        <button
          type="button"
          aria-label={text.addInside(node.title || text.untitled)}
          onClick={(event) => {
            event.stopPropagation();
            onAdd(node.id);
          }}
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 active:bg-neutral-100"
        >
          <Plus className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
      {expanded && hasChildren ? (
        <ul className="mt-2 flex flex-col gap-2">
          {node.children.map((child) => (
            <LibraryNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

type NodeNameFieldProps = {
  initialTitle: string;
  onCommit: (title: string) => void;
  onCancel: () => void;
};

function NodeNameField({ initialTitle, onCommit, onCancel }: NodeNameFieldProps) {
  const [value, setValue] = useState(initialTitle);
  const inputRef = useRef<HTMLInputElement>(null);
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
    const input = inputRef.current;
    input?.focus();
    input?.scrollIntoView({ block: "nearest" });

    return () => {
      const next = input?.value.trim() ?? "";
      if (!next || cancelingRef.current || committedRef.current) {
        return;
      }

      committedRef.current = true;
      onCommitRef.current(next);
    };
  }, []);

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={(event) => setValue(event.target.value)}
      placeholder={text.name}
      aria-label={text.nodeName}
      enterKeyHint="done"
      autoCapitalize="sentences"
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit(event.currentTarget.value);
        }

        if (event.key === "Escape") {
          event.preventDefault();
          cancelingRef.current = true;
          onCancel();
        }
      }}
      onBlur={(event) => {
        commit(event.currentTarget.value);
      }}
      className="min-w-0 flex-1 bg-transparent py-3 text-[17px] leading-snug text-neutral-950 caret-neutral-950 placeholder:text-neutral-400 focus:outline-none"
    />
  );
}
