import type { IdeaAnalysis, OriginalContent } from "@/ai/types";

export type AnalyzeIdeaInput = {
  originalContent: OriginalContent;
};

export interface IdeaAnalyzer {
  analyze(input: AnalyzeIdeaInput): Promise<IdeaAnalysis>;
}
