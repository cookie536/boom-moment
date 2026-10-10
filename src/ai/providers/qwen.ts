import OpenAI from "openai";
import { text } from "@/constants/text";
import { buildSystemPrompt, userPrompt } from "@/ai/prompt";
import type { Categories, KnowledgePoint, Title, Understanding } from "@/ai/types";

const QWEN_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1";
const QWEN_MODEL = "qwen-turbo";

export type ProviderAnalysis = {
  title: Title;
  understanding: Understanding;
  categories: Categories;
  knowledgePoints: KnowledgePoint[];
};

export async function analyzeIdea(
  originalContent: string,
  userSpecifiedCategory?: string,
  libraryTree = "",
): Promise<ProviderAnalysis> {
  const specified = userSpecifiedCategory?.trim() || explicitCategory(originalContent) || undefined;
  const client = createClient();
  const completion = await client.chat.completions.create({
    model: QWEN_MODEL,
    messages: [
      { role: "system", content: buildSystemPrompt(libraryTree) },
      { role: "user", content: userPrompt(originalContent, specified) },
    ],
    response_format: { type: "json_object" },
  });
  const content = completion.choices[0]?.message?.content ?? "";
  const parsed = parseAnalysis(content);
  const paths = existingPaths(libraryTree);

  return {
    title: parsed.title || text.untitled,
    understanding: parsed.understanding || text.understandings.default,
    categories: pinUserCategory(keepCategories(parsed.categories, paths), specified),
    knowledgePoints: parsed.knowledgePoints,
  };
}

function createClient() {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    throw new Error("DASHSCOPE_API_KEY is not set");
  }

  return new OpenAI({
    apiKey,
    baseURL: QWEN_BASE_URL,
  });
}

function parseAnalysis(content: string): ProviderAnalysis {
  const json = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const parsed = JSON.parse(json) as {
    title?: unknown;
    understanding?: unknown;
    categories?: unknown;
    knowledgePoints?: unknown;
  };

  return {
    title: typeof parsed.title === "string" ? parsed.title.trim() : "",
    understanding: typeof parsed.understanding === "string" ? parsed.understanding.trim() : "",
    categories: normalizeCategories(parsed.categories),
    knowledgePoints: normalizeKnowledgePoints(parsed.knowledgePoints),
  };
}

function normalizeCategories(value: unknown): Categories {
  if (!Array.isArray(value)) {
    return [];
  }

  const categories: Categories = [];

  for (const item of value) {
    if (typeof item === "string" && item.trim()) {
      categories.push({ path: item.trim(), selected: false, reason: "" });
      continue;
    }
    if (!item || typeof item !== "object") {
      continue;
    }

    const record = item as { path?: unknown; name?: unknown; selected?: unknown; reason?: unknown; pinned?: unknown };
    const path = typeof record.path === "string" ? record.path.trim() : "";
    const name = typeof record.name === "string" ? record.name.trim() : "";
    const chosen = path || name;
    if (!chosen) {
      continue;
    }

    categories.push({
      path: chosen,
      selected: record.selected === true,
      reason: typeof record.reason === "string" ? record.reason.trim() : "",
      pinned: record.pinned === true,
    });
  }

  return categories;
}

function normalizeKnowledgePoints(value: unknown): KnowledgePoint[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const points: KnowledgePoint[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const record = item as { title?: unknown; summary?: unknown };
    if (typeof record.title !== "string" || !record.title.trim()) {
      continue;
    }
    points.push({
      title: record.title.trim(),
      summary: typeof record.summary === "string" ? record.summary.trim() : "",
    });
  }

  return points;
}

function existingPaths(libraryTree: string) {
  const paths = new Set<string>();
  for (const block of libraryTree.split("\n\n")) {
    const path = block.split("\n")[0]?.trim();
    if (path) {
      paths.add(path);
    }
  }
  return paths;
}

function keepCategories(categories: Categories, paths: Set<string>): Categories {
  if (paths.size === 0) {
    return categories;
  }

  const kept = categories.filter(
    (category) => categoryFits(category.path, paths) && !rejectsCategory(category.reason),
  );
  if (kept.length === 0 || kept.some((category) => category.selected)) {
    return kept;
  }

  return kept.map((category, index) => ({ ...category, selected: index === 0 }));
}

function rejectsCategory(reason: string) {
  return /无关|不相关|没有直接|无直接|不适合|但非|并不/.test(reason);
}

function categoryFits(path: string, paths: Set<string>) {
  if (paths.has(path)) {
    return true;
  }

  const parent = path.split("/").slice(0, -1).join("/");
  return parent.length > 0 && paths.has(parent);
}

function pinUserCategory(categories: Categories, userSpecifiedCategory?: string): Categories {
  const chosen = userSpecifiedCategory?.trim();
  if (!chosen) {
    return categories;
  }

  const matches = (path: string) => path === chosen || path.endsWith(`/${chosen}`);
  const existing = categories.find((category) => matches(category.path));
  const rest = categories
    .filter((category) => !matches(category.path))
    .map((category) => ({ ...category, selected: false, pinned: false }));

  return [
    {
      path: existing?.path ?? chosen,
      selected: true,
      pinned: true,
      reason: existing?.reason ?? "",
    },
    ...rest,
  ];
}

function explicitCategory(source: string) {
  const match = source.match(
    /save this under\s+([a-z][a-z ]{0,40})|(?:放到|放在|放进|归到|归档到|保存到|记到|记在)([^\s，。！？,.!]{1,16})/i,
  );
  const raw = (match?.[1] || match?.[2] || "").trim();
  const name = raw.replace(/(下面|里边|里面|里|下)$/u, "").trim();

  return name || null;
}
