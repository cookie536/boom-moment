export type Title = string;

export type Understanding = string;

export type OriginalContent = string;

export type CategorySuggestion = {
  path: string;
  selected: boolean;
  reason: string;
  pinned?: boolean;
};

export type Categories = CategorySuggestion[];

export type KnowledgePoint = {
  title: string;
  summary: string;
};

export type IdeaAnalysis = {
  title: Title;
  understanding: Understanding;
  categories: Categories;
  knowledgePoints: KnowledgePoint[];
  originalContent: OriginalContent;
};
