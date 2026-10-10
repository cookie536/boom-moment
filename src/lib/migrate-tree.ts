import { createId } from "@/lib/id";
import type { LibraryNode } from "@/lib/library-tree";
import type { ContentBlock, Moment, Space } from "@/lib/model";

// Converts an in-memory v0 tree into Spaces and Moments.
// Do not call this on startup. An empty install must stay empty.
export function migrateLibraryTree(nodes: LibraryNode[], now = new Date().toISOString()) {
  const spaces: Space[] = [];
  const moments: Moment[] = [];

  const walk = (list: LibraryNode[], parentSpaceId: string | null) => {
    for (const node of list) {
      if (node.origin === "AIGeneratedKnowledgePoint") {
        continue;
      }

      const blocks = blocksFor(node);
      const children = node.children.filter((child) => child.origin !== "AIGeneratedKnowledgePoint");

      if (children.length > 0) {
        const space: Space = {
          id: node.id,
          name: node.title.trim() || "未命名",
          parentId: parentSpaceId,
          createdAt: now,
          updatedAt: now,
        };
        spaces.push(space);
        if (blocks.length > 0) {
          moments.push(toMoment(createId(), node, blocks, space.id, now));
        }
        walk(children, space.id);
        continue;
      }

      if (blocks.length > 0) {
        moments.push(toMoment(node.id, node, blocks, parentSpaceId, now));
      }
    }
  };

  walk(nodes, null);
  return { spaces, moments };
}

function blocksFor(node: LibraryNode): ContentBlock[] {
  const seen = new Set<string>();
  const blocks: ContentBlock[] = [];

  const push = (id: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed || seen.has(trimmed)) {
      return;
    }
    seen.add(trimmed);
    blocks.push({ id, type: "text", text: trimmed });
  };

  const sectionTexts = node.sections.flatMap((section) => section.contents);
  if (sectionTexts.length > 0) {
    for (const content of sectionTexts) {
      push(content.id, content.text);
    }
  } else if (node.description?.trim()) {
    push(createId(), node.description);
  }

  for (const child of node.children) {
    if (child.origin !== "AIGeneratedKnowledgePoint") {
      continue;
    }
    const extra = child.sections.flatMap((section) => section.contents.map((content) => content.text.trim())).filter(Boolean);
    const description = child.description?.trim();
    const pieces = extra.length > 0 ? extra : description ? [description] : [];
    for (const piece of pieces) {
      if (seen.has(piece) || [...seen].some((item) => item.includes(piece))) {
        continue;
      }
      const titled = child.title.trim() ? `${child.title.trim()}\n${piece}` : piece;
      push(createId(), titled);
    }
  }

  return blocks;
}

function toMoment(id: string, node: LibraryNode, blocks: ContentBlock[], spaceId: string | null, fallback: string): Moment {
  const stamps = node.sections
    .flatMap((section) => section.contents.map((content) => content.createdAt))
    .map((value) => displayDateToIso(value))
    .filter((value): value is string => Boolean(value))
    .sort();

  return {
    id,
    ...(node.title.trim() ? { title: node.title.trim() } : {}),
    blocks,
    spaceId,
    createdAt: stamps[0] ?? fallback,
    updatedAt: stamps[stamps.length - 1] ?? fallback,
  };
}

function displayDateToIso(value: string) {
  const match = /^(\d{4})\.(\d{2})\.(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}
