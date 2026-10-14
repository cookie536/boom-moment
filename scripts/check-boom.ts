import "fake-indexeddb/auto";
import {
  BoomDuplicateLinkError,
  BoomMissingMomentError,
  BoomSelfLinkError,
  BoomSourceError,
  boomsFor,
  createBoom,
  createLink,
  deleteBoom,
  deleteLink,
  linksFor,
  listBooms,
  listLinks,
} from "../src/lib/boom";
import { DATABASE_NAME, DATABASE_VERSION, getDatabase } from "../src/lib/db";
import { createMoment, deleteMoment, getMoment, moveMoment } from "../src/lib/moments";
import { createSpace, deleteSpace } from "../src/lib/spaces";

async function main() {
  await seedVersion1();
  const upgraded = await getDatabase();
  const legacy = await upgraded.get("boomLinks", "legacy-link");
  const indexTx = upgraded.transaction("booms");
  const boomIndex = indexTx.store.indexNames;
  if (
    upgraded.version !== DATABASE_VERSION ||
    !upgraded.objectStoreNames.contains("moments") ||
    !upgraded.objectStoreNames.contains("boomLinks") ||
    !upgraded.objectStoreNames.contains("booms") ||
    !boomIndex.contains("by-source") ||
    !boomIndex.contains("by-result") ||
    !legacy ||
    legacy.aId !== "moment-a" ||
    legacy.bId !== "moment-b" ||
    (await upgraded.getAll("booms")).length !== 0
  ) {
    throw new Error("version 1 upgrade did not keep the old link or failed to add booms");
  }
  await indexTx.done;
  await upgraded.delete("boomLinks", "legacy-link");

  const first = await createMoment({
    id: "moment-a",
    title: "甲",
    blocks: [{ id: "text-a", type: "text", text: "甲的正文" }],
    assets: [],
  });
  const second = await createMoment({
    id: "moment-b",
    title: "乙",
    blocks: [{ id: "text-b", type: "text", text: "乙的正文" }],
    assets: [],
  });

  let rejectedSelf = false;
  try {
    await createLink(first.id, first.id);
  } catch (error) {
    rejectedSelf = error instanceof BoomSelfLinkError;
  }
  if (!rejectedSelf) {
    throw new Error("a moment was allowed to link to itself");
  }

  const link = await createLink(second.id, first.id);
  if (link.aId !== first.id || link.bId !== second.id) {
    throw new Error("link ends were not stored in sorted order");
  }

  let rejectedDuplicate = false;
  try {
    await createLink(first.id, second.id);
  } catch (error) {
    rejectedDuplicate = error instanceof BoomDuplicateLinkError;
  }
  if (!rejectedDuplicate || (await listLinks()).length !== 1) {
    throw new Error("the same pair was stored twice");
  }

  const space = await createSpace({ id: "space-boom", name: "房间" });
  await moveMoment(first.id, space.id);
  await deleteSpace(space.id);
  const afterSpaceDelete = await getMoment(first.id);
  if ((await listLinks()).length !== 1 || afterSpaceDelete?.blocks[0]?.type !== "text") {
    throw new Error("deleting a space changed the boom link or the moment");
  }

  await deleteLink(link.id);
  if ((await linksFor(first.id)).length !== 0) {
    throw new Error("unlinking left the connection behind");
  }

  const beforeCancel = await listBooms();
  const previewIds = [second.id, first.id];
  if (beforeCancel.length !== 0 || previewIds.length !== 2) {
    throw new Error("previewing sources wrote a boom");
  }

  const created = await createMoment({
    id: "moment-c",
    title: "丙",
    blocks: [{ id: "text-c", type: "text", text: "新想法" }],
    assets: [],
    linkTo: [first.id, second.id],
  });
  const createdBooms = await boomsFor(created.id);
  if (
    createdBooms.length !== 1 ||
    createdBooms[0]?.resultMomentId !== created.id ||
    createdBooms[0].sourceMomentIds.join(",") !== `${first.id},${second.id}` ||
    (await linksFor(created.id)).length !== 0 ||
    (await listLinks()).length !== 0
  ) {
    throw new Error("the new moment was not saved as one boom result");
  }

  let rejectedPartial = false;
  try {
    await createMoment({
      id: "moment-d",
      blocks: [{ id: "text-d", type: "text", text: "不该留下" }],
      assets: [],
      linkTo: [first.id, first.id],
    });
  } catch (error) {
    rejectedPartial = error instanceof BoomSourceError;
  }
  if (!rejectedPartial || (await getMoment("moment-d")) || (await listBooms()).length !== 1) {
    throw new Error("a failed boom create left a moment or an extra boom behind");
  }

  let rejectedMissing = false;
  try {
    await createMoment({
      id: "moment-missing",
      blocks: [{ id: "text-missing", type: "text", text: "来源不在" }],
      assets: [],
      linkTo: [first.id, "missing-moment"],
    });
  } catch (error) {
    rejectedMissing = error instanceof BoomMissingMomentError;
  }
  if (!rejectedMissing || (await getMoment("moment-missing")) || (await listBooms()).length !== 1) {
    throw new Error("a missing source left a moment or a boom behind");
  }

  const third = await createMoment({
    id: "moment-e",
    title: "丁",
    blocks: [{ id: "text-e", type: "text", text: "第三条" }],
    assets: [],
  });
  const fourth = await createMoment({
    id: "moment-f",
    title: "戊",
    blocks: [{ id: "text-f", type: "text", text: "第四条" }],
    assets: [],
  });
  const fifth = await createMoment({
    id: "moment-g",
    title: "己",
    blocks: [{ id: "text-g", type: "text", text: "第五条" }],
    assets: [],
  });
  const pair = await createBoom([second.id, first.id]);
  const triple = await createBoom([third.id, first.id, second.id]);
  const quadruple = await createBoom([fourth.id, third.id, second.id, first.id]);
  const quintuple = await createBoom([fifth.id, fourth.id, first.id, third.id, second.id]);
  const again = await createBoom([first.id, second.id]);
  if (
    pair.sourceMomentIds.join(",") !== `${first.id},${second.id}` ||
    triple.sourceMomentIds.length !== 3 ||
    quadruple.sourceMomentIds.length !== 4 ||
    quintuple.sourceMomentIds.length !== 5 ||
    pair.id === again.id ||
    again.sourceMomentIds.join(",") !== pair.sourceMomentIds.join(",") ||
    (await listLinks()).length !== 0
  ) {
    throw new Error("multi-source booms were split, capped, or blocked as duplicates");
  }
  if (
    (await boomsFor(first.id)).length < 4 ||
    (await boomsFor(fifth.id)).some((item) => item.id === quintuple.id) === false
  ) {
    throw new Error("a source could not find the boom it belongs to");
  }

  await deleteBoom(quintuple.id);
  if (
    (await getMoment(fifth.id))?.title !== "己" ||
    (await boomsFor(fifth.id)).some((item) => item.id === quintuple.id)
  ) {
    throw new Error("removing a boom deleted a moment or left the boom behind");
  }

  await deleteMoment(created.id);
  const afterResultDelete = await boomsFor(first.id);
  const kept = afterResultDelete.find((item) => item.id === createdBooms[0]?.id);
  if (
    (await getMoment(created.id)) ||
    !kept ||
    kept.resultMomentId ||
    kept.sourceMomentIds.join(",") !== `${first.id},${second.id}` ||
    !(await getMoment(second.id))
  ) {
    throw new Error("deleting the result removed the boom or another moment");
  }

  await deleteMoment(fourth.id);
  const afterSourceDelete = (await listBooms()).find((item) => item.id === quadruple.id);
  if (
    (await getMoment(fourth.id)) ||
    !afterSourceDelete ||
    afterSourceDelete.sourceMomentIds.length !== 3 ||
    afterSourceDelete.sourceMomentIds.includes(fourth.id) ||
    !(await getMoment(third.id))
  ) {
    throw new Error("deleting one source removed the whole boom or another moment");
  }

  const onlyTwo = await createBoom([fifth.id, first.id]);
  await deleteMoment(fifth.id);
  if (
    (await listBooms()).some((item) => item.id === onlyTwo.id) ||
    (await getMoment(fifth.id)) ||
    !(await getMoment(first.id))
  ) {
    throw new Error("a boom with fewer than two sources was kept, or another moment was deleted");
  }

  const originalPut = IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put = function put(this: IDBObjectStore, ...args: Parameters<IDBObjectStore["put"]>) {
    if (this.name === "booms") {
      throw new Error("boom write failed");
    }
    return originalPut.apply(this, args);
  };
  let rolledBack = false;
  try {
    await createMoment({
      id: "moment-rollback",
      blocks: [{ id: "text-rollback", type: "text", text: "应该回滚" }],
      assets: [],
      linkTo: [first.id, second.id],
    });
  } catch {
    rolledBack = true;
  } finally {
    IDBObjectStore.prototype.put = originalPut;
  }
  if (!rolledBack || (await getMoment("moment-rollback")) || (await listBooms()).some((item) => item.resultMomentId === "moment-rollback")) {
    throw new Error("a failed boom transaction left a moment or a boom behind");
  }

  console.log("boom checks passed");
}

function seedVersion1() {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      const moments = database.createObjectStore("moments", { keyPath: "id" });
      moments.createIndex("by-updated", "updatedAt");
      moments.createIndex("by-space", "spaceId");
      const spaces = database.createObjectStore("spaces", { keyPath: "id" });
      spaces.createIndex("by-parent", "parentId");
      const links = database.createObjectStore("boomLinks", { keyPath: "id" });
      links.createIndex("by-a", "aId");
      links.createIndex("by-b", "bId");
      database.createObjectStore("assets", { keyPath: "id" });
      database.createObjectStore("meta", { keyPath: "key" });
      links.add({
        id: "legacy-link",
        aId: "moment-a",
        bId: "moment-b",
        createdAt: "2026-10-01T00:00:00.000Z",
      });
    };
    request.onsuccess = () => {
      request.result.close();
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

void main();
