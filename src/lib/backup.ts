import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { asStorageError, getDatabase } from "@/lib/db";
import type { Asset, Boom, BoomLink, ContentBlock, Moment, Space, SpaceIcon } from "@/lib/model";
import { IMAGE_MIME_TYPES, MAX_IMAGE_BYTES, normalizeSourceIds, SPACE_ICON_IDS } from "@/lib/model";

export const BACKUP_VERSION = 1;
export const MAX_ZIP_BYTES = 80 * 1024 * 1024;
export const MAX_UNZIPPED_BYTES = 200 * 1024 * 1024;
export const MAX_BACKUP_ENTRIES = 5000;

const FILE_MOMENTS = "moments.json";
const FILE_SPACES = "spaces.json";
const FILE_LINKS = "links.json";
const FILE_BOOMS = "booms.json";
const FILE_MANIFEST = "manifest.json";

const EXTENSIONS: Record<(typeof IMAGE_MIME_TYPES)[number], string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

const ID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;
const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/;

export class BackupError extends Error {
  readonly code: "format" | "version" | "integrity" | "unsafe" | "tooLarge" | "boomRefs";

  constructor(code: BackupError["code"]) {
    super(code);
    this.name = "BackupError";
    this.code = code;
  }
}

export type BackupAsset = {
  id: string;
  mimeType: (typeof IMAGE_MIME_TYPES)[number];
  createdAt: string;
  bytes: Uint8Array;
};

export type BackupArchive = {
  exportedAt: string;
  moments: Moment[];
  spaces: Space[];
  links: BoomLink[];
  booms: Boom[];
  boomsIncluded: boolean;
  assets: BackupAsset[];
};

export type MergeChoice = "keep-local" | "use-backup";

export type MergePlan = {
  addMoments: number;
  addSpaces: number;
  addLinks: number;
  addBooms: number;
  addAssets: number;
  sameMoments: number;
  sameSpaces: number;
  sameLinks: number;
  sameBooms: number;
  sameAssets: number;
  conflictMoments: number;
  conflictSpaces: number;
  conflictLinks: number;
  conflictBooms: number;
  conflictAssets: number;
};

export type MergeResult = {
  added: number;
  replaced: number;
  skipped: number;
};

type Library = {
  moments: Moment[];
  spaces: Space[];
  links: BoomLink[];
  booms: Boom[];
  assets: BackupAsset[];
};

export function backupFileName(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `BoomMoment-Backup-${year}-${month}-${day}.zip`;
}

export async function exportBackup() {
  const library = await readLibrary();
  return encodeBackup({ ...library, boomsIncluded: true, exportedAt: new Date().toISOString() });
}

export async function encodeBackup(archive: BackupArchive) {
  validateLibrary(archive);
  const moments = jsonBytes(sortById(archive.moments));
  const spaces = jsonBytes(sortById(archive.spaces));
  const links = jsonBytes(sortById(archive.links));
  const booms = jsonBytes(sortById(archive.booms.map(normalizeBoom)));
  const assetMeta = jsonBytes(
    sortById(archive.assets).map((asset) => ({
      id: asset.id,
      mimeType: asset.mimeType,
      createdAt: asset.createdAt,
    })),
  );
  const files: Record<string, Uint8Array> = {
    [FILE_MOMENTS]: moments,
    [FILE_SPACES]: spaces,
    [FILE_LINKS]: links,
    [FILE_BOOMS]: booms,
    "asset-meta.json": assetMeta,
  };
  const listed: Record<string, string> = {
    [FILE_MOMENTS]: await sha256Hex(moments),
    [FILE_SPACES]: await sha256Hex(spaces),
    [FILE_LINKS]: await sha256Hex(links),
    [FILE_BOOMS]: await sha256Hex(booms),
    "asset-meta.json": await sha256Hex(assetMeta),
  };
  for (const asset of sortById(archive.assets)) {
    const path = assetPath(asset.id, asset.mimeType);
    files[path] = asset.bytes;
    listed[path] = await sha256Hex(asset.bytes);
  }
  const manifest = {
    format: "boom-moment-backup",
    version: BACKUP_VERSION,
    exportedAt: archive.exportedAt,
    counts: {
      moments: archive.moments.length,
      spaces: archive.spaces.length,
      links: archive.links.length,
      booms: archive.booms.length,
      assets: archive.assets.length,
    },
    files: listed,
  };
  files[FILE_MANIFEST] = jsonBytes(manifest);
  return zipSync(files, { level: 0 });
}

