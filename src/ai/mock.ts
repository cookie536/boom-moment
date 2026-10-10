import { text } from "@/constants/text";
import type { IdeaAnalyzer } from "@/ai/provider";
import type { Categories, IdeaAnalysis } from "@/ai/types";

const categoryHints: { name: string; hints: string[] }[] = [
  { name: text.categories.writing, hints: ["写作", "writing"] },
  { name: text.categories.books, hints: ["书籍", "books", "book"] },
  { name: text.categories.podcast, hints: ["播客", "podcast"] },
  { name: text.categories.business, hints: ["商业想法", "business ideas", "business"] },
  { name: text.categories.travel, hints: ["旅行", "travel"] },
  { name: text.categories.languages, hints: ["语言", "languages", "language"] },
  { name: text.categories.movies, hints: ["电影", "movies", "movie"] },
  { name: text.categories.education, hints: ["教育", "education"] },
  { name: text.categories.aiProducts, hints: ["ai 产品", "ai产品", "ai products"] },
];

const suggestedCategories: Categories = [
  { path: text.categories.business, selected: true, reason: "" },
  { path: text.categories.aiProducts, selected: true, reason: "" },
  { path: text.categories.education, selected: false, reason: "" },
];

export const mockAnalyzer: IdeaAnalyzer = {
  async analyze({ originalContent }) {
    return buildMockAnalysis(originalContent);
  },
};

function buildMockAnalysis(originalContent: string): IdeaAnalysis {
  const chosen = explicitCategory(originalContent);

  return {
    originalContent,
    title: toTitle(originalContent),
    understanding: understandingFrom(originalContent),
    categories: categoriesFor(chosen),
    knowledgePoints: [],
  };
}

function categoriesFor(chosen: string | null): Categories {
  if (!chosen) {
    return suggestedCategories;
  }

  const rest = suggestedCategories
    .filter((category) => category.path !== chosen)
    .map((category) => ({ ...category, selected: false, pinned: false }));

  return [{ path: chosen, selected: true, pinned: true, reason: "" }, ...rest];
}

function explicitCategory(source: string) {
  const match = source.match(
    /save this under\s+([a-z][a-z ]{0,40})|(?:放到|放在|放进|归到|归档到|保存到|记到|记在)([^\s，。！？,.!]{1,16})/i,
  );
  const raw = (match?.[1] || match?.[2] || "").trim().toLowerCase();
  if (!raw) {
    return null;
  }

  return (
    categoryHints.find((item) =>
      item.hints.some((hint) => raw.includes(hint) || (raw.length >= 2 && hint.startsWith(raw))),
    )?.name ?? null
  );
}

function understandingFrom(source: string) {
  if (/创始|创业|founder|workshop|工作坊/i.test(source)) {
    return text.understandings.founders;
  }
  if (/写作|小说|writing|story/i.test(source)) {
    return text.understandings.writing;
  }
  return text.understandings.default;
}

function toTitle(source: string) {
  const cleaned = source.trim().replace(/\s+/g, " ");
  const sentence = cleaned.split(/[。！？.!?]/)[0]?.trim() || cleaned;
  if (!sentence) {
    return text.untitled;
  }

  if (/[\u4e00-\u9fff]/.test(sentence)) {
    return sentence.length > 16 ? `${sentence.slice(0, 16)}…` : sentence;
  }

  const words = sentence.split(" ").slice(0, 8).join(" ");
  const trimmed = words.length > 52 ? `${words.slice(0, 49).trim()}…` : words;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}
