import { libraryRoots, text } from "@/constants/text";

export type NodeNote = {
  id: string;
  text: string;
};

export type NodeOrigin = "UserCreated" | "AIGeneratedKnowledgePoint";

export type SectionContent = {
  id: string;
  text: string;
  createdAt: string;
};

export type KnowledgeSection = {
  id: string;
  title: string;
  contents: SectionContent[];
};

export type LibraryNode = {
  id: string;
  title: string;
  description?: string;
  origin?: NodeOrigin;
  notes: NodeNote[];
  sections: KnowledgeSection[];
  children: LibraryNode[];
};

export type CaptureInput = {
  title: string;
  description: string;
  notes: string[];
  knowledgePoints?: { title: string; summary: string }[];
};

export const initialLibraryNodes: LibraryNode[] = libraryRoots.map((root) => ({
  id: root.id,
  title: root.title,
  notes: [],
  sections: [],
  children: [],
}));

export function createLibraryId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function findNode(nodes: LibraryNode[], id: string): LibraryNode | null {
  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }

    const child = findNode(node.children, id);
    if (child) {
      return child;
    }
  }

  return null;
}

export function formatContentDate(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}.${month}.${day}`;
}

export function createCaptureNode(capture: CaptureInput): LibraryNode {
  const createdAt = formatContentDate();
  const original = capture.description.trim();
  const points = (capture.knowledgePoints ?? []).filter((point) => point.title.trim());

  return {
    id: createLibraryId(),
    title: capture.title.trim() || text.untitled,
    description: capture.description,
    origin: "UserCreated",
    notes: [],
    sections: [
      ...(original
        ? [
            {
              id: createLibraryId(),
              title: text.readingSection,
              contents: [{ id: createLibraryId(), text: original, createdAt }],
            },
          ]
        : []),
      ...points.map((point) => ({
        id: createLibraryId(),
        title: point.title.trim(),
        contents: point.summary.trim()
          ? [{ id: createLibraryId(), text: point.summary.trim(), createdAt }]
          : [],
      })),
    ],
    children: points.map((point) => ({
      id: createLibraryId(),
      title: point.title.trim(),
      description: point.summary.trim() || undefined,
      origin: "AIGeneratedKnowledgePoint" as const,
      notes: [],
      sections: point.summary.trim()
        ? [
            {
              id: createLibraryId(),
              title: text.readingSection,
              contents: [{ id: createLibraryId(), text: point.summary.trim(), createdAt }],
            },
          ]
        : [],
      children: [],
    })),
  };
}

export function placeCapture(
  nodes: LibraryNode[],
  categoryPath: string,
  capture: LibraryNode,
): { nodes: LibraryNode[]; parentId: string; ancestorIds: string[]; label: string } {
  const segments = categoryPath
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length === 0) {
    return { nodes, parentId: capture.id, ancestorIds: [], label: capture.title };
  }

  const placed = insertAlongPath(nodes, segments, capture);
  return {
    nodes: placed.nodes,
    parentId: placed.parentId,
    ancestorIds: placed.ancestorIds,
    label: segments.at(-1) ?? capture.title,
  };
}

function insertAlongPath(
  nodes: LibraryNode[],
  segments: string[],
  capture: LibraryNode,
): { nodes: LibraryNode[]; parentId: string; ancestorIds: string[] } {
  const [head, ...rest] = segments;
  const index = nodes.findIndex((node) => node.title.toLowerCase() === head.toLowerCase());

  if (index < 0) {
    const created: LibraryNode = {
      id: createLibraryId(),
      title: head,
      notes: [],
      sections: [],
      children: [],
    };
    const placed = insertAlongPath([created], segments, capture);
    return { ...placed, nodes: [...placed.nodes, ...nodes] };
  }

  const current = nodes[index];
  if (rest.length === 0) {
    return {
      parentId: current.id,
      ancestorIds: [current.id],
      nodes: nodes.map((node, nodeIndex) =>
        nodeIndex === index ? { ...current, children: [capture, ...current.children] } : node,
      ),
    };
  }

  const placed = insertAlongPath(current.children, rest, capture);
  return {
    parentId: placed.parentId,
    ancestorIds: [current.id, ...placed.ancestorIds],
    nodes: nodes.map((node, nodeIndex) =>
      nodeIndex === index ? { ...current, children: placed.nodes } : node,
    ),
  };
}

export function insertCapture(
  nodes: LibraryNode[],
  categoryName: string,
  capture: LibraryNode,
  categoryId: string,
): { nodes: LibraryNode[]; parentId: string } {
  const name = categoryName.trim();
  const existing = nodes.find((node) => node.title.toLowerCase() === name.toLowerCase());

  if (existing) {
    return {
      parentId: existing.id,
      nodes: nodes.map((node) =>
        node.id === existing.id ? { ...node, children: [capture, ...node.children] } : node,
      ),
    };
  }

  return {
    parentId: categoryId,
    nodes: [
      {
        id: categoryId,
        title: name,
        notes: [],
        sections: [],
        children: [capture],
      },
      ...nodes,
    ],
  };
}

export function addChildNode(
  nodes: LibraryNode[],
  parentId: string,
  child: LibraryNode,
): LibraryNode[] {
  return nodes.map((node) => {
    if (node.id === parentId) {
      return { ...node, children: [child, ...node.children] };
    }

    return {
      ...node,
      children: addChildNode(node.children, parentId, child),
    };
  });
}

export function addNote(
  nodes: LibraryNode[],
  nodeId: string,
  note: NodeNote,
): LibraryNode[] {
  return nodes.map((node) => {
    if (node.id === nodeId) {
      return { ...node, notes: [...node.notes, note] };
    }

    return { ...node, children: addNote(node.children, nodeId, note) };
  });
}

export function updateNoteText(
  nodes: LibraryNode[],
  nodeId: string,
  noteId: string,
  text: string,
): LibraryNode[] {
  return nodes.map((node) => {
    if (node.id === nodeId) {
      return {
        ...node,
        notes: node.notes.map((note) => (note.id === noteId ? { ...note, text } : note)),
      };
    }

    return {
      ...node,
      children: updateNoteText(node.children, nodeId, noteId, text),
    };
  });
}

export function removeNote(
  nodes: LibraryNode[],
  nodeId: string,
  noteId: string,
): LibraryNode[] {
  return nodes.map((node) => {
    if (node.id === nodeId) {
      return { ...node, notes: node.notes.filter((note) => note.id !== noteId) };
    }

    return { ...node, children: removeNote(node.children, nodeId, noteId) };
  });
}

export function pruneEmptyNotes(
  nodes: LibraryNode[],
  editingNoteId: string | null,
): LibraryNode[] {
  return nodes.map((node) => ({
    ...node,
    notes: node.notes.filter((note) => note.text.trim() || note.id === editingNoteId),
    children: pruneEmptyNotes(node.children, editingNoteId),
  }));
}

export function readingSections(node: LibraryNode): KnowledgeSection[] {
  if (node.sections.length > 0) {
    return node.sections;
  }

  const body = node.description?.trim();
  if (!body) {
    return [];
  }

  return [
    {
      id: `${node.id}-reading`,
      title: text.readingSection,
      contents: [{ id: `${node.id}-reading-body`, text: body, createdAt: "" }],
    },
  ];
}

function storedSections(node: LibraryNode): KnowledgeSection[] {
  if (node.sections.length > 0) {
    return node.sections;
  }

  const body = node.description?.trim();
  if (!body) {
    return [];
  }

  return [
    {
      id: `${node.id}-reading`,
      title: text.readingSection,
      contents: [{ id: `${node.id}-reading-body`, text: body, createdAt: "" }],
    },
  ];
}

function mapLibraryNode(
  nodes: LibraryNode[],
  id: string,
  update: (node: LibraryNode) => LibraryNode,
): LibraryNode[] {
  return nodes.map((node) => {
    if (node.id === id) {
      return update(node);
    }

    return { ...node, children: mapLibraryNode(node.children, id, update) };
  });
}

export function addKnowledgeSection(
  nodes: LibraryNode[],
  nodeId: string,
  section: KnowledgeSection,
): LibraryNode[] {
  return mapLibraryNode(nodes, nodeId, (node) => ({
    ...node,
    sections: [...storedSections(node), section],
  }));
}

export function updateSectionTitle(
  nodes: LibraryNode[],
  nodeId: string,
  sectionId: string,
  title: string,
): LibraryNode[] {
  return mapLibraryNode(nodes, nodeId, (node) => ({
    ...node,
    sections: node.sections.map((section) =>
      section.id === sectionId ? { ...section, title } : section,
    ),
  }));
}

export function removeKnowledgeSection(
  nodes: LibraryNode[],
  nodeId: string,
  sectionId: string,
): LibraryNode[] {
  return mapLibraryNode(nodes, nodeId, (node) => ({
    ...node,
    sections: node.sections.filter((section) => section.id !== sectionId),
  }));
}

export function addSectionContent(
  nodes: LibraryNode[],
  nodeId: string,
  sectionId: string,
  content: SectionContent,
): LibraryNode[] {
  return mapLibraryNode(nodes, nodeId, (node) => ({
    ...node,
    sections: storedSections(node).map((section) =>
      section.id === sectionId ? { ...section, contents: [...section.contents, content] } : section,
    ),
  }));
}

export function updateSectionContent(
  nodes: LibraryNode[],
  nodeId: string,
  sectionId: string,
  contentId: string,
  text: string,
): LibraryNode[] {
  return mapLibraryNode(nodes, nodeId, (node) => ({
    ...node,
    sections: node.sections.map((section) =>
      section.id === sectionId
        ? {
            ...section,
            contents: section.contents.map((content) =>
              content.id === contentId
                ? { ...content, text, createdAt: content.createdAt || formatContentDate() }
                : content,
            ),
          }
        : section,
    ),
  }));
}

export function removeSectionContent(
  nodes: LibraryNode[],
  nodeId: string,
  sectionId: string,
  contentId: string,
): LibraryNode[] {
  return mapLibraryNode(nodes, nodeId, (node) => ({
    ...node,
    sections: node.sections.map((section) =>
      section.id === sectionId
        ? { ...section, contents: section.contents.filter((content) => content.id !== contentId) }
        : section,
    ),
  }));
}

export function updateNodeDescription(
  nodes: LibraryNode[],
  id: string,
  description: string,
): LibraryNode[] {
  return nodes.map((node) => {
    if (node.id === id) {
      return { ...node, description };
    }

    return {
      ...node,
      children: updateNodeDescription(node.children, id, description),
    };
  });
}

export function updateNodeTitle(
  nodes: LibraryNode[],
  id: string,
  title: string,
): LibraryNode[] {
  return nodes.map((node) => {
    if (node.id === id) {
      return { ...node, title };
    }

    return { ...node, children: updateNodeTitle(node.children, id, title) };
  });
}

export function removeNode(nodes: LibraryNode[], id: string): LibraryNode[] {
  return nodes
    .filter((node) => node.id !== id)
    .map((node) => ({ ...node, children: removeNode(node.children, id) }));
}

export function pruneEmptyNodes(
  nodes: LibraryNode[],
  editingId: string | null,
): LibraryNode[] {
  return nodes
    .filter((node) => node.title.trim() || node.id === editingId)
    .map((node) => ({
      ...node,
      children: pruneEmptyNodes(node.children, editingId),
    }));
}

export function filterLibraryNodes(
  nodes: LibraryNode[],
  query: string,
  editingId: string | null,
): LibraryNode[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return nodes;
  }

  const visible: LibraryNode[] = [];

  for (const node of nodes) {
    const children = filterLibraryNodes(node.children, query, editingId);
    const matches = node.title.toLowerCase().includes(normalized);
    const editing = node.id === editingId;

    if (matches) {
      visible.push(node);
    } else if (editing || children.length > 0) {
      visible.push({ ...node, children });
    }
  }

  return visible;
}
