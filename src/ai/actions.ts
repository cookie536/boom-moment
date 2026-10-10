"use server";

import { formatLibraryTree, type LibraryTreeNode } from "@/ai/prompt";
import { analyzeIdea as analyzeWithProvider } from "@/ai/providers/qwen";
import { initialLibraryNodes } from "@/lib/library-tree";
import type { IdeaAnalysis, OriginalContent } from "@/ai/types";

export async function analyzeIdea(
  originalContent: OriginalContent,
  userSpecifiedCategory?: string,
  libraryNodes?: LibraryTreeNode[],
): Promise<IdeaAnalysis> {
  try {
    const libraryTree = formatLibraryTree(libraryNodes ?? initialLibraryNodes);
    const analysis = await analyzeWithProvider(originalContent, userSpecifiedCategory, libraryTree);

    return {
      title: analysis.title,
      understanding: analysis.understanding,
      categories: analysis.categories,
      knowledgePoints: analysis.knowledgePoints,
      originalContent,
    };
  } catch (error) {
    console.error(error instanceof Error ? error.message : "analyzeIdea failed");
    throw new Error("analyzeIdea failed");
  }
}