export async function parseBackup(bytes: Uint8Array): Promise<BackupArchive> {
  if (bytes.byteLength > MAX_ZIP_BYTES) {
    throw new BackupError("tooLarge");
  }
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes);
  } catch {
    throw new BackupError("format");
  }
  const names = Object.keys(entries);
  if (names.length === 0 || names.length > MAX_BACKUP_ENTRIES) {
    throw new BackupError(names.length === 0 ? "format" : "tooLarge");
  }
  let unzipped = 0;
  for (const name of names) {
    assertSafePath(name);
    unzipped += entries[name]?.byteLength ?? 0;
  }
  if (unzipped > MAX_UNZIPPED_BYTES) {
    throw new BackupError("tooLarge");
  }

  const manifestBytes = entries[FILE_MANIFEST];
  if (!manifestBytes) {
    throw new BackupError("format");
  }
  const manifest = readJson(manifestBytes);
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new BackupError("format");
  }
  const record = manifest as Record<string, unknown>;
  if (record.format !== "boom-moment-backup") {
    throw new BackupError("format");
  }
  if (record.version !== BACKUP_VERSION) {
    throw new BackupError("version");
  }
  if (typeof record.exportedAt !== "string" || !ISO_PATTERN.test(record.exportedAt)) {
    throw new BackupError("integrity");
  }
  const listed = record.files;
  if (!listed || typeof listed !== "object" || Array.isArray(listed)) {
    throw new BackupError("format");
  }
  const hashes = listed as Record<string, unknown>;
  const expectedNames = new Set([FILE_MANIFEST, ...Object.keys(hashes)]);
  if (expectedNames.size !== names.length || names.some((name) => !expectedNames.has(name))) {
    throw new BackupError("integrity");
  }
  for (const [name, hash] of Object.entries(hashes)) {
    if (typeof hash !== "string" || !entries[name] || (await sha256Hex(entries[name])) !== hash) {
      throw new BackupError("integrity");
    }
  }

  const moments = parseMoments(readJson(required(entries, FILE_MOMENTS)));
  const spaces = parseSpaces(readJson(required(entries, FILE_SPACES)));
  const links = parseLinks(readJson(required(entries, FILE_LINKS)));
  const boomsIncluded = typeof hashes[FILE_BOOMS] === "string";
  const booms = boomsIncluded ? parseBooms(readJson(required(entries, FILE_BOOMS))) : [];
  const assets = await parseAssets(entries, hashes);
  const counts = record.counts;
  if (!counts || typeof counts !== "object" || Array.isArray(counts)) {
    throw new BackupError("integrity");
  }
  const countRecord = counts as Record<string, unknown>;
  if (
    countRecord.moments !== moments.length ||
    countRecord.spaces !== spaces.length ||
    countRecord.links !== links.length ||
    countRecord.assets !== assets.length
  ) {
    throw new BackupError("integrity");
  }
  if (boomsIncluded) {
    if (countRecord.booms !== booms.length) {
      throw new BackupError("integrity");
    }
  } else if (countRecord.booms !== undefined) {
    throw new BackupError("integrity");
  }
  const archive = { exportedAt: record.exportedAt, moments, spaces, links, booms, boomsIncluded, assets };
  validateLibrary(archive);
  return archive;
}

export async function planMerge(archive: BackupArchive): Promise<MergePlan> {
  const local = await readLibrary();
  return diffLibrary(local, archive, "keep-local").plan;
}

