"use client";

import { Library, SquarePen, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { text } from "@/constants/text";
import { cn } from "@/lib/utils";

const tabs = [
  { id: "capture", label: text.capture, href: "/", icon: SquarePen },
  { id: "library", label: text.library, href: "/library", icon: Library },
  { id: "me", label: text.me, href: null, icon: UserRound },
] as const;

export function BottomTabBar() {
  const pathname = usePathname();
  const active = pathname.startsWith("/library") ? "library" : "capture";

  return (
    <nav
      aria-label={text.primaryNav}
      className="fixed inset-x-0 bottom-0 z-10 border-t border-neutral-200 bg-white"
    >
      <div className="mx-auto grid max-w-lg grid-cols-3 px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {tabs.map(({ id, label, href, icon: Icon }) => {
          const isActive = id === active;
          const className = cn(
            "flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300",
            isActive ? "text-neutral-950" : "text-neutral-400",
          );
          const icon = (
            <Icon
              className="size-[22px]"
              strokeWidth={isActive ? 2.25 : 1.75}
              aria-hidden="true"
            />
          );

          if (!href) {
            return (
              <button key={id} type="button" className={className}>
                {icon}
                {label}
              </button>
            );
          }

          return (
            <Link
              key={id}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={className}
            >
              {icon}
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
