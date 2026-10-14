import "fake-indexeddb/auto";
import { createBoom, getBoom, listBooms } from "../src/lib/boom";
import {
  boomHistoryTitle,
  clearBoomDraft,
  createSubmitLock,
  momentDraftHasContent,
  readBoomDraft,
  sourcesForSave,
  writeBoomDraft,
} from "../src/lib/boom-flow";
import { createMoment, getMoment, listMoments } from "../src/lib/moments";
import { momentMatches } from "../src/lib/model";

async function main() {
  clearBoomDraft();
  const ids = ["m1", "m2", "m3", "m4", "m5"];
  for (const [index, id] of ids.entries()) {
    await createMoment({
      id,
      title: `来源${index + 1}`,
      blocks: [{ id: `text-${id}`, type: "text", text: `正文${index + 1}` }],
      assets: [],
    });
  }

  const two = await createBoom(sourcesForSave(["m2", "m1"]));
  const three = await createBoom(sourcesForSave(["m1", "m3", "m2"]));
  const five = await createBoom(sourcesForSave(ids));
  if (
    two.sourceMomentIds.join(",") !== "m1,m2" ||
    three.sourceMomentIds.join(",") !== "m1,m2,m3" ||
    five.sourceMomentIds.join(",") !== ids.join(",") ||
    two.resultMomentId ||
    (await getBoom(two.id))?.sourceMomentIds.join(",") !== "m1,m2"
  ) {
    throw new Error("saving two, three, or five sources did not keep one boom");
  }

  const previous = ["m1", "m2", "m3"];
  const adjusted = sourcesForSave(["m1", "m5"]);
  if (adjusted.join(",") !== "m1,m5" || adjusted.some((id) => previous.includes(id) && id === "m2")) {
    throw new Error("save used a stale source list");
  }
  let tooFew = false;
  try {
    sourcesForSave(["m1"]);
  } catch {
    tooFew = true;
  }
  if (!tooFew) {
    throw new Error("fewer than two sources was accepted");
  }

  const selected = ["m1", "m2", "m5"];
  const needle = "来源2";
  const visible = (await listMoments()).filter((moment) => momentMatches(moment, needle) && moment.spaceId === null);
  if (visible.length !== 1 || visible[0]?.id !== "m2" || selected.join(",") !== "m1,m2,m5") {
    throw new Error("filtering changed the selection");
  }

  writeBoomDraft({
    title: "还没保存的标题",
    spaceId: null,
    blocks: [{ id: "draft-1", type: "text", text: "还没保存的正文" }],
  });
  const kept = readBoomDraft();
  if (kept?.title !== "还没保存的标题" || kept.blocks[0]?.type !== "text" || kept.blocks[0].text !== "还没保存的正文") {
    throw new Error("returning from the editor lost the draft");
  }
  if (!momentDraftHasContent({ title: kept.title, texts: ["还没保存的正文"], images: 0 })) {
    throw new Error("unsaved moment content was treated as empty");
  }
  if (momentDraftHasContent({ title: "  ", texts: [" "], images: 0 })) {
    throw new Error("blank input asked for the source-only warning");
  }
  clearBoomDraft();
  if (readBoomDraft()) {
    throw new Error("draft remained after it was cleared");
  }

  const withResult = await createMoment({
    id: "result-1",
    title: "产出标题",
    blocks: [{ id: "text-result", type: "text", text: "产出正文" }],
    assets: [],
    linkTo: ["m1", "m3", "m4"],
  });
  const stored = (await listBooms()).find((boom) => boom.resultMomentId === withResult.id);
  if (
    !stored ||
    stored.sourceMomentIds.join(",") !== "m1,m3,m4" ||
    stored.sourceMomentIds.includes(withResult.id) ||
    !(await getMoment(withResult.id))
  ) {
    throw new Error("saving a moment and boom did not keep the result separate from the sources");
  }
  const moments = await listMoments();
  if (boomHistoryTitle(stored, moments) !== "产出标题") {
    throw new Error("a boom with a result was not titled from that moment");
  }
  if (boomHistoryTitle(two, moments) !== "来源1 × 来源2") {
    throw new Error("a source-only boom was not titled from its sources");
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
      id: "moment-flow-rollback",
      blocks: [{ id: "text-flow-rollback", type: "text", text: "不应留下" }],
      assets: [],
      linkTo: ["m1", "m2"],
    });
  } catch {
    rolledBack = true;
  } finally {
    IDBObjectStore.prototype.put = originalPut;
  }
  if (
    !rolledBack ||
    (await getMoment("moment-flow-rollback")) ||
    (await listBooms()).some((boom) => boom.resultMomentId === "moment-flow-rollback")
  ) {
    throw new Error("a failed boom transaction left a moment or a boom behind");
  }

  const lock = createSubmitLock();
  let started = 0;
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const first = lock.run(async () => {
    started += 1;
    await gate;
    return "saved";
  });
  const second = await lock.run(async () => {
    started += 1;
    return "again";
  });
  release();
  if (second !== undefined || started !== 1 || (await first) !== "saved") {
    throw new Error("a second save was submitted while the first was still running");
  }
  const retried = await lock.run(async () => "retried");
  if (retried !== "retried") {
    throw new Error("a failed or finished save could not be retried");
  }

  console.log("boom flow checks passed");
}

void main();