export async function applyMerge(archive: BackupArchive, choice: MergeChoice): Promise<MergeResult> {
  validateLibrary(archive);
  const local = await readLibrary();
  const ops = diffLibrary(local, archive, choice);
  const database = await getDatabase();
  const stores = archive.boomsIncluded
    ? (["moments", "spaces", "boomLinks", "booms", "assets"] as const)
    : (["moments", "spaces", "boomLinks", "assets"] as const);
  const tx = database.transaction(stores, "readwrite");
  try {
    for (const id of ops.deleteLinkIds) {
      await tx.objectStore("boomLinks").delete(id);
    }
    for (const space of ops.putSpaces) {
      await tx.objectStore("spaces").put(space);
    }
    for (const asset of ops.putAssets) {
      await tx.objectStore("assets").put(toAsset(asset));
    }
    for (const moment of ops.putMoments) {
      await tx.objectStore("moments").put(moment);
    }
    for (const link of ops.putLinks) {
      await tx.objectStore("boomLinks").put(link);
    }
    if (archive.boomsIncluded) {
      for (const boom of ops.putBooms) {
        await tx.objectStore("booms").put(boom);
      }
    }
    await tx.done;
    return { added: ops.added, replaced: ops.replaced, skipped: ops.skipped };
  } catch (error) {
    abort(tx);
    throw error instanceof BackupError ? error : asStorageError(error);
  }
}

export async function applyReplace(archive: BackupArchive) {
  validateLibrary(archive);
  const database = await getDatabase();
  const tx = database.transaction(["moments", "spaces", "boomLinks", "booms", "assets"], "readwrite");
  try {
    if (!archive.boomsIncluded) {
      const booms = await tx.objectStore("booms").getAll();
      if (keptBoomsDangle(booms, archive)) {
        throw new BackupError("boomRefs");
      }
    }
    const clears = [
      tx.objectStore("moments").clear(),
      tx.objectStore("spaces").clear(),
      tx.objectStore("boomLinks").clear(),
      tx.objectStore("assets").clear(),
    ];
    if (archive.boomsIncluded) {
      clears.push(tx.objectStore("booms").clear());
    }
    await Promise.all(clears);
    for (const space of archive.spaces) {
      await tx.objectStore("spaces").put(space);
    }
    for (const asset of archive.assets) {
      await tx.objectStore("assets").put(toAsset(asset));
    }
    for (const moment of archive.moments) {
      await tx.objectStore("moments").put(moment);
    }
    for (const link of archive.links) {
      await tx.objectStore("boomLinks").put(link);
    }
    if (archive.boomsIncluded) {
      for (const boom of archive.booms) {
        await tx.objectStore("booms").put(normalizeBoom(boom));
      }
    }
    await tx.done;
  } catch (error) {
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
    throw error instanceof BackupError ? error : asStorageError(error);
  }
}

export function conflictCount(plan: MergePlan) {
  return plan.conflictMoments + plan.conflictSpaces + plan.conflictLinks + plan.conflictBooms + plan.conflictAssets;
}

function keptBoomsDangle(booms: Boom[], archive: BackupArchive) {
  const momentIds = new Set(archive.moments.map((moment) => moment.id));
  return booms.some(
    (boom) =>
      boom.sourceMomentIds.some((id) => !momentIds.has(id)) ||
      (boom.resultMomentId !== undefined && !momentIds.has(boom.resultMomentId)),
  );
}

async function readLibrary(): Promise<Library> {
  const database = await getDatabase();
  const tx = database.transaction(["moments", "spaces", "boomLinks", "booms", "assets"], "readonly");
  return readFromTransaction(tx);
}

async function readFromTransaction(tx: AwaitedTransaction): Promise<Library> {
  const [moments, spaces, links, booms, stored] = await Promise.all([
    tx.objectStore("moments").getAll(),
    tx.objectStore("spaces").getAll(),
    tx.objectStore("boomLinks").getAll(),
    tx.objectStore("booms").getAll(),
    tx.objectStore("assets").getAll(),
  ]);
  const assets: BackupAsset[] = [];
  for (const asset of stored) {
    assets.push({
      id: asset.id,
      mimeType: asset.mimeType as BackupAsset["mimeType"],
      createdAt: asset.createdAt,
      bytes: new Uint8Array(await asset.blob.arrayBuffer()),
    });
  }
  return { moments, spaces, links, booms, assets };
}

