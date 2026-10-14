import type { IDBPTransaction } from "idb";
import { BoomMissingMomentError, BoomSelfLinkError, BoomSourceError, boomsFor, buildBoom } from "@/lib/boom";
import { asStorageError, getDatabase, type BoomDB } from "@/lib/db";
import type { Asset, Boom, ContentBlock, Moment } from "@/lib/model";
import { momentMatches, sortMoments } from "@/lib/model";
import { SpaceMissingError } from "@/lib/spaces";

type WriteStores = ["moments", "assets"] | ["moments", "assets", "booms"] | ["moments", "assets", "boomLinks", "booms"];
type WriteTx = IDBPTransaction<BoomDB, WriteStores, "readwrite">;

export async function listMoments() {
  const database = await getDatabase();
  return sortMoments(await database.getAll("moments"));
}

export async function getMoment(id: string) {
  const database = await getDatabase();
  return (await database.get("moments", id)) ?? null;
}

export async function getAsset(id: string) {
  const database = await getDatabase();
  return (await database.get("assets", id)) ?? null;
}

export async function searchMoments(query: string) {
  const moments = await listMoments();
  return moments.filter((moment) => momentMatches(moment, query));
}

export async function countLinks(momentId: string) {
  const database = await getDatabase();
  const [asA, asB] = await Promise.all([
    database.getAllFromIndex("boomLinks", "by-a", momentId),
    database.getAllFromIndex("boomLinks", "by-b", momentId),
  ]);
  const ids = new Set([...asA, ...asB].map((link) => link.id));
  return ids.size;
}

export async function countBooms(momentId: string) {
  return (await boomsFor(momentId)).length;
}

export async function createMoment(input: {
  id: string;
  title?: string;
  blocks: ContentBlock[];
  assets: Asset[];
  spaceId?: string | null;
  linkTo?: readonly string[];
}) {
  const spaceId = input.spaceId ?? null;
  const database = await getDatabase();
  if (spaceId && !(await database.get("spaces", spaceId))) {
    throw new SpaceMissingError();
  }

  const now = new Date().toISOString();
  const moment: Moment = {
    id: input.id,
    blocks: input.blocks,
    spaceId,
    createdAt: now,
    updatedAt: now,
    ...(input.title?.trim() ? { title: input.title.trim() } : {}),
  };

  const boom = input.linkTo && input.linkTo.length > 0 ? buildBoom(input.linkTo, moment.id, now) : null;
  await writeMoment(database, moment, input.assets, boom);

  return moment;
}

async function writeMoment(
  database: Awaited<ReturnType<typeof getDatabase>>,
  moment: Moment,
  assets: Asset[],
  boom: Boom | null,
) {
  const tx = boom
    ? database.transaction(["moments", "assets", "booms"], "readwrite")
    : database.transaction(["moments", "assets"], "readwrite");
  try {
    if (boom) {
      for (const sourceId of boom.sourceMomentIds) {
        if (!(await tx.objectStore("moments").get(sourceId))) {
          throw new BoomMissingMomentError();
        }
      }
    }
    for (const asset of assets) {
      await tx.objectStore("assets").put(asset);
    }
    await tx.objectStore("moments").put(moment);
    if (boom) {
      await tx.objectStore("booms").put(boom);
    }
    await tx.done;
  } catch (error) {
    await settle(tx);
    if (
      error instanceof BoomMissingMomentError ||
      error instanceof BoomSelfLinkError ||
      error instanceof BoomSourceError
    ) {
      throw error;
    }
    throw asStorageError(error);
  }
}

