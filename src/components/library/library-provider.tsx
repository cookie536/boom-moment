"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import {
  addChildNode,
  addKnowledgeSection,
  addNote,
  addSectionContent,
  createCaptureNode,
  createLibraryId,
  findNode,
  initialLibraryNodes,
  placeCapture,
  pruneEmptyNodes,
  pruneEmptyNotes,
  removeKnowledgeSection,
  removeNode,
  removeNote,
  removeSectionContent,
  updateNodeDescription,
  updateNodeTitle,
  updateNoteText,
  updateSectionContent,
  updateSectionTitle,
  type KnowledgeSection,
  type LibraryNode,
  type NodeNote,
  type SectionContent,
} from "@/lib/library-tree";

type LibraryTreeContextValue = {
  nodes: LibraryNode[];
  expandedIds: ReadonlySet<string>;
  editingId: string | null;
  searching: boolean;
  query: string;
  setQuery: (query: string) => void;
  onToggle: (id: string) => void;
  onAdd: (parentId: string) => void;
  onCommit: (id: string, title: string) => void;
  onCancel: (id: string) => void;
  editingNoteId: string | null;
  onDescribe: (id: string, description: string) => void;
  onOpenNote: () => void;
  onAddNote: (nodeId: string) => void;
  onCommitNote: (nodeId: string, noteId: string, text: string) => void;
  onCancelNote: (nodeId: string, noteId: string) => void;
  editingSectionId: string | null;
  editingContentId: string | null;
  onAddSection: (nodeId: string) => void;
  onCommitSection: (nodeId: string, sectionId: string, title: string) => void;
  onCancelSection: (nodeId: string, sectionId: string) => void;
  onAddContent: (nodeId: string, sectionId: string) => void;
  onCommitContent: (nodeId: string, sectionId: string, contentId: string, text: string) => void;
  onCancelContent: (nodeId: string, sectionId: string, contentId: string) => void;
  focusNodeId: string | null;
  clearFocusNode: () => void;
  saveCapture: (
    categoryPath: string,
    capture: { title: string; description: string; notes: string[]; knowledgePoints?: { title: string; summary: string }[] },
  ) => string;
};