type AwaitedTransaction = Awaited<ReturnType<Awaited<ReturnType<typeof getDatabase>>["transaction"]>>;

function diffLibrary(local: Library, incoming: BackupArchive, choice: MergeChoice) {
  const moments = diffRecords(local.moments, incoming.moments, sameMoment, choice);
  const spaces = diffRecords(local.spaces, incoming.spaces, sameSpace, choice);
  const assets = diffRecords(local.assets, incoming.assets, sameAsset, choice);
  const links = diffLinks(local.links, incoming.links, choice);
  const booms = incoming.boomsIncluded
    ? diffRecords(local.booms, incoming.booms.map(normalizeBoom), sameBoom, choice)
    : { put: [], added: 0, replaced: 0, same: 0, conflicts: 0, skipped: 0 };
  const plan: MergePlan = {
    addMoments: moments.added,
    addSpaces: spaces.added,
    addLinks: links.added,
    addBooms: booms.added,
    addAssets: assets.added,
    sameMoments: moments.same,
    sameSpaces: spaces.same,
    sameLinks: links.same,
    sameBooms: booms.same,
    sameAssets: assets.same,
    conflictMoments: moments.conflicts,
    conflictSpaces: spaces.conflicts,
    conflictLinks: links.conflicts,
    conflictBooms: booms.conflicts,
    conflictAssets: assets.conflicts,
  };
  return {
    plan,
    putMoments: moments.put,
    putSpaces: spaces.put,
    putAssets: assets.put,
    putLinks: links.put,
    putBooms: booms.put,
    deleteLinkIds: links.deleteIds,
    added: moments.added + spaces.added + assets.added + links.added + booms.added,
    replaced: moments.replaced + spaces.replaced + assets.replaced + links.replaced + booms.replaced,
    skipped: moments.skipped + spaces.skipped + assets.skipped + links.skipped + booms.skipped,
  };
}

function diffRecords<T extends { id: string }>(
  local: T[],
  incoming: T[],
  same: (left: T, right: T) => boolean,
  choice: MergeChoice,
) {
  const localById = new Map(local.map((item) => [item.id, item]));
  const put: T[] = [];
  let added = 0;
  let replaced = 0;
  let sameCount = 0;
  let conflicts = 0;
  for (const item of incoming) {
    const current = localById.get(item.id);
    if (!current) {
      put.push(item);
      added += 1;
      continue;
    }
    if (same(current, item)) {
      sameCount += 1;
      continue;
    }
    conflicts += 1;
    if (choice === "use-backup") {
      put.push(item);
      replaced += 1;
    }
  }
  return {
    put,
    added,
    replaced,
    same: sameCount,
    conflicts,
    skipped: sameCount + (choice === "keep-local" ? conflicts : 0),
  };
}

function diffLinks(local: BoomLink[], incoming: BoomLink[], choice: MergeChoice) {
  const localById = new Map(local.map((link) => [link.id, link]));
  const localByPair = new Map<string, BoomLink[]>();
  for (const link of local) {
    const key = pairKey(link);
    localByPair.set(key, [...(localByPair.get(key) ?? []), link]);
  }
  const put: BoomLink[] = [];
  const deleteIds: string[] = [];
  let added = 0;
  let replaced = 0;
  let sameCount = 0;
  let conflicts = 0;
  for (const link of incoming) {
    const current = localById.get(link.id);
    const pair = localByPair.get(pairKey(link)) ?? [];
    const pairOwnedByOther = pair.some((item) => item.id !== link.id);
    if (!current && !pairOwnedByOther) {
      put.push(link);
      added += 1;
      continue;
    }
    if (current && sameLink(current, link) && !pairOwnedByOther) {
      sameCount += 1;
      continue;
    }
    conflicts += 1;
    if (choice === "use-backup") {
      for (const item of pair) {
        if (item.id !== link.id && !deleteIds.includes(item.id)) {
          deleteIds.push(item.id);
        }
      }
      put.push(link);
      replaced += 1;
    }
  }
  return {
    put,
    deleteIds,
    added,
    replaced,
    same: sameCount,
    conflicts,
    skipped: sameCount + (choice === "keep-local" ? conflicts : 0),
  };
}

