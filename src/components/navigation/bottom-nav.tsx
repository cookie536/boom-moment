"use client";

import { Home, Layers, Plus, Settings, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { text } from "@/constants/text";
import { cn } from "@/lib/utils";

const tabs = [
  { id: "home", label: text.v1.home, href: "/", icon: Home },
  { id: "spaces", label: text.v1.spaces, href: "/spaces", icon: Layers },
  { id: "create", label: text.v1.create, href: "/moments/new", icon: Plus },
  { id: "boom", label: text.v1.boom, href: "/boom", icon: Sparkles },
  { id: "settings", label: text.v1.settings, href: "/settings", icon: Settings },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const hidden = pathname === "/moments/new" || pathname.endsWith("/edit") || pathname.startsWith("/boom/compare");
  if (hidden) {
    return null;
  }

  return (
    <nav
      aria-label={text.v1.nav}
      className="fixed inset-x-0 bottom-0 z-20 border-t border-[#EAEAEA] bg-white"
    >
      <div className="mx-auto grid max-w-lg grid-cols-5 px-2 pt-1 pb-[max(0.35rem,env(safe-area-inset-bottom))]">
        {tabs.map(({ id, label, href, icon: Icon }) => {
          const active =
            id === "home"
              ? pathname === "/" || pathname.startsWith("/moments") || pathname === "/search"
              : pathname === href || pathname.startsWith(`${href}/`);
          const center = id === "create";
          const destination = center ? createHref(pathname) : href;

          return (
            <Link
              key={id}
              href={destination}
              aria-current={active && !center ? "page" : undefined}
              aria-label={label}
              className={cn(
                "flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-[14px] text-[11px] font-medium",
                active ? "text-[#171717]" : "text-[#8A8A8E]",
              )}
            >
              <Icon
                className={center ? "size-7" : "size-[22px]"}
                strokeWidth={active || center ? 2.25 : 1.75}
                aria-hidden="true"
              />
              {center ? <span className="sr-only">{label}</span> : label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function createHref(pathname: string) {
  const match = pathname.match(/^\/spaces\/([^/]+)$/);
  if (!match || match[1] === "unclassified") {
    return "/moments/new";
  }
  return `/moments/new?space=${encodeURIComponent(match[1])}`;
}
