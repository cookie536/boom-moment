import { asStorageError, getDatabase } from "@/lib/db";
import { createId } from "@/lib/id";
import type { BoomLink, Moment } from "@/lib/model";

export class BoomSelfLinkError extends Error {
  constructor() {
    super("self link");
    this.name = "BoomSelfLinkError";
  }
}

export class BoomDuplicateLinkError extends Error {
  constructor() {
    super("duplicate link");
    this.name = "BoomDuplicateLinkError";
  }
}

export class BoomMissingMomentError extends Error {
  constructor() {
    super("missing moment");
    this.name = "BoomMissingMomentError";
  }
}

export function orderedEnds(leftId: string, rightId: string) {
  if (leftId === rightId) {
    throw new BoomSelfLinkError();
  }
  return leftId < rightId ? { aId: leftId, bId: rightId } : { aId: rightId, bId: leftId };
}

export async function listLinks() {
  const database = await getDatabase();
  return (await database.getAll("boomLinks")).sort(compareLinks);
}

export async function linksFor(momentId: string) {
  const database = await getDatabase();
  const [asA, asB] = await Promise.all([
    database.getAllFromIndex("boomLinks", "by-a", momentId),
    database.getAllFromIndex("boomLinks", "by-b", momentId),
  ]);
  const byId = new Map<string, BoomLink>();
  for (const link of [...asA, ...asB]) {
    byId.set(link.id, link);
  }
  return [...byId.values()].sort(compareLinks);
}

export async function relatedMoments(momentId: string) {
  const links = await linksFor(momentId);
  const database = await getDatabase();
  const rows: { link: BoomLink; moment: Moment | null }[] = [];
  for (const link of links) {
    const otherId = link.aId === momentId ? link.bId : link.aId;
    rows.push({ link, moment: (await database.get("moments", otherId)) ?? null });
  }
  return rows;
}

export async function createLink(leftId: string, rightId: string) {
  const ends = orderedEnds(leftId, rightId);
  const database = await getDatabase();
  const [left, right] = await Promise.all([database.get("moments", leftId), database.get("moments", rightId)]);
  if (!left || !right) {
    throw new BoomMissingMomentError();
  }

  const link: BoomLink = {
    id: createId(),
    aId: ends.aId,
    bId: ends.bId,
    createdAt: new Date().toISOString(),
  };
  const tx = database.transaction("boomLinks", "readwrite");
  try {
    const existing = await tx.store.index("by-a").getAll(ends.aId);
    if (existing.some((item) => item.bId === ends.bId)) {
      throw new BoomDuplicateLinkError();
    }
    await tx.store.put(link);
    await tx.done;
  } catch (error) {
    if (error instanceof BoomDuplicateLinkError) {
      throw error;
    }
    throw asStorageError(error);
  }
  return link;
}

export async function deleteLink(id: string) {
  const database = await getDatabase();
  try {
    await database.delete("boomLinks", id);
  } catch (error) {
    throw asStorageError(error);
  }
}

export async function linksForNewMoment(momentId: string, linkTo: readonly [string, string] | undefined) {
  if (!linkTo) {
    return [];
  }
  const [leftId, rightId] = linkTo;
  if (leftId === rightId || leftId === momentId || rightId === momentId) {
    throw new BoomSelfLinkError();
  }

  const database = await getDatabase();
  const [left, right] = await Promise.all([database.get("moments", leftId), database.get("moments", rightId)]);
  if (!left || !right) {
    throw new BoomMissingMomentError();
  }

  const now = new Date().toISOString();
  const links = [leftId, rightId].map((otherId) => {
    const ends = orderedEnds(momentId, otherId);
    return { id: createId(), aId: ends.aId, bId: ends.bId, createdAt: now } satisfies BoomLink;
  });

  for (const link of links) {
    const existing = await database.getAllFromIndex("boomLinks", "by-a", link.aId);
    if (existing.some((item) => item.bId === link.bId)) {
      throw new BoomDuplicateLinkError();
    }
  }
  return links;
}

function compareLinks(a: BoomLink, b: BoomLink) {
  if (a.createdAt !== b.createdAt) {
    return a.createdAt < b.createdAt ? 1 : -1;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