function sameMoment(left: Moment, right: Moment) {
  return canonical({
    id: left.id,
    title: left.title ?? null,
    blocks: left.blocks,
    spaceId: left.spaceId,
    createdAt: left.createdAt,
    updatedAt: left.updatedAt,
  }) === canonical({
    id: right.id,
    title: right.title ?? null,
    blocks: right.blocks,
    spaceId: right.spaceId,
    createdAt: right.createdAt,
    updatedAt: right.updatedAt,
  });
}

function sameSpace(left: Space, right: Space) {
  return canonical(left) === canonical(right);
}

function sameLink(left: BoomLink, right: BoomLink) {
  return canonical(left) === canonical(right);
}

function sameBoom(left: Boom, right: Boom) {
  return canonical(normalizeBoom(left)) === canonical(normalizeBoom(right));
}

function normalizeBoom(boom: Boom): Boom {
  return {
    id: boom.id,
    sourceMomentIds: normalizeSourceIds(boom.sourceMomentIds),
    createdAt: boom.createdAt,
    ...(boom.resultMomentId ? { resultMomentId: boom.resultMomentId } : {}),
  };
}

function sameAsset(left: BackupAsset, right: BackupAsset) {
  return (
    left.id === right.id &&
    left.mimeType === right.mimeType &&
    left.createdAt === right.createdAt &&
    bytesEqual(left.bytes, right.bytes)
  );
}

function pairKey(link: BoomLink) {
  return `${link.aId}\0${link.bId}`;
}

function canonical(value: unknown): string {
  return JSON.stringify(orderValue(value));
}

function orderValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => orderValue(item));
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  const record = value as Record<string, unknown>;
  const ordered: Record<string, unknown> = {};
  for (const key of Object.keys(record).sort()) {
    ordered[key] = orderValue(record[key]);
  }
  return ordered;
}

function bytesEqual(left: Uint8Array, right: Uint8Array) {
  if (left.byteLength !== right.byteLength) {
    return false;
  }
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }
  return true;
}

function validateLibrary(archive: Library) {
  const moments = parseMoments(archive.moments);
  const spaces = parseSpaces(archive.spaces);
  const links = parseLinks(archive.links);
  const assetIds = new Set<string>();
  for (const asset of archive.assets) {
    if (!ID_PATTERN.test(asset.id) || assetIds.has(asset.id) || !isImageMime(asset.mimeType)) {
      throw new BackupError("integrity");
    }
    if (!ISO_PATTERN.test(asset.createdAt) || !looksLikeImage(asset.mimeType, asset.bytes)) {
      throw new BackupError("integrity");
    }
    if (asset.bytes.byteLength === 0 || asset.bytes.byteLength > MAX_IMAGE_BYTES) {
      throw new BackupError("tooLarge");
    }
    assetIds.add(asset.id);
  }
  const spaceIds = new Set(spaces.map((space) => space.id));
  for (const space of spaces) {
    if (space.parentId && !spaceIds.has(space.parentId)) {
      throw new BackupError("integrity");
    }
  }
  if (hasSpaceCycle(spaces)) {
    throw new BackupError("integrity");
  }
  const momentIds = new Set(moments.map((moment) => moment.id));
  for (const moment of moments) {
    if (moment.spaceId && !spaceIds.has(moment.spaceId)) {
      throw new BackupError("integrity");
    }
    for (const block of moment.blocks) {
      if (block.type === "image" && !assetIds.has(block.assetId)) {
        throw new BackupError("integrity");
      }
    }
  }
  const pairs = new Set<string>();
  for (const link of links) {
    if (!momentIds.has(link.aId) || !momentIds.has(link.bId)) {
      throw new BackupError("integrity");
    }
    const key = pairKey(link);
    if (pairs.has(key)) {
      throw new BackupError("integrity");
    }
    pairs.add(key);
  }
  const booms = parseBooms(archive.booms);
  const boomIds = new Set<string>();
  for (const boom of booms) {
    if (boomIds.has(boom.id)) {
      throw new BackupError("integrity");
    }
    boomIds.add(boom.id);
    for (const sourceId of boom.sourceMomentIds) {
      if (!momentIds.has(sourceId)) {
        throw new BackupError("integrity");
      }
    }
    if (boom.resultMomentId && (!momentIds.has(boom.resultMomentId) || boom.sourceMomentIds.includes(boom.resultMomentId))) {
      throw new BackupError("integrity");
    }
  }
}

