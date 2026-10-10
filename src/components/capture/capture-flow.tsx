"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { AI, type IdeaAnalysis } from "@/ai";
import { useLibraryTree } from "@/components/library/library-provider";
import { text } from "@/constants/text";
import type { LibraryTreeNode } from "@/ai/prompt";
import type { LibraryNode } from "@/lib/library-tree";

type CaptureFlowContextValue = {
  draft: string;
  setDraft: (value: string) => void;
  analysis: IdeaAnalysis | null;
  pending: boolean;
  error: string | null;
  analyze: () => void;
  clearCapture: () => void;
};

const CaptureFlowContext = createContext<CaptureFlowContextValue | null>(null);

export function CaptureFlowProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { nodes } = useLibraryTree();
  const [draft, setDraft] = useState("");
  const [analysis, setAnalysis] = useState<IdeaAnalysis | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const value = useMemo<CaptureFlowContextValue>(
    () => ({
      draft,
      setDraft,
      analysis,
      pending,
      error,
      analyze: () => {
        const originalContent = draft;
        if (!originalContent.trim() || pending) {
          return;
        }

        setPending(true);
        setError(null);
        void AI.analyzeIdea(originalContent, undefined, outline(nodes))
          .then((result) => {
            setAnalysis(result);
            router.push("/capture/analysis");
          })
          .catch(() => {
            setError(text.analyzeFailed);
          })
          .finally(() => {
            setPending(false);
          });
      },
      clearCapture: () => {
        setDraft("");
        setAnalysis(null);
      },
    }),
    [analysis, draft, error, nodes, pending, router],
  );

  return <CaptureFlowContext.Provider value={value}>{children}</CaptureFlowContext.Provider>;
}

function outline(nodes: LibraryNode[]): LibraryTreeNode[] {
  return nodes.map((node) => ({
    title: node.title,
    description: node.description,
    notes: recentNoteTitles(node.notes),
    tags: nodeTags(node),
    children: outline(node.children),
  }));
}

function recentNoteTitles(notes: { text: string }[]) {
  return notes
    .map((note) => firstLine(note.text))
    .filter((title) => title.length > 0)
    .slice(-5);
}

function firstLine(text: string) {
  const line = text
    .split("\n")
    .map((part) => part.trim())
    .find((part) => part.length > 0) ?? "";

  return line.length > 80 ? `${line.slice(0, 80).trim()}…` : line;
}

function nodeTags(node: LibraryNode) {
  const tags = (node as LibraryNode & { tags?: unknown }).tags;
  if (!Array.isArray(tags)) {
    return undefined;
  }

  const names = tags
    .filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0)
    .map((tag) => tag.trim());

  return names.length > 0 ? names : undefined;
}

export function useCaptureFlow() {
  const context = useContext(CaptureFlowContext);
  if (!context) {
    throw new Error("useCaptureFlow must be used within CaptureFlowProvider");
  }
  return context;
}