const LibraryTreeContext = createContext<LibraryTreeContextValue | null>(null);

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [nodes, setNodes] = useState<LibraryNode[]>(initialLibraryNodes);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingContentId, setEditingContentId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  const searching = query.trim().length > 0;

  const value = useMemo<LibraryTreeContextValue>(
    () => ({
      nodes,
      expandedIds,
      editingId,
      editingNoteId,
      searching,
      query,
      setQuery,
      onToggle: (id) => {
        setExpandedIds((current) => {
          const next = new Set(current);
          if (next.has(id)) {
            next.delete(id);
          } else {
            next.add(id);
          }
          return next;
        });
      },
      onAdd: (parentId) => {
        const child: LibraryNode = {
          id: createLibraryId(),
          title: "",
          origin: "UserCreated",
          notes: [],
          sections: [],
          children: [],
        };

        setEditingNoteId(null);
        setNodes((current) =>
          addChildNode(
            pruneEmptyNotes(pruneEmptyNodes(current, child.id), null),
            parentId,
            child,
          ),
        );
        setExpandedIds((current) => new Set(current).add(parentId));
        setEditingId(child.id);
      },
      onCommit: (id, title) => {
        const trimmed = title.trim();

        setNodes((current) => {
          const existing = findNode(current, id);
          if (!existing) {
            return current;
          }

          if (!trimmed) {
            return existing.title ? current : removeNode(current, id);
          }

          return updateNodeTitle(current, id, trimmed);
        });
        setEditingId((current) => (current === id ? null : current));
      },
      onCancel: (id) => {
        setNodes((current) => {
          const existing = findNode(current, id);
          if (!existing?.title) {
            return removeNode(current, id);
          }

          return current;
        });
        setEditingId((current) => (current === id ? null : current));
      },
      onDescribe: (id, description) => {
        setNodes((current) => updateNodeDescription(current, id, description));
      },
      onOpenNote: () => {
        setNodes((current) => pruneEmptyNotes(pruneEmptyNodes(current, null), null));
        setEditingId(null);
        setEditingNoteId(null);
      },
      onAddNote: (nodeId) => {
        const note: NodeNote = { id: createLibraryId(), text: "" };

        setEditingId(null);
        setNodes((current) =>
          addNote(pruneEmptyNodes(pruneEmptyNotes(current, note.id), null), nodeId, note),
        );
        setEditingNoteId(note.id);
      },
      onCommitNote: (nodeId, noteId, text) => {
        const trimmed = text.trim();

        setNodes((current) => {
          if (!trimmed) {
            return removeNote(current, nodeId, noteId);
          }

          return updateNoteText(current, nodeId, noteId, trimmed);
        });
        setEditingNoteId((current) => (current === noteId ? null : current));
      },
      editingSectionId,
      editingContentId,
      onAddSection: (nodeId) => {
        const section: KnowledgeSection = { id: createLibraryId(), title: "", contents: [] };
        setEditingContentId(null);
        setNodes((current) => addKnowledgeSection(current, nodeId, section));
        setEditingSectionId(section.id);
      },
      onCommitSection: (nodeId, sectionId, title) => {
        const trimmed = title.trim();
        setNodes((current) => {
          if (!trimmed) {
            return removeKnowledgeSection(current, nodeId, sectionId);
          }
          return updateSectionTitle(current, nodeId, sectionId, trimmed);
        });
        setEditingSectionId((current) => (current === sectionId ? null : current));
      },
      onCancelSection: (nodeId, sectionId) => {
        setNodes((current) => {
          const section = findNode(current, nodeId)?.sections.find((item) => item.id === sectionId);
          if (section && !section.title.trim()) {
            return removeKnowledgeSection(current, nodeId, sectionId);
          }
          return current;
        });
        setEditingSectionId((current) => (current === sectionId ? null : current));
      },
      onAddContent: (nodeId, sectionId) => {
        const content: SectionContent = { id: createLibraryId(), text: "", createdAt: "" };
        setEditingSectionId(null);
        setNodes((current) => addSectionContent(current, nodeId, sectionId, content));
        setEditingContentId(content.id);
      },
      onCommitContent: (nodeId, sectionId, contentId, body) => {
        const trimmed = body.trim();
        setNodes((current) => {
          if (!trimmed) {
            return removeSectionContent(current, nodeId, sectionId, contentId);
          }
          return updateSectionContent(current, nodeId, sectionId, contentId, trimmed);
        });
        setEditingContentId((current) => (current === contentId ? null : current));
      },
      onCancelContent: (nodeId, sectionId, contentId) => {
        setNodes((current) => {
          const content = findNode(current, nodeId)
            ?.sections.find((section) => section.id === sectionId)
            ?.contents.find((item) => item.id === contentId);
          if (content && !content.text.trim()) {
            return removeSectionContent(current, nodeId, sectionId, contentId);
          }
          return current;
        });
        setEditingContentId((current) => (current === contentId ? null : current));
      },
      focusNodeId,
      clearFocusNode: () => setFocusNodeId(null),
      saveCapture: (categoryPath, capture) => {
        const child = createCaptureNode(capture);
        const placed = placeCapture(nodes, categoryPath, child);

        setNodes(placed.nodes);
        setExpandedIds((current) => {
          const next = new Set(current);
          for (const id of placed.ancestorIds) {
            next.add(id);
          }
          return next;
        });
        setFocusNodeId(child.id);
        return placed.label;
      },
      onCancelNote: (nodeId, noteId) => {
        setNodes((current) => {
          const note = findNode(current, nodeId)?.notes.find((item) => item.id === noteId);
          if (note && !note.text.trim()) {
            return removeNote(current, nodeId, noteId);
          }

          return current;
        });
        setEditingNoteId((current) => (current === noteId ? null : current));
      },
    }),
    [nodes, expandedIds, editingId, editingNoteId, editingSectionId, editingContentId, focusNodeId, searching, query],
  );

  return <LibraryTreeContext.Provider value={value}>{children}</LibraryTreeContext.Provider>;
}

export function useLibraryTree() {
  const context = useContext(LibraryTreeContext);
  if (!context) {
    throw new Error("useLibraryTree must be used within LibraryProvider");
  }
  return context;
}