function parseMoments(value: unknown): Moment[] {
  if (!Array.isArray(value)) {
    throw new BackupError("format");
  }
  const ids = new Set<string>();
  return value.map((item) => {
    const moment = readRecord(item);
    const id = readId(moment.id);
    if (ids.has(id)) {
      throw new BackupError("integrity");
    }
    ids.add(id);
    const blocks = parseBlocks(moment.blocks);
    const title = moment.title === undefined || moment.title === "" ? undefined : readTitle(moment.title);
    if (title !== undefined && [...title].length > 200) {
      throw new BackupError("integrity");
    }
    return {
      id,
      blocks,
      spaceId: readNullableId(moment.spaceId),
      createdAt: readIso(moment.createdAt),
      updatedAt: readIso(moment.updatedAt),
      ...(title ? { title } : {}),
    };
  });
}

function parseBlocks(value: unknown): ContentBlock[] {
  if (!Array.isArray(value)) {
    throw new BackupError("format");
  }
  const ids = new Set<string>();
  return value.map((item) => {
    const block = readRecord(item);
    const id = readId(block.id);
    if (ids.has(id)) {
      throw new BackupError("integrity");
    }
    ids.add(id);
    if (block.type === "text") {
      if (typeof block.text !== "string" || block.text.length > 100_000) {
        throw new BackupError("integrity");
      }
      return { id, type: "text", text: block.text };
    }
    if (block.type === "image") {
      const alt = block.alt === undefined ? undefined : readOptionalString(block.alt);
      return {
        id,
        type: "image",
        assetId: readId(block.assetId),
        ...(alt ? { alt } : {}),
      };
    }
    throw new BackupError("integrity");
  });
}

function parseSpaces(value: unknown): Space[] {
  if (!Array.isArray(value)) {
    throw new BackupError("format");
  }
  const ids = new Set<string>();
  return value.map((item) => {
    const space = readRecord(item);
    const id = readId(space.id);
    if (ids.has(id)) {
      throw new BackupError("integrity");
    }
    ids.add(id);
    if (typeof space.name !== "string" || [...space.name].length < 1 || [...space.name].length > 40) {
      throw new BackupError("integrity");
    }
    const icon = readSpaceIcon(space.icon);
    return {
      id,
      name: space.name,
      parentId: readNullableId(space.parentId),
      createdAt: readIso(space.createdAt),
      updatedAt: readIso(space.updatedAt),
      ...(icon ? { icon } : {}),
    };
  });
}

function parseBooms(value: unknown): Boom[] {
  if (!Array.isArray(value)) {
    throw new BackupError("format");
  }
  const ids = new Set<string>();
  return value.map((item) => {
    const boom = readRecord(item);
    const id = readId(boom.id);
    if (ids.has(id)) {
      throw new BackupError("integrity");
    }
    ids.add(id);
    if (!Array.isArray(boom.sourceMomentIds) || boom.sourceMomentIds.length < 2) {
      throw new BackupError("integrity");
    }
    const sourceMomentIds = normalizeSourceIds(boom.sourceMomentIds.map((sourceId) => readId(sourceId)));
    if (sourceMomentIds.length !== boom.sourceMomentIds.length) {
      throw new BackupError("integrity");
    }
    const resultMomentId = boom.resultMomentId === undefined ? undefined : readId(boom.resultMomentId);
    if (resultMomentId && sourceMomentIds.includes(resultMomentId)) {
      throw new BackupError("integrity");
    }
    return {
      id,
      sourceMomentIds,
      createdAt: readIso(boom.createdAt),
      ...(resultMomentId ? { resultMomentId } : {}),
    };
  });
}

