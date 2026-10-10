import type { IDBPTransaction } from "idb";
import { asStorageError, getDatabase, type BoomDB } from "@/lib/db";
import type { Asset, ContentBlock, Moment } from "@/lib/model";
import { momentMatches, sortMoments } from "@/lib/model";
import { linksForNewMoment } from "@/lib/boom";
import type { BoomLink } from "@/lib/model";
import { SpaceMissingError } from "@/lib/spaces";

type WriteTx = IDBPTransaction<BoomDB, ["moments", "assets"] | ["moments", "assets", "boomLinks"], "readwrite">;

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

export async function createMoment(input: {
  id: string;
  title?: string;
  blocks: ContentBlock[];
  assets: Asset[];
  spaceId?: string | null;
  linkTo?: readonly [string, string];
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

  const links = await linksForNewMoment(input.id, input.linkTo);
  if (links.length > 0) {
    await writeMoment(database, moment, input.assets, links);
  } else {
    await writeMoment(database, moment, input.assets);
  }

  return moment;
}

async function writeMoment(
  database: Awaited<ReturnType<typeof getDatabase>>,
  moment: Moment,
  assets: Asset[],
  links?: BoomLink[],
) {
  const tx = links
    ? database.transaction(["moments", "assets", "boomLinks"], "readwrite")
    : database.transaction(["moments", "assets"], "readwrite");
  try {
    for (const asset of assets) {
      await tx.objectStore("assets").put(asset);
    }
    await tx.objectStore("moments").put(moment);
    if (links) {
      for (const link of links) {
        await tx.objectStore("boomLinks").put(link);
      }
    }
    await tx.done;
  } catch (error) {
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

  const tx = database.transaction(["moments", "assets", "boomLinks"], "readwrite");
  try {
    const [asA, asB] = await Promise.all([
      tx.objectStore("boomLinks").index("by-a").getAll(id),
      tx.objectStore("boomLinks").index("by-b").getAll(id),
    ]);
    for (const link of [...asA, ...asB]) {
      await tx.objectStore("boomLinks").delete(link.id);
    }
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
    throw asStorageError(error);
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
