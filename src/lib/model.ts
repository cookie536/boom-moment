export type Id = string;

export type ContentBlock =
  | { id: Id; type: "text"; text: string }
  | { id: Id; type: "image"; assetId: Id; alt?: string };

export type Moment = {
  id: Id;
  title?: string;
  blocks: ContentBlock[];
  spaceId: Id | null;
  createdAt: string;
  updatedAt: string;
};

export type Space = {
  id: Id;
  name: string;
  parentId: Id | null;
  createdAt: string;
  updatedAt: string;
};

export type BoomLink = {
  id: Id;
  aId: Id;
  bId: Id;
  createdAt: string;
};

export type Asset = {
  id: Id;
  mimeType: string;
  blob: Blob;
  createdAt: string;
};

export type HomeView = "cards" | "list";

export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export function displayTitle(moment: Moment) {
  const title = moment.title?.trim();
  if (title) {
    return title;
  }

  for (const block of moment.blocks) {
    if (block.type !== "text") {
      continue;
    }
    const line = block.text
      .split("\n")
      .map((part) => part.trim())
      .find((part) => part.length > 0);
    if (line) {
      return line;
    }
  }

  return "未命名 Moment";
}

export function previewText(moment: Moment) {
  const texts = moment.blocks
    .filter((block): block is Extract<ContentBlock, { type: "text" }> => block.type === "text")
    .map((block) => block.text.trim())
    .filter(Boolean);

  if (texts.length === 0) {
    return "";
  }

  if (moment.title?.trim()) {
    return texts.join("\n");
  }

  const [first, ...rest] = texts[0].split("\n");
  const afterTitle = [rest.join("\n").trim(), ...texts.slice(1)].filter(Boolean).join("\n");
  if (!first?.trim()) {
    return afterTitle;
  }
  return afterTitle;
}

export function formatWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${date.getFullYear()}.${month}.${day} ${hours}:${minutes}`;
}

export function sortMoments(moments: Moment[]) {
  return [...moments].sort((a, b) => {
    if (a.updatedAt !== b.updatedAt) {
      return a.updatedAt < b.updatedAt ? 1 : -1;
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

export function momentMatches(moment: Moment, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return false;
  }
  if (moment.title?.toLowerCase().includes(needle)) {
    return true;
  }
  return moment.blocks.some(
    (block) => block.type === "text" && block.text.toLowerCase().includes(needle),
  );
}

export function firstImageId(moment: Moment) {
  const image = moment.blocks.find((block) => block.type === "image");
  return image && image.type === "image" ? image.assetId : null;
}