function parseLinks(value: unknown): BoomLink[] {
  if (!Array.isArray(value)) {
    throw new BackupError("format");
  }
  const ids = new Set<string>();
  return value.map((item) => {
    const link = readRecord(item);
    const id = readId(link.id);
    if (ids.has(id)) {
      throw new BackupError("integrity");
    }
    ids.add(id);
    const aId = readId(link.aId);
    const bId = readId(link.bId);
    if (aId === bId || aId > bId) {
      throw new BackupError("integrity");
    }
    return { id, aId, bId, createdAt: readIso(link.createdAt) };
  });
}

async function parseAssets(entries: Record<string, Uint8Array>, hashes: Record<string, unknown>) {
  const assets: BackupAsset[] = [];
  const seen = new Set<string>();
  for (const name of Object.keys(hashes)) {
    if (!name.startsWith("assets/")) {
      if (
        name !== FILE_MOMENTS &&
        name !== FILE_SPACES &&
        name !== FILE_LINKS &&
        name !== FILE_BOOMS &&
        name !== "asset-meta.json"
      ) {
        throw new BackupError("unsafe");
      }
      continue;
    }
    const match = /^assets\/([A-Za-z0-9_-]{1,80})\.(jpg|png|webp|gif)$/.exec(name);
    if (!match) {
      throw new BackupError("unsafe");
    }
    const bytes = entries[name];
    if (!bytes) {
      throw new BackupError("integrity");
    }
    const mimeType = mimeForExtension(match[2]);
    if (!mimeType || !looksLikeImage(mimeType, bytes) || bytes.byteLength > MAX_IMAGE_BYTES) {
      throw new BackupError(bytes.byteLength > MAX_IMAGE_BYTES ? "tooLarge" : "integrity");
    }
    if (seen.has(match[1])) {
      throw new BackupError("integrity");
    }
    seen.add(match[1]);
    assets.push({
      id: match[1],
      mimeType,
      createdAt: "",
      bytes,
    });
  }
  const metaName = "assets.json";
  if (entries[metaName] || hashes[metaName]) {
    throw new BackupError("format");
  }
  const dated = readAssetDates(entries, hashes);
  if (dated.size !== assets.length) {
    throw new BackupError("integrity");
  }
  return assets.map((asset) => {
    const createdAt = dated.get(asset.id);
    if (!createdAt) {
      throw new BackupError("integrity");
    }
    return { ...asset, createdAt };
  });
}

function readAssetDates(entries: Record<string, Uint8Array>, hashes: Record<string, unknown>) {
  const raw = entries["asset-meta.json"];
  if (!raw || typeof hashes["asset-meta.json"] !== "string") {
    throw new BackupError("integrity");
  }
  const value = readJson(raw);
  if (!Array.isArray(value)) {
    throw new BackupError("format");
  }
  const dates = new Map<string, string>();
  for (const item of value) {
    const record = readRecord(item);
    const id = readId(record.id);
    if (dates.has(id) || !isImageMime(record.mimeType) || typeof record.createdAt !== "string") {
      throw new BackupError("integrity");
    }
    dates.set(id, readIso(record.createdAt));
    if (record.mimeType !== mimeForExtension(extensionFor(entries, id))) {
      throw new BackupError("integrity");
    }
  }
  return dates;
}

function extensionFor(entries: Record<string, Uint8Array>, id: string) {
  for (const extension of ["jpg", "png", "webp", "gif"] as const) {
    if (entries[`assets/${id}.${extension}`]) {
      return extension;
    }
  }
  throw new BackupError("integrity");
}

