import "fake-indexeddb/auto";
import { strToU8, unzipSync, zipSync } from "fflate";
import {
  BackupError,
  applyMerge,
  applyReplace,
  backupFileName,
  encodeBackup,
  exportBackup,
  parseBackup,
  planMerge,
} from "../src/lib/backup";
import { createLink, listLinks } from "../src/lib/boom";
import { readHomeView, writeHomeView } from "../src/lib/db";
import { momentDrawItems, paginateHeights } from "../src/lib/share-image";
import { createMoment, getAsset, getMoment, listMoments, updateMoment } from "../src/lib/moments";
import { createSpace, listSpaces } from "../src/lib/spaces";

const png = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="),
  (char) => char.charCodeAt(0),
);

async function main() {
  const name = backupFileName(new Date(2026, 9, 10, 12, 0, 0));
  if (name !== "BoomMoment-Backup-2026-10-10.zip") {
    throw new Error(`unexpected backup name ${name}`);
  }

  const items = momentDrawItems({
    id: "moment-img",
    title: "带图",
    blocks: [
      { id: "text-1", type: "text", text: "第一段" },
      { id: "image-1", type: "image", assetId: "asset-1" },
      { id: "text-2", type: "text", text: "第二段" },
    ],
    spaceId: null,
    createdAt: "2026-10-10T00:00:00.000Z",
    updatedAt: "2026-10-10T00:00:00.000Z",
  });
  if (
    items.map((item) => item.kind).join(",") !== "title,text,image,text" ||
    items.some((item) => item.kind !== "image" && item.text.includes("未命名"))
  ) {
    throw new Error("share image added or reordered content");
  }
  const pages = paginateHeights([10, 10, 10], 25);
  if (pages.length !== 2 || pages[0].join(",") !== "0,1" || pages[1].join(",") !== "2") {
    throw new Error("long share image was not paginated in order");
  }

  const parent = await createSpace({ id: "space-root", name: "阅读" });
  const child = await createSpace({ id: "space-child", name: "草稿", parentId: parent.id });
  await createMoment({
    id: "moment-img",
    title: "带图",
    spaceId: child.id,
    blocks: [
      { id: "text-1", type: "text", text: "第一段" },
      { id: "image-1", type: "image", assetId: "asset-1" },
      { id: "text-2", type: "text", text: "第二段" },
    ],
    assets: [
      {
        id: "asset-1",
        mimeType: "image/png",
        createdAt: "2026-10-10T00:00:00.000Z",
        blob: new Blob([png], { type: "image/png" }),
      },
    ],
  });
  await createMoment({
    id: "moment-note",
    title: "另一条",
    blocks: [{ id: "text-note", type: "text", text: "用来连接" }],
    assets: [],
  });
  await createLink("moment-img", "moment-note");
  await writeHomeView("list");

  const zip = await exportBackup();
  const archive = await parseBackup(zip);
  if (archive.moments.length !== 2 || archive.spaces.length !== 2 || archive.links.length !== 1 || archive.assets.length !== 1) {
    throw new Error("backup did not contain the library");
  }
  const archivedChild = archive.spaces.find((space) => space.id === child.id);
  if (archivedChild?.parentId !== parent.id || archive.assets[0]?.bytes.length !== png.length) {
    throw new Error("backup lost the space parent or the image");
  }

  await createMoment({
    id: "moment-local",
    title: "只在本机",
    blocks: [{ id: "text-local", type: "text", text: "替换后不该留下" }],
    assets: [],
  });
  await updateMoment({
    id: "moment-img",
    title: "改过的标题",
    blocks: archive.moments.find((moment) => moment.id === "moment-img")?.blocks ?? [],
    assets: [],
    removedAssetIds: [],
  });

  await applyReplace(archive);
  if (await getMoment("moment-local")) {
    throw new Error("replace left a local-only moment behind");
  }
  const restored = await getMoment("moment-img");
  const restoredAsset = await getAsset("asset-1");
  const restoredBytes = new Uint8Array(await restoredAsset!.blob.arrayBuffer());
  const restoredSpaces = await listSpaces();
  const restoredChild = restoredSpaces.find((space) => space.id === child.id);
  if (
    restored?.title !== "带图" ||
    restored.blocks.map((block) => (block.type === "text" ? block.text : block.assetId)).join(",") !== "第一段,asset-1,第二段" ||
    restoredBytes.length !== png.length ||
    restoredBytes.some((byte, index) => byte !== png[index]) ||
    restoredChild?.parentId !== parent.id ||
    (await listLinks()).length !== 1 ||
    (await readHomeView()) !== "list"
  ) {
    throw new Error("replace did not rebuild text, image, spaces, and links");
  }

  await updateMoment({
    id: "moment-img",
    title: "合并时保留",
    blocks: restored.blocks,
    assets: [],
    removedAssetIds: [],
  });
  await createMoment({
    id: "moment-keep",
    title: "合并后还在",
    blocks: [{ id: "text-keep", type: "text", text: "本机新增" }],
    assets: [],
  });
  const conflicted = await planMerge(archive);
  if (conflicted.conflictMoments !== 1 || conflicted.addMoments !== 0) {
    throw new Error("merge did not report the duplicate id");
  }
  await applyMerge(archive, "keep-local");
  if ((await getMoment("moment-img"))?.title !== "合并时保留" || !(await getMoment("moment-keep"))) {
    throw new Error("merge overwrote a conflicting moment or dropped a local one");
  }
  await applyMerge(archive, "use-backup");
  if ((await getMoment("moment-img"))?.title !== "带图" || !(await getMoment("moment-keep"))) {
    throw new Error("using the backup did not update the conflict or removed a different moment");
  }

  const currentLink = (await listLinks())[0];
  const relinked = await encodeBackup({
    ...archive,
    links: [{ ...currentLink, id: "link-other" }],
  });
  await applyMerge(await parseBackup(relinked), "keep-local");
  if ((await listLinks()).some((link) => link.id === "link-other")) {
    throw new Error("merge added a second link for the same pair");
  }
  await applyMerge(await parseBackup(relinked), "use-backup");
  const afterPair = await listLinks();
  if (afterPair.length !== 1 || afterPair[0]?.id !== "link-other") {
    throw new Error("backup link did not replace the same pair");
  }

  const beforeCorrupt = (await listMoments()).length;
  const corruptEntries = unzipSync(zip);
  const momentsFile = corruptEntries["moments.json"];
  if (!momentsFile) {
    throw new Error("backup was missing moments.json");
  }
  momentsFile[0] ^= 0xff;
  let corruptRejected = false;
  try {
    await parseBackup(zipSync(corruptEntries, { level: 0 }));
  } catch (error) {
    corruptRejected = error instanceof BackupError;
  }
  const entries = unzipSync(zip);
  const assetName = Object.keys(entries).find((entry) => entry.startsWith("assets/"));
  if (!assetName) {
    throw new Error("backup was missing the image file");
  }
  delete entries[assetName];
  let missingRejected = false;
  try {
    await parseBackup(zipSync(entries, { level: 0 }));
  } catch (error) {
    missingRejected = error instanceof BackupError;
  }
  let unsafeRejected = false;
  try {
    await parseBackup(zipSync({ "../evil.txt": strToU8("no") }, { level: 0 }));
  } catch (error) {
    unsafeRejected = error instanceof BackupError && error.code === "unsafe";
  }
  let cycleRejected = false;
  try {
    await encodeBackup({
      exportedAt: "2026-10-10T00:00:00.000Z",
      moments: [],
      links: [],
      assets: [],
      spaces: [
        {
          id: "space-a",
          name: "甲",
          parentId: "space-b",
          createdAt: "2026-10-10T00:00:00.000Z",
          updatedAt: "2026-10-10T00:00:00.000Z",
        },
        {
          id: "space-b",
          name: "乙",
          parentId: "space-a",
          createdAt: "2026-10-10T00:00:00.000Z",
          updatedAt: "2026-10-10T00:00:00.000Z",
        },
      ],
    });
  } catch (error) {
    cycleRejected = error instanceof BackupError;
  }
  if (!corruptRejected || !missingRejected || !unsafeRejected || !cycleRejected || (await listMoments()).length !== beforeCorrupt) {
    throw new Error(
      `bad backup was accepted (${String(corruptRejected)} ${String(missingRejected)} ${String(unsafeRejected)} ${String(cycleRejected)} ${(await listMoments()).length}/${beforeCorrupt})`,
    );
  }

  console.log("backup checks passed");
}

void main();
