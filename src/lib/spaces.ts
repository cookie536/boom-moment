import { asStorageError, getDatabase } from "@/lib/db";
import type { Moment, Space } from "@/lib/model";
import { sortMoments } from "@/lib/model";

export class SpaceMissingError extends Error {
  constructor() {
    super("space missing");
    this.name = "SpaceMissingError";
  }
}

export class SpaceCycleError extends Error {
  constructor() {
    super("space cycle");
    this.name = "SpaceCycleError";
  }
}

export async function listSpaces() {
  const database = await getDatabase();
  return (await database.getAll("spaces")).sort(compareSpaces);
}

export async function getSpace(id: string) {
  const database = await getDatabase();
  return (await database.get("spaces", id)) ?? null;
}

export async function createSpace(input: { id: string; name: string; parentId?: string | null }) {
  const name = cleanName(input.name);
  const parentId = input.parentId ?? null;
  const database = await getDatabase();
  if (parentId) {
    const parent = await database.get("spaces", parentId);
    if (!parent) {
      throw new SpaceMissingError();
    }
  }

  const now = new Date().toISOString();
  const space: Space = {
    id: input.id,
    name,
    parentId,
    createdAt: now,
    updatedAt: now,
  };
  try {
    await database.put("spaces", space);
  } catch (error) {
    throw asStorageError(error);
  }
  return space;
}

export async function renameSpace(id: string, name: string) {
  const nextName = cleanName(name);
  const database = await getDatabase();
  const existing = await database.get("spaces", id);
  if (!existing) {
    throw new SpaceMissingError();
  }
  const space: Space = { ...existing, name: nextName, updatedAt: new Date().toISOString() };
  try {
    await database.put("spaces", space);
  } catch (error) {
    throw asStorageError(error);
  }
  return space;
}

export async function moveSpace(id: string, parentId: string | null) {
  const database = await getDatabase();
  const spaces = await database.getAll("spaces");
  const existing = spaces.find((space) => space.id === id);
  if (!existing) {
    throw new SpaceMissingError();
  }
  if (parentId === id || (parentId !== null && isDescendant(spaces, id, parentId))) {
    throw new SpaceCycleError();
  }
  if (parentId && !spaces.some((space) => space.id === parentId)) {
    throw new SpaceMissingError();
  }
  if (existing.parentId === parentId) {
    return existing;
  }

  const space: Space = { ...existing, parentId, updatedAt: new Date().toISOString() };
  try {
    await database.put("spaces", space);
  } catch (error) {
    throw asStorageError(error);
  }
  return space;
}

export async function deleteSpace(id: string) {
  const database = await getDatabase();
  const existing = await database.get("spaces", id);
  if (!existing) {
    return null;
  }

  const [spaces, moments] = await Promise.all([database.getAll("spaces"), database.getAll("moments")]);
  const childSpaces = spaces.filter((space) => space.parentId === id);
  const childMoments = moments.filter((moment) => moment.spaceId === id);
  const now = new Date().toISOString();
  const tx = database.transaction(["spaces", "moments"], "readwrite");
  try {
    for (const child of childSpaces) {
      await tx.objectStore("spaces").put({ ...child, parentId: existing.parentId, updatedAt: now });
    }
    for (const moment of childMoments) {
      await tx.objectStore("moments").put({ ...moment, spaceId: existing.parentId, updatedAt: now });
    }
    await tx.objectStore("spaces").delete(id);
    await tx.done;
  } catch (error) {
    throw asStorageError(error);
  }

  return {
    parentId: existing.parentId,
    movedSpaces: childSpaces.length,
    movedMoments: childMoments.length,
  };
}

export function rootSpaces(spaces: Space[]) {
  const ids = new Set(spaces.map((space) => space.id));
  return spaces
    .filter((space) => space.parentId === null || !ids.has(space.parentId))
    .sort(compareSpaces);
}

export function childSpaces(spaces: Space[], parentId: string) {
  return spaces.filter((space) => space.parentId === parentId).sort(compareSpaces);
}

export function momentsInSpace(moments: Moment[], spaceId: string | null) {
  return sortMoments(moments.filter((moment) => moment.spaceId === spaceId));
}

export function spaceTree(spaces: Space[]) {
  const ids = new Set(spaces.map((space) => space.id));
  const byParent = new Map<string | null, Space[]>();
  for (const space of spaces) {
    const parentId = space.parentId && ids.has(space.parentId) ? space.parentId : null;
    const list = byParent.get(parentId) ?? [];
    list.push(space);
    byParent.set(parentId, list);
  }
  for (const list of byParent.values()) {
    list.sort(compareSpaces);
  }

  const rows: { space: Space; depth: number }[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const space of byParent.get(parentId) ?? []) {
      rows.push({ space, depth });
      walk(space.id, depth + 1);
    }
  };
  walk(null, 0);
  return rows;
}

export function descendantIds(spaces: Space[], id: string) {
  const ids = new Set<string>();
  const walk = (parentId: string) => {
    for (const space of spaces) {
      if (space.parentId === parentId && !ids.has(space.id)) {
        ids.add(space.id);
        walk(space.id);
      }
    }
  };
  walk(id);
  return ids;
}

function isDescendant(spaces: Space[], ancestorId: string, nodeId: string) {
  return descendantIds(spaces, ancestorId).has(nodeId);
}

function compareSpaces(a: Space, b: Space) {
  const name = a.name.localeCompare(b.name, "zh");
  if (name !== 0) {
    return name;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function cleanName(name: string) {
  const next = name.trim();
  if (!next) {
    throw new Error("空间需要名称");
  }
  return [...next].slice(0, 40).join("");
}
