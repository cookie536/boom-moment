"use client";

import { useEffect, useMemo } from "react";
import { LibrarySearch } from "@/components/library/library-search";
import { LibraryTree } from "@/components/library/library-tree";
import { useLibraryTree } from "@/components/library/library-provider";
import { BottomTabBar } from "@/components/navigation/bottom-tab-bar";
import { text } from "@/constants/text";
import { filterLibraryNodes } from "@/lib/library-tree";

export function LibraryScreen() {
  const { nodes, editingId, query, setQuery, focusNodeId, clearFocusNode } = useLibraryTree();
  const visibleNodes = useMemo(
    () => filterLibraryNodes(nodes, query, editingId),
    [nodes, query, editingId],
  );

  useEffect(() => {
    if (!focusNodeId) {
      return;
    }

    document.getElementById(`library-node-${focusNodeId}`)?.scrollIntoView({
      block: "center",
      behavior: "smooth",
    });
    clearFocusNode();
  }, [clearFocusNode, focusNodeId]);

  return (
    <div className="mx-auto min-h-dvh w-full max-w-lg">
      <header className="px-6 pt-10 pb-5">
        <h1 className="text-[40px] leading-none font-semibold tracking-[-0.03em] text-neutral-950">
          {text.library}
        </h1>
      </header>
      <div className="px-5">
        <LibrarySearch value={query} onChange={setQuery} />
      </div>
      <main className="px-5 pt-5 pb-32">
        {visibleNodes.length === 0 ? (
          <p className="px-2 py-10 text-center text-[15px] text-neutral-400">{text.noMatches}</p>
        ) : (
          <LibraryTree nodes={visibleNodes} />
        )}
      </main>
      <BottomTabBar />
    </div>
  );
}
