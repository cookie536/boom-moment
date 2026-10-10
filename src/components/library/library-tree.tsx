import { LibraryNode } from "@/components/library/library-node";
import { text } from "@/constants/text";
import type { LibraryNode as LibraryNodeData } from "@/lib/library-tree";
import { cn } from "@/lib/utils";

type LibraryTreeProps = {
  nodes: LibraryNodeData[];
  depth?: number;
};

export function LibraryTree({ nodes, depth = 0 }: LibraryTreeProps) {
  if (nodes.length === 0) {
    return null;
  }

  return (
    <ul
      aria-label={depth === 0 ? text.library : undefined}
      className={cn("flex flex-col gap-2", depth > 0 && "mt-2")}
    >
      {nodes.map((node) => (
        <LibraryNode key={node.id} node={node} depth={depth} />
      ))}
    </ul>
  );
}
