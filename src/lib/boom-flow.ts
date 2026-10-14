import { BoomSourceError } from "@/lib/boom";
import { displayTitle, type Boom, type Moment } from "@/lib/model";
import { uniqueIds } from "@/lib/boom-selection";

export type BoomDraftBlock =
  | { id: string; type: "text"; text: string }
  | { id: string; type: "image"; assetId: string; alt?: string; blob: Blob; mimeType: string };

export type BoomDraft = {
  title: string;
  spaceId: string | null;
  blocks: BoomDraftBlock[];
};

let currentDraft: BoomDraft | null = null;

export function readBoomDraft() {
  return currentDraft;
}

export function writeBoomDraft(draft: BoomDraft) {
  currentDraft = draft;
}

export function clearBoomDraft() {
  currentDraft = null;
}

export function sourcesForSave(ids: readonly string[]) {
  const sources = uniqueIds(ids);
  if (sources.length < 2) {
    throw new BoomSourceError();
  }
  return sources;
}

export function momentDraftHasContent(input: { title: string; texts: readonly string[]; images: number }) {
  return input.title.trim().length > 0 || input.texts.some((text) => text.trim().length > 0) || input.images > 0;
}

export function boomHistoryTitle(boom: Pick<Boom, "sourceMomentIds" | "resultMomentId">, moments: readonly Moment[]) {
  const titleFor = (id: string) => {
    const moment = moments.find((item) => item.id === id);
    return moment ? displayTitle(moment) : "";
  };
  if (boom.resultMomentId) {
    const title = titleFor(boom.resultMomentId);
    if (title) {
      return title;
    }
  }
  return boom.sourceMomentIds.map(titleFor).filter(Boolean).join(" × ");
}

export function createSubmitLock() {
  let pending = false;
  return {
    async run<T>(task: () => Promise<T>) {
      if (pending) {
        return undefined;
      }
      pending = true;
      try {
        return await task();
      } finally {
        pending = false;
      }
    },
  };
}
