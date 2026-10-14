import { Book, Coffee, Layers, Leaf, Map, Music, Sparkles, type LucideIcon } from "lucide-react";
import { resolveSpaceIcon, type SpaceIcon } from "@/lib/model";
import { cn } from "@/lib/utils";

const ICONS: Record<SpaceIcon, LucideIcon> = {
  layers: Layers,
  book: Book,
  coffee: Coffee,
  sparkles: Sparkles,
  map: Map,
  leaf: Leaf,
  music: Music,
};

export function SpaceBadge({ icon, className }: { icon?: string; className?: string }) {
  const Icon = ICONS[resolveSpaceIcon(icon)];
  return (
    <span
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-[14px] bg-[#8C7358] text-[#F7F4EF]",
        className,
      )}
    >
      <Icon className="size-5" strokeWidth={1.75} aria-hidden="true" />
    </span>
  );
}