function mimeForExtension(extension: string | undefined) {
  if (extension === "jpg") {
    return "image/jpeg" as const;
  }
  if (extension === "png" || extension === "webp" || extension === "gif") {
    return `image/${extension}` as const;
  }
  return null;
}

function isImageMime(value: unknown): value is BackupAsset["mimeType"] {
  return typeof value === "string" && IMAGE_MIME_TYPES.includes(value as BackupAsset["mimeType"]);
}

function looksLikeImage(mime: BackupAsset["mimeType"], bytes: Uint8Array) {
  if (mime === "image/png") {
    return bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  }
  if (mime === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mime === "image/gif") {
    return bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46;
  }
  return (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  );
}

function assetPath(id: string, mime: BackupAsset["mimeType"]) {
  return `assets/${id}.${EXTENSIONS[mime]}`;
}

function assertSafePath(name: string) {
  if (
    name.length === 0 ||
    name.length > 160 ||
    name.includes("\\") ||
    name.includes("\0") ||
    name.startsWith("/") ||
    name.includes("../") ||
    name.includes("/./") ||
    name.split("/").some((part) => part === ".." || part === ".")
  ) {
    throw new BackupError("unsafe");
  }
  if (
    name === FILE_MANIFEST ||
    name === FILE_MOMENTS ||
    name === FILE_SPACES ||
    name === FILE_LINKS ||
    name === FILE_BOOMS ||
    name === "asset-meta.json"
  ) {
    return;
  }
  if (!/^assets\/[A-Za-z0-9_-]{1,80}\.(jpg|png|webp|gif)$/.test(name)) {
    throw new BackupError("unsafe");
  }
}

function hasSpaceCycle(spaces: Space[]) {
  const parents = new Map(spaces.map((space) => [space.id, space.parentId]));
  for (const space of spaces) {
    const seen = new Set<string>();
    let current: string | null = space.id;
    while (current) {
      if (seen.has(current)) {
        return true;
      }
      seen.add(current);
      current = parents.get(current) ?? null;
    }
  }
  return false;
}

function readJson(bytes: Uint8Array) {
  try {
    return JSON.parse(strFromU8(bytes)) as unknown;
  } catch {
    throw new BackupError("format");
  }
}

function required(entries: Record<string, Uint8Array>, name: string) {
  const bytes = entries[name];
  if (!bytes) {
    throw new BackupError("format");
  }
  return bytes;
}

function readRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BackupError("format");
  }
  return value as Record<string, unknown>;
}

function readId(value: unknown) {
  if (typeof value !== "string" || !ID_PATTERN.test(value)) {
    throw new BackupError("integrity");
  }
  return value;
}

function readNullableId(value: unknown) {
  if (value === null) {
    return null;
  }
  return readId(value);
}

function readIso(value: unknown) {
  if (typeof value !== "string" || !ISO_PATTERN.test(value)) {
    throw new BackupError("integrity");
  }
  return value;
}

function readTitle(value: unknown) {
  if (typeof value !== "string" || [...value].length > 200) {
    throw new BackupError("integrity");
  }
  return value;
}

function readSpaceIcon(value: unknown): SpaceIcon | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  return (SPACE_ICON_IDS as readonly string[]).includes(value) ? (value as SpaceIcon) : undefined;
}

function readOptionalString(value: unknown) {
  if (typeof value !== "string" || [...value].length > 200) {
    throw new BackupError("integrity");
  }
  return value.length > 0 ? value : undefined;
}

function jsonBytes(value: unknown) {
  return strToU8(JSON.stringify(value));
}

function sortById<T extends { id: string }>(items: T[]) {
  return [...items].sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
}

function toAsset(asset: BackupAsset): Asset {
  const copy = new Uint8Array(asset.bytes.byteLength);
  copy.set(asset.bytes);
  return {
    id: asset.id,
    mimeType: asset.mimeType,
    createdAt: asset.createdAt,
    blob: new Blob([copy], { type: asset.mimeType }),
  };
}

async function sha256Hex(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", copy);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function abort(tx: { abort: () => void }) {
  try {
    tx.abort();
  } catch {
    // The transaction already failed closed.
  }
}
