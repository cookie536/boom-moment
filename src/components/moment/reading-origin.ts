export type ReadingRect = { left: number; top: number; width: number; height: number };

let origin: { id: string; at: number; rect: ReadingRect } | null = null;
let pendingScroll: number | null = null;

export function markReadingOrigin(currentTarget: EventTarget | null, id: string) {
  const node = currentTarget instanceof HTMLElement ? currentTarget.closest("article") : null;
  if (!node) {
    return;
  }
  const rect = node.getBoundingClientRect();
  origin = {
    id,
    at: Date.now(),
    rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
  };
}

export function readingOriginFor(id: string) {
  if (!origin || origin.id !== id || Date.now() - origin.at > 1500) {
    return null;
  }
  return origin.rect;
}

export function rememberReadingScroll(y: number) {
  pendingScroll = y;
}

export function takeReadingScroll() {
  const y = pendingScroll;
  pendingScroll = null;
  return y;
}
