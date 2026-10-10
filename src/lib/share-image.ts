import { getAsset } from "@/lib/moments";
import type { Asset, Moment } from "@/lib/model";

export const SHARE_WIDTH = 1080;
export const SHARE_PAGE_HEIGHT = 4096;

const PADDING = 72;
const CONTENT_WIDTH = SHARE_WIDTH - PADDING * 2;
const TITLE_SIZE = 64;
const TEXT_SIZE = 42;
const TITLE_LINE = 84;
const TEXT_LINE = 68;
const BLOCK_GAP = 36;

export type DrawItem =
  | { kind: "title"; text: string }
  | { kind: "text"; text: string }
  | { kind: "image"; assetId: string };

export function momentDrawItems(moment: Moment): DrawItem[] {
  const items: DrawItem[] = [];
  const title = moment.title?.trim();
  if (title) {
    items.push({ kind: "title", text: moment.title ?? title });
  }
  for (const block of moment.blocks) {
    if (block.type === "text") {
      items.push({ kind: "text", text: block.text });
    } else {
      items.push({ kind: "image", assetId: block.assetId });
    }
  }
  return items;
}

export function paginateHeights(heights: number[], pageLimit: number) {
  const pages: number[][] = [];
  let current: number[] = [];
  let used = 0;
  heights.forEach((height, index) => {
    const item = Math.min(height, pageLimit);
    if (current.length > 0 && used + item > pageLimit) {
      pages.push(current);
      current = [];
      used = 0;
    }
    current.push(index);
    used += item;
  });
  if (current.length > 0) {
    pages.push(current);
  }
  return pages;
}

export async function renderMomentFiles(moment: Moment) {
  const assets = new Map<string, Asset>();
  for (const block of moment.blocks) {
    if (block.type !== "image" || assets.has(block.assetId)) {
      continue;
    }
    const asset = await getAsset(block.assetId);
    if (!asset) {
      throw new Error("missing image");
    }
    assets.set(block.assetId, asset);
  }
  const pages = await drawPages(moment, assets);
  const name = fileStem(moment.title);
  return pages.map((blob, index) => {
    const suffix = pages.length > 1 ? `-${index + 1}` : "";
    return new File([blob], `${name}${suffix}.png`, { type: "image/png" });
  });
}

export async function deliverFiles(files: File[]) {
  if (canShareFiles(files)) {
    try {
      await navigator.share({ files });
      return "shared" as const;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return "cancelled" as const;
      }
    }
  }
  saveFiles(files);
  return "saved" as const;
}

function canShareFiles(files: File[]) {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function" || typeof navigator.canShare !== "function") {
    return false;
  }
  try {
    return navigator.canShare({ files });
  } catch {
    return false;
  }
}

function saveFiles(files: File[]) {
  for (const file of files) {
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
}

async function drawPages(moment: Moment, assets: Map<string, Asset>) {
  const measure = document.createElement("canvas").getContext("2d");
  if (!measure) {
    throw new Error("canvas");
  }
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }
  const images = new Map<string, ImageBitmap>();
  for (const [id, asset] of assets) {
    images.set(id, await createImageBitmap(asset.blob));
  }
  const slices = layoutSlices(measure, momentDrawItems(moment), images);
  const contentLimit = SHARE_PAGE_HEIGHT - PADDING * 2;
  const pages = paginateHeights(
    slices.map((slice) => slice.height + BLOCK_GAP),
    contentLimit,
  );
  const blobs: Blob[] = [];
  for (const indexes of pages) {
    const height = Math.min(
      SHARE_PAGE_HEIGHT,
      PADDING * 2 + indexes.reduce((sum, index) => sum + slices[index].height + BLOCK_GAP, 0) - BLOCK_GAP,
    );
    const canvas = document.createElement("canvas");
    canvas.width = SHARE_WIDTH;
    canvas.height = Math.max(PADDING * 2, height);
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("canvas");
    }
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#171717";
    context.textBaseline = "top";
    let top = PADDING;
    for (const index of indexes) {
      slices[index].draw(context, top);
      top += slices[index].height + BLOCK_GAP;
    }
    blobs.push(await canvasToPng(canvas));
  }
  for (const image of images.values()) {
    image.close();
  }
  return blobs;
}

function layoutSlices(
  measure: CanvasRenderingContext2D,
  items: DrawItem[],
  images: Map<string, ImageBitmap>,
) {
  const contentLimit = SHARE_PAGE_HEIGHT - PADDING * 2;
  const slices: { height: number; draw: (context: CanvasRenderingContext2D, top: number) => void }[] = [];
  for (const item of items) {
    if (item.kind === "image") {
      const image = images.get(item.assetId);
      if (!image) {
        throw new Error("missing image");
      }
      const scale = Math.min(CONTENT_WIDTH / image.width, contentLimit / image.height, 1);
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      slices.push({
        height,
        draw(context, top) {
          context.drawImage(image, PADDING, top, width, height);
        },
      });
      continue;
    }
    const size = item.kind === "title" ? TITLE_SIZE : TEXT_SIZE;
    const lineHeight = item.kind === "title" ? TITLE_LINE : TEXT_LINE;
    measure.font = `${item.kind === "title" ? 600 : 400} ${size}px "PingFang SC", sans-serif`;
    const lines = item.text.length === 0 ? [""] : wrapText(measure, item.text, CONTENT_WIDTH);
    for (const line of lines) {
      const text = line;
      slices.push({
        height: lineHeight,
        draw(context, top) {
          context.font = `${item.kind === "title" ? 600 : 400} ${size}px "PingFang SC", sans-serif`;
          context.fillStyle = "#171717";
          context.fillText(text, PADDING, top);
        },
      });
    }
  }
  return slices;
}

function wrapText(measure: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (paragraph.length === 0) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const char of paragraph) {
      const next = line + char;
      if (line && measure.measureText(next).width > maxWidth) {
        lines.push(line);
        line = char;
      } else {
        line = next;
      }
    }
    lines.push(line);
  }
  return lines;
}

function canvasToPng(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("png"));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}

function fileStem(title: string | undefined) {
  const cleaned = (title ?? "")
    .trim()
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "")
    .slice(0, 40)
    .trim();
  return cleaned || "moment";
}
