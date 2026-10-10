import "fake-indexeddb/auto";
import { BoomDuplicateLinkError, BoomSelfLinkError, createLink, deleteLink, linksFor, listLinks } from "../src/lib/boom";
import { createMoment, deleteMoment, getMoment, moveMoment } from "../src/lib/moments";
import { createSpace, deleteSpace } from "../src/lib/spaces";

async function main() {
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

  const created = await createMoment({
    id: "moment-c",
    title: "丙",
    blocks: [{ id: "text-c", type: "text", text: "新想法" }],
    assets: [],
    linkTo: [first.id, second.id],
  });
  const createdLinks = await linksFor(created.id);
  if (createdLinks.length !== 2 || (await linksFor(first.id)).length !== 1 || (await linksFor(second.id)).length !== 1) {
    throw new Error("the new moment was not linked to both sources");
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
    rejectedPartial = error instanceof BoomSelfLinkError;
  }
  if (!rejectedPartial || (await getMoment("moment-d"))) {
    throw new Error("a failed boom create left a moment behind");
  }

  await deleteMoment(created.id);
  if ((await getMoment(created.id)) || (await linksFor(first.id)).length !== 0 || !(await getMoment(second.id))) {
    throw new Error("deleting a moment left a link or removed the other moment");
  }

  console.log("boom checks passed");
}

void main();
