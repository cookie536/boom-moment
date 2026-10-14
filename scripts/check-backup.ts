import "fake-indexeddb/auto";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
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
import { createBoom, createLink, deleteBoom, listBooms, listLinks } from "../src/lib/boom";
import { readHomeView, writeHomeView } from "../src/lib/db";
import { momentDrawItems, paginateHeights } from "../src/lib/share-image";
import { createMoment, getAsset, getMoment, listMoments, updateMoment } from "../src/lib/moments";
import { createSpace, getSpace, listSpaces, renameSpace } from "../src/lib/spaces";

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
  const boom = await createBoom(["moment-note", "moment-img"]);
  const duplicate = await createBoom(["moment-img", "moment-note"]);
  await writeHomeView("list");

  const zip = await exportBackup();
  const archive = await parseBackup(zip);
  if (
    archive.moments.length !== 2 ||
    archive.spaces.length !== 2 ||
    archive.links.length !== 1 ||
    archive.booms.length !== 2 ||
    !archive.boomsIncluded ||
    archive.assets.length !== 1
  ) {
    throw new Error("backup did not contain the library");
  }
  const archivedBooms = [...archive.booms].sort((left, right) => (left.id < right.id ? -1 : 1));
  if (
    archivedBooms.some((item) => item.sourceMomentIds.join(",") !== "moment-img,moment-note" || item.resultMomentId) ||
    new Set(archivedBooms.map((item) => item.id)).size !== 2
  ) {
    throw new Error("backup collapsed two booms with the same sources");
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
    (await listBooms()).length !== 2 ||
    (await readHomeView()) !== "list"
  ) {
    throw new Error("replace did not rebuild text, image, spaces, links, and booms");
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

  const legacyEntries = unzipSync(zip);
  delete legacyEntries["booms.json"];
  const legacyManifest = JSON.parse(strFromU8(legacyEntries["manifest.json"])) as {
    files: Record<string, string>;
    counts: Record<string, number>;
  };
  delete legacyManifest.files["booms.json"];
  delete legacyManifest.counts.booms;
  legacyEntries["manifest.json"] = strToU8(JSON.stringify(legacyManifest));
  const legacy = await parseBackup(zipSync(legacyEntries, { level: 0 }));
  if (legacy.boomsIncluded || legacy.booms.length !== 0 || legacy.links.length !== 1) {
    throw new Error("an old backup without booms.json was not accepted");
  }
  const listedButMissing = unzipSync(zip);
  delete listedButMissing["booms.json"];
  let droppedBoomRejected = false;
  try {
    await parseBackup(zipSync(listedButMissing, { level: 0 }));
  } catch (error) {
    droppedBoomRejected = error instanceof BackupError;
  }
  const boomsBeforeLegacy = (await listBooms()).length;
  await applyMerge(legacy, "keep-local");
  await applyReplace(legacy);
  if (!droppedBoomRejected || (await listBooms()).length !== boomsBeforeLegacy || boomsBeforeLegacy !== 2) {
    throw new Error("an old backup dropped or rejected the local booms");
  }
  await deleteBoom(boom.id);
  await deleteBoom(duplicate.id);
  if ((await listBooms()).length !== 0 || !(await getMoment("moment-img")) || !(await getMoment("moment-note"))) {
    throw new Error("removing a boom deleted a moment");
  }
  await applyMerge(archive, "keep-local");
  const restoredBoomIds = new Set((await listBooms()).map((item) => item.id));
  if (!restoredBoomIds.has(boom.id) || !restoredBoomIds.has(duplicate.id)) {
    throw new Error("merge did not restore both booms");
  }

  const beforeCorrupt = (await listMoments()).length;
  const beforeBoomTamper = (await listBooms()).length;
  const boomTamper = unzipSync(zip);
  const boomFile = boomTamper["booms.json"];
  if (!boomFile) {
    throw new Error("backup was missing booms.json");
  }
  boomFile[0] ^= 0xff;
  let boomTamperRejected = false;
  try {
    await parseBackup(zipSync(boomTamper, { level: 0 }));
  } catch (error) {
    boomTamperRejected = error instanceof BackupError;
  }
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
      booms: [],
      boomsIncluded: true,
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
  if (
    !boomTamperRejected ||
    (await listBooms()).length !== beforeBoomTamper ||
    !corruptRejected ||
    !missingRejected ||
    !unsafeRejected ||
    !cycleRejected ||
    (await listMoments()).length !== beforeCorrupt
  ) {
    throw new Error(
      `bad backup was accepted (${String(corruptRejected)} ${String(missingRejected)} ${String(unsafeRejected)} ${String(cycleRejected)} ${(await listMoments()).length}/${beforeCorrupt})`,
    );
  }

  await createMoment({
    id: "moment-a",
    title: "甲",
    blocks: [{ id: "text-a", type: "text", text: "来源甲" }],
    assets: [],
  });
  await createMoment({
    id: "moment-b",
    title: "乙",
    blocks: [{ id: "text-b", type: "text", text: "来源乙" }],
    assets: [],
  });
  await createMoment({
    id: "moment-c",
    title: "丙",
    blocks: [{ id: "text-c", type: "text", text: "产出丙" }],
    assets: [],
    linkTo: ["moment-a", "moment-b"],
  });
  const keptLibrary = await exportBackup();
  await createMoment({
    id: "moment-local-only",
    title: "只在本机",
    blocks: [{ id: "text-local-only", type: "text", text: "替换后应消失" }],
    assets: [],
  });
  const foreign = await encodeBackup({
    exportedAt: "2026-10-10T00:00:00.000Z",
    moments: [
      {
        id: "moment-foreign",
        title: "外来",
        blocks: [{ id: "text-foreign", type: "text", text: "备份里的" }],
        spaceId: null,
        createdAt: "2026-10-10T00:00:00.000Z",
        updatedAt: "2026-10-10T00:00:00.000Z",
      },
    ],
    spaces: [],
    links: [],
    booms: [],
    boomsIncluded: true,
    assets: [],
  });
  let refused = false;
  try {
    await applyReplace(await withoutBooms(foreign));
  } catch (error) {
    refused = error instanceof BackupError && error.code === "boomRefs";
  }
  const refusedBooms = await listBooms();
  const resultBoom = refusedBooms.find((item) => item.resultMomentId === "moment-c");
  if (
    !refused ||
    !resultBoom ||
    resultBoom.sourceMomentIds.join(",") !== "moment-a,moment-b" ||
    !(await getMoment("moment-a")) ||
    !(await getMoment("moment-b")) ||
    !(await getMoment("moment-c")) ||
    !(await getMoment("moment-local-only")) ||
    (await getMoment("moment-foreign"))
  ) {
    throw new Error("replace with an old backup left dangling boom references or changed the library");
  }

  await applyReplace(await withoutBooms(keptLibrary));
  const keptBooms = await listBooms();
  const keptResult = keptBooms.find((item) => item.resultMomentId === "moment-c");
  const keptIds = new Set((await listMoments()).map((moment) => moment.id));
  if (
    !keptResult ||
    keptResult.sourceMomentIds.some((id) => !keptIds.has(id)) ||
    !keptIds.has("moment-c") ||
    keptIds.has("moment-local-only") ||
    keptBooms.length !== refusedBooms.length
  ) {
    throw new Error("replace did not keep a boom whose moments were in the old backup");
  }

  const present = await exportBackup();
  const parsed = await parseBackup(present);
  const missingResult = await encodeBackup({
    ...parsed,
    moments: parsed.moments.filter((moment) => moment.id !== "moment-c"),
    booms: [],
    boomsIncluded: true,
  });
  const beforeIds = (await listMoments()).map((moment) => moment.id).sort();
  const beforeBoom = (await listBooms()).find((item) => item.resultMomentId === "moment-c");
  let resultRefused = false;
  try {
    await applyReplace(await withoutBooms(missingResult));
  } catch (error) {
    resultRefused = error instanceof BackupError && error.code === "boomRefs";
  }
  const afterIds = (await listMoments()).map((moment) => moment.id).sort();
  const afterBoom = (await listBooms()).find((item) => item.id === beforeBoom?.id);
  if (
    !resultRefused ||
    !beforeBoom ||
    afterIds.join(",") !== beforeIds.join(",") ||
    !(await getMoment("moment-a")) ||
    !(await getMoment("moment-b")) ||
    !(await getMoment("moment-c")) ||
    afterBoom?.resultMomentId !== "moment-c" ||
    afterBoom.sourceMomentIds.join(",") !== "moment-a,moment-b"
  ) {
    throw new Error("replace was not refused when only the boom result was missing");
  }

  await renameSpace("space-root", "阅读", "book");
  const withIcon = await parseBackup(await exportBackup());
  const markedRoot = withIcon.spaces.find((space) => space.id === "space-root");
  if (markedRoot?.icon !== "book" || markedRoot.name !== "阅读") {
    throw new Error("backup dropped the chosen space icon");
  }
  const stripped = await parseBackup(
    await encodeBackup({
      ...withIcon,
      spaces: withIcon.spaces.map((space) => {
        const rest = { ...space };
        delete rest.icon;
        return rest;
      }),
    }),
  );
  if (stripped.spaces.some((space) => space.icon)) {
    throw new Error("old backup without space icons invented one");
  }
  await applyReplace(stripped);
  const plain = await getSpace("space-root");
  if (!plain || plain.icon || plain.name !== "阅读") {
    throw new Error("restoring an old backup changed the space or guessed an icon");
  }
  await applyReplace(withIcon);
  if ((await getSpace("space-root"))?.icon !== "book") {
    throw new Error("restoring a backup lost the space icon");
  }

  console.log("backup checks passed");
}

async function withoutBooms(bytes: Uint8Array) {
  const entries = unzipSync(bytes);
  delete entries["booms.json"];
  const manifest = JSON.parse(strFromU8(entries["manifest.json"])) as {
    files: Record<string, string>;
    counts: Record<string, number>;
  };
  delete manifest.files["booms.json"];
  delete manifest.counts.booms;
  entries["manifest.json"] = strToU8(JSON.stringify(manifest));
  return parseBackup(zipSync(entries, { level: 0 }));
}

void main();
