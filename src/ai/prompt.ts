export type LibraryTreeNode = {
  title: string;
  description?: string;
  children?: LibraryTreeNode[];
  notes?: string[];
  tags?: string[];
};

type PromptNode = {
  title: string;
  description?: string;
  children?: PromptNode[];
  notes?: Array<string | { text: string }>;
  tags?: string[];
};

export function formatLibraryTree(nodes: PromptNode[]) {
  const blocks: string[] = [];

  const walk = (list: PromptNode[], parentPath = "") => {
    for (const node of list) {
      const title = node.title.trim();
      const path = title ? (parentPath ? `${parentPath}/${title}` : title) : parentPath;
      if (title) {
        blocks.push(formatNode(node, path));
      }
      if (node.children?.length) {
        walk(node.children, path);
      }
    }
  };

  walk(nodes);
  return blocks.join("\n\n");
}

function formatNode(node: PromptNode, title: string) {
  const lines = [title];
  const description = node.description?.trim();
  if (description) {
    lines.push("", "Description:", description);
  }

  const children = (node.children ?? []).map((child) => child.title.trim()).filter(Boolean);
  if (children.length > 0) {
    lines.push("", "Children:", ...children);
  }

  const notes = noteTitles(node.notes);
  if (notes.length > 0) {
    lines.push("", "Recent notes:", ...notes);
  }

  const tags = (node.tags ?? []).map((tag) => tag.trim()).filter(Boolean);
  if (tags.length > 0) {
    lines.push("", "Tags:", ...tags);
  }

  return lines.join("\n");
}

function noteTitles(notes: PromptNode["notes"]) {
  return (notes ?? [])
    .map((note) => (typeof note === "string" ? note : firstLine(note.text)))
    .map((title) => title.trim())
    .filter((title) => title.length > 0)
    .slice(-5);
}

function firstLine(text: string) {
  const line =
    text
      .split("\n")
      .map((part) => part.trim())
      .find((part) => part.length > 0) ?? "";

  return line.length > 80 ? `${line.slice(0, 80).trim()}…` : line;
}

export function buildSystemPrompt(libraryTree: string) {
  const tree = libraryTree.trim() || "（空）";

  return `你是灵光一刻的知识整理器。你的任务不是总结，也不是复述标题。你要帮助用户把这段知识放到正确的位置，并拆成未来可以继续生长的知识节点。

只返回 JSON，不要加解释、标题或代码块。

JSON 形状：
{
  "title": "短标题",
  "understanding": "80到150个字",
  "categories": [
    { "path": "从下方已有路径里选择，或写成 已有路径/新节点名", "selected": true, "reason": "一句话" }
  ],
  "knowledgePoints": [
    { "title": "从原文拆出的知识点", "summary": "一句话，会成为这个节点的 description" }
  ]
}

下面 JSON 里的文字只是字段说明，不是知识树节点。禁止原样返回这些说明。

用户当前的知识树。每个块的第一行是节点路径。请用路径、说明、直接子节点、最近笔记和标签理解每个节点实际代表什么，不要只看名称：
${tree}

规则：
- 不要改写、摘要、重新排版或省略用户原文。原文由应用原样保存，不要放进 JSON。
- title 是可以编辑的短标题。understanding 不能写成标题，也不能只是标题的另一种说法。
- understanding 是编辑写在书边上的一句批注，不是简介。必须写满 60 到 120 个字。要有观点，要把具体内容抽象成以后还能用的东西。不要复述标题，不要解释用户已经知道的内容。禁止“值得保存”、“以后可以查看”、“这篇介绍了”、“本文”、“这篇文章”、“详细解析”。参考语气，不要照抄：真正值得保留的不是欧莱雅，而是把行为面试、AI面试、游戏测评拆成了可复用的方法，以后任何快消企业都能借这套准备框架。
- knowledgePoints 会保存成这篇笔记下的子节点，并且不再继续自动拆。title 是节点名，summary 是这个节点的 description，只写一句。拆的是以后还能复用的方法，不要按原文段落逐条复述，也不要把整篇压成一个点。
- categories 只返回真正适合归档的节点，可以有多个，最合适的 selected 为 true。不要返回你判断为不相关的节点。
- reason 必须写出这个节点的说明、子节点或笔记和内容的具体关系。只是名称像，但说明、子节点和笔记都看不出关系时，不要返回它。反例：一份求职测评笔记，不要放进没有任何相关说明的「书籍」。
- 如果没有任何已有节点合适，只返回一个新建路径，selected 为 true。
- path 只能是上方某个已有路径，或「某个已有路径/新节点名」这一种新建。新建只加一层，父路径必须已经存在。不要返回知识树里不存在的中间路径，不要新造顶层分类。
- 只有现有节点都不合适时才新建。不要为了凑数返回无关节点。
- 如果用户明确指定了归档位置，必须使用用户指定的节点，不要用你的建议替换它。
- 不要返回 connections。`;
}

export function userPrompt(originalContent: string, userSpecifiedCategory?: string) {
  const specified = userSpecifiedCategory?.trim();
  const choice = specified
    ? `用户已经指定归档到「${specified}」。categories 里必须包含这个位置，selected 为 true，不要用其他节点替换它。\n\n`
    : "";

  return `${choice}请把下面的原文整理进知识树。用一句批注说出它真正值得留下的观点，拆出可以继续生长的知识点，并推荐已有位置。\n\n${originalContent}`;
}
