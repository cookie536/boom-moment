import { asStorageError, getDatabase } from "@/lib/db";
import { createId } from "@/lib/id";
import { normalizeSourceIds, type Boom, type BoomLink, type Moment } from "@/lib/model";

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

export class BoomSourceError extends Error {
  constructor() {
    super("need two sources");
    this.name = "BoomSourceError";
  }
}

export function orderedEnds(leftId: string, rightId: string) {
  if (leftId === rightId) {
    throw new BoomSelfLinkError();
  }
  return leftId < rightId ? { aId: leftId, bId: rightId } : { aId: rightId, bId: leftId };
}

export function buildBoom(sourceMomentIds: readonly string[], resultMomentId?: string, createdAt = new Date().toISOString()) {
  const sources = normalizeSourceIds(sourceMomentIds.map((id) => id.trim()));
  if (sources.length < 2) {
    throw new BoomSourceError();
  }
  if (resultMomentId && sources.includes(resultMomentId)) {
    throw new BoomSelfLinkError();
  }
  const boom: Boom = {
    id: createId(),
    sourceMomentIds: sources,
    createdAt,
    ...(resultMomentId ? { resultMomentId } : {}),
  };
  return boom;
}

export async function listLinks() {
  const database = await getDatabase();
  return (await database.getAll("boomLinks")).sort(compareCreated);
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
  return [...byId.values()].sort(compareCreated);
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
    await settle(tx);
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

export async function getBoom(id: string) {
  const database = await getDatabase();
  return (await database.get("booms", id)) ?? null;
}

export async function listBooms() {
  const database = await getDatabase();
  return (await database.getAll("booms")).sort(compareCreated);
}

export async function boomsFor(momentId: string) {
  const database = await getDatabase();
  const [asSource, asResult] = await Promise.all([
    database.getAllFromIndex("booms", "by-source", momentId),
    database.getAllFromIndex("booms", "by-result", momentId),
  ]);
  const byId = new Map<string, Boom>();
  for (const boom of [...asSource, ...asResult]) {
    byId.set(boom.id, boom);
  }
  return [...byId.values()].sort(compareCreated);
}

export async function createBoom(sourceMomentIds: readonly string[]) {
  const boom = buildBoom(sourceMomentIds);
  const database = await getDatabase();
  const tx = database.transaction(["moments", "booms"], "readwrite");
  try {
    for (const sourceId of boom.sourceMomentIds) {
      if (!(await tx.objectStore("moments").get(sourceId))) {
        throw new BoomMissingMomentError();
      }
    }
    await tx.objectStore("booms").put(boom);
    await tx.done;
  } catch (error) {
    await settle(tx);
    if (error instanceof BoomMissingMomentError || error instanceof BoomSourceError) {
      throw error;
    }
    throw asStorageError(error);
  }
  return boom;
}

export async function deleteBoom(id: string) {
  const database = await getDatabase();
  try {
    await database.delete("booms", id);
  } catch (error) {
    throw asStorageError(error);
  }
}

function compareCreated<T extends { createdAt: string; id: string }>(a: T, b: T) {
  if (a.createdAt !== b.createdAt) {
    return a.createdAt < b.createdAt ? 1 : -1;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

async function settle(tx: { abort: () => void; done: Promise<unknown> }) {
  try {
    tx.abort();
  } catch {
    // The transaction already failed closed.
  }
  try {
    await tx.done;
  } catch {
    // Abort rejects the transaction. The caller throws the original error.
  }
}
