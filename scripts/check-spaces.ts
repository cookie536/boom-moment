import "fake-indexeddb/auto";
import { getDatabase } from "../src/lib/db";
import { createMoment, getAsset, getMoment } from "../src/lib/moments";
import { moveMoment } from "../src/lib/moments";
import {
  createSpace,
  deleteSpace,
  getSpace,
  listSpaces,
  moveSpace,
  SpaceCycleError,
} from "../src/lib/spaces";

async function main() {
  const root = await createSpace({ id: "space-a", name: "读书", parentId: null });
  const child = await createSpace({ id: "space-b", name: "小说", parentId: root.id });
  const other = await createSpace({ id: "space-c", name: "写作", parentId: null });

  const stored = await listSpaces();
  if (stored.length !== 3 || stored.find((space) => space.id === child.id)?.parentId !== root.id) {
    throw new Error("nested space did not persist");
  }

  let cycled = false;
  try {
    await moveSpace(root.id, child.id);
  } catch (error) {
    cycled = error instanceof SpaceCycleError;
  }
  if (!cycled || (await getSpace(root.id))?.parentId !== null) {
    throw new Error("cycle check failed");
  }

  const blob = new Blob([Uint8Array.from([9, 8, 7, 6])], { type: "image/png" });
  const moment = await createMoment({
    id: "moment-a",
    title: "章节",
    blocks: [
      { id: "text-a", type: "text", text: "原文还在" },
      { id: "image-a", type: "image", assetId: "asset-a" },
    ],
    assets: [{ id: "asset-a", mimeType: "image/png", blob, createdAt: new Date().toISOString() }],
    spaceId: root.id,
  });
  await createMoment({
    id: "moment-b",
    blocks: [{ id: "text-b", type: "text", text: "另一条" }],
    assets: [],
    spaceId: null,
  });

  const database = await getDatabase();
  await database.put("boomLinks", {
    id: "link-1",
    aId: moment.id,
    bId: "moment-b",
    createdAt: new Date().toISOString(),
  });

  const moved = await moveMoment(moment.id, other.id);
  if (moved.spaceId !== other.id || moved.createdAt !== moment.createdAt || moved.blocks[0]?.type !== "text") {
    throw new Error("move to another space changed the moment");
  }

  const unclassified = await moveMoment(moment.id, null);
  if (unclassified.spaceId !== null) {
    throw new Error("move to unclassified failed");
  }
  await moveMoment(moment.id, child.id);

  const removed = await deleteSpace(child.id);
  const after = await getMoment(moment.id);
  const asset = await getAsset("asset-a");
  const parent = await getSpace(root.id);
  const link = await database.get("boomLinks", "link-1");
  if (
    removed?.parentId !== root.id ||
    after?.spaceId !== root.id ||
    after.blocks[1]?.type !== "image" ||
    after.createdAt !== moment.createdAt ||
    !asset ||
    asset.blob.size !== blob.size ||
    !parent ||
    !link
  ) {
    throw new Error("deleting a space removed moment content, image, or link");
  }

  await deleteSpace(root.id);
  const reparented = await getMoment(moment.id);
  if (reparented?.spaceId !== null || reparented.blocks[0]?.type !== "text" || reparented.blocks[0].text !== "原文还在") {
    throw new Error("root delete did not keep the moment as unclassified");
  }
  if ((await listSpaces()).some((space) => space.id === root.id)) {
    throw new Error("deleted space is still stored");
  }

  console.log("space checks passed");
}

void main();
