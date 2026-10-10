import "fake-indexeddb/auto";
import { createMoment, deleteMoment, getAsset, getMoment, listMoments, updateMoment } from "../src/lib/moments";
import { migrateLibraryTree } from "../src/lib/migrate-tree";
import type { LibraryNode } from "../src/lib/library-tree";

async function main() {
  const blob = new Blob([Uint8Array.from([1, 2, 3, 4])], { type: "image/png" });
  const created = await createMoment({
    id: "moment-1",
    title: "石香姑",
    blocks: [
      { id: "text-1", type: "text", text: "先记下来" },
      { id: "image-1", type: "image", assetId: "asset-1" },
    ],
    assets: [{ id: "asset-1", mimeType: "image/png", blob, createdAt: new Date().toISOString() }],
    spaceId: null,
  });

  const listed = await listMoments();
  const storedAsset = await getAsset("asset-1");
  if (listed.length !== 1 || listed[0]?.id !== created.id || !storedAsset) {
    throw new Error("create did not persist moment and image");
  }

  await updateMoment({
    id: "moment-1",
    title: "石香姑",
    blocks: [{ id: "text-1", type: "text", text: "改过以后还在" }],
    assets: [],
    removedAssetIds: ["asset-1"],
  });

  const updated = await getMoment("moment-1");
  const removed = await getAsset("asset-1");
  if (updated?.blocks.length !== 1 || updated.createdAt !== created.createdAt || removed) {
    throw new Error("update did not keep createdAt or remove the image");
  }

  const reloaded = await listMoments();
  if (reloaded[0]?.blocks[0]?.type !== "text" || reloaded[0].blocks[0].text !== "改过以后还在") {
    throw new Error("reopen did not keep the edited text");
  }

  await deleteMoment("moment-1");
  if ((await listMoments()).length !== 0) {
    throw new Error("delete left the moment behind");
  }

  const tree: LibraryNode[] = [
    {
      id: "books",
      title: "书籍",
      notes: [],
      sections: [],
      children: [
        {
          id: "note-1",
          title: "欧莱雅测评",
          description: "同一段原文",
          origin: "UserCreated",
          notes: [],
          sections: [
            {
              id: "sec-1",
              title: "全文",
              contents: [{ id: "content-1", text: "同一段原文", createdAt: "2026.10.02" }],
            },
          ],
          children: [
            {
              id: "point-1",
              title: "三角迷阵",
              description: "规划路径",
              origin: "AIGeneratedKnowledgePoint",
              notes: [],
              sections: [
                {
                  id: "sec-2",
                  title: "全文",
                  contents: [{ id: "content-2", text: "规划路径", createdAt: "2026.10.02" }],
                },
              ],
              children: [],
            },
          ],
        },
      ],
    },
  ];

  const migrated = migrateLibraryTree(tree, "2026-10-09T00:00:00.000Z");
  if (migrated.spaces.length !== 1 || migrated.spaces[0]?.name !== "书籍") {
    throw new Error("folder did not become one space");
  }
  if (migrated.moments.length !== 1) {
    throw new Error("capture did not become one moment");
  }
  const texts = migrated.moments[0]?.blocks.map((block) => (block.type === "text" ? block.text : "")).join("\n");
  if (!texts?.includes("同一段原文") || texts.split("同一段原文").length !== 2) {
    throw new Error("original text was duplicated or dropped");
  }
  if (!texts.includes("三角迷阵")) {
    throw new Error("knowledge point title was dropped");
  }

  console.log("moment db checks passed");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
