import { readFileSync } from "node:fs";
import { AI } from "../src/ai/index";

loadLocalEnv();

const originalContent = "先放到小说下面。\n石香姑是郑一嫂的历史原型。";

function loadLocalEnv() {
  const text = readFileSync(".env.local", "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separator = trimmed.indexOf("=");
    if (separator < 0) {
      continue;
    }
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

async function main() {
  const key = process.env.DASHSCOPE_API_KEY?.trim();
  console.log(key ? "DASHSCOPE_API_KEY: set" : "DASHSCOPE_API_KEY: missing");
  if (!key) {
    throw new Error("DASHSCOPE_API_KEY is not set");
  }

  const result = await AI.analyzeIdea(originalContent);
  const preserved = result.originalContent === originalContent;

  console.log(
    JSON.stringify(
      {
        preserved,
        title: result.title,
        understanding: result.understanding,
        categories: result.categories,
        knowledgePoints: result.knowledgePoints,
        originalContent: result.originalContent,
      },
      null,
      2,
    ),
  );

  if (!preserved) {
    throw new Error("originalContent was replaced");
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