export async function updateMoment(input: {
  id: string;
  title?: string;
  blocks: ContentBlock[];
  assets: Asset[];
  removedAssetIds: string[];
  spaceId?: string | null;
}) {
  const database = await getDatabase();
  const existing = await database.get("moments", input.id);
  if (!existing) {
    throw new Error("Moment 不存在");
  }

  const spaceId = input.spaceId === undefined ? existing.spaceId : input.spaceId;
  if (spaceId && !(await database.get("spaces", spaceId))) {
    throw new SpaceMissingError();
  }

  const moment: Moment = {
    id: existing.id,
    blocks: input.blocks,
    spaceId,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
    ...(input.title?.trim() ? { title: input.title.trim() } : {}),
  };

  const tx = database.transaction(["moments", "assets"], "readwrite");
  try {
    for (const asset of input.assets) {
      await tx.objectStore("assets").put(asset);
    }
    await tx.objectStore("moments").put(moment);
    for (const assetId of input.removedAssetIds) {
      const used = await assetIsReferenced(tx, assetId, moment.blocks, moment.id);
      if (!used) {
        await tx.objectStore("assets").delete(assetId);
      }
    }
    await tx.done;
  } catch (error) {
    throw asStorageError(error);
  }

  return moment;
}

export async function moveMoment(id: string, spaceId: string | null) {
  const database = await getDatabase();
  const existing = await database.get("moments", id);
  if (!existing) {
    throw new Error("Moment 不存在");
  }
  if (spaceId && !(await database.get("spaces", spaceId))) {
    throw new SpaceMissingError();
  }
  if (existing.spaceId === spaceId) {
    return existing;
  }

  const moment: Moment = { ...existing, spaceId, updatedAt: new Date().toISOString() };
  try {
    await database.put("moments", moment);
  } catch (error) {
    throw asStorageError(error);
  }
  return moment;
}

export async function deleteMoment(id: string) {
  const database = await getDatabase();
  const existing = await database.get("moments", id);
  if (!existing) {
    return;
  }

  const tx = database.transaction(["moments", "assets", "boomLinks", "booms"], "readwrite");
  try {
    const [asA, asB] = await Promise.all([
      tx.objectStore("boomLinks").index("by-a").getAll(id),
      tx.objectStore("boomLinks").index("by-b").getAll(id),
    ]);
    for (const link of [...asA, ...asB]) {
      await tx.objectStore("boomLinks").delete(link.id);
    }
    await detachFromBooms(tx, id);
    await tx.objectStore("moments").delete(id);
    const imageIds = existing.blocks
      .filter((block) => block.type === "image")
      .map((block) => block.assetId);
    for (const assetId of imageIds) {
      const used = await assetIsReferenced(tx, assetId, [], id);
      if (!used) {
        await tx.objectStore("assets").delete(assetId);
      }
    }
    await tx.done;
  } catch (error) {
    await settle(tx);
    throw asStorageError(error);
  }
}

async function detachFromBooms(
  tx: IDBPTransaction<BoomDB, ["moments", "assets", "boomLinks", "booms"], "readwrite">,
  momentId: string,
) {
  const boomStore = tx.objectStore("booms");
  const [asSource, asResult] = await Promise.all([
    boomStore.index("by-source").getAll(momentId),
    boomStore.index("by-result").getAll(momentId),
  ]);
  const byId = new Map<string, Boom>();
  for (const boom of [...asSource, ...asResult]) {
    byId.set(boom.id, boom);
  }
  for (const boom of byId.values()) {
    const sourceMomentIds = boom.sourceMomentIds.filter((sourceId) => sourceId !== momentId);
    const resultMomentId = boom.resultMomentId === momentId ? undefined : boom.resultMomentId;
    if (sourceMomentIds.length < 2) {
      await boomStore.delete(boom.id);
      continue;
    }
    const next: Boom = {
      id: boom.id,
      sourceMomentIds,
      createdAt: boom.createdAt,
      ...(resultMomentId ? { resultMomentId } : {}),
    };
    await boomStore.put(next);
  }
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

async function assetIsReferenced(
  tx: WriteTx,
  assetId: string,
  currentBlocks: ContentBlock[],
  currentId: string,
) {
  if (currentBlocks.some((block) => block.type === "image" && block.assetId === assetId)) {
    return true;
  }
  const moments = await tx.objectStore("moments").getAll();
  return moments.some(
    (moment) =>
      moment.id !== currentId &&
      moment.blocks.some((block) => block.type === "image" && block.assetId === assetId),
  );
}
