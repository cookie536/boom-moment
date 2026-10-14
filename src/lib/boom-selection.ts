const SELECTION_KEY = "boom-moment-selection";

export function uniqueIds(values: readonly string[]) {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const value of values) {
    const id = value.trim();
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

export function boomQuery(ids: readonly string[]) {
  return ids.map((id) => `m=${encodeURIComponent(id)}`).join("&");
}

export function readBoomSelection() {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const value = JSON.parse(window.sessionStorage.getItem(SELECTION_KEY) ?? "[]") as unknown;
    if (!Array.isArray(value)) {
      return [];
    }
    return uniqueIds(value.filter((item): item is string => typeof item === "string"));
  } catch {
    return [];
  }
}

export function writeBoomSelection(ids: readonly string[]) {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.setItem(SELECTION_KEY, JSON.stringify(uniqueIds(ids)));
}
