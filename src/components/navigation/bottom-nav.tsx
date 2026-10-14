"use client";

import { Home, Layers, Plus, Settings, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { text } from "@/constants/text";
import { consumeToast, toastEventName } from "@/lib/toast";
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
  const hidden = pathname === "/moments/new" || pathname.endsWith("/edit") || pathname.startsWith("/boom/");
  if (hidden) {
    return null;
  }

  return (
    <>
      <ToastNotice />
      <nav
        aria-label={text.v1.nav}
        className="fixed inset-x-0 bottom-0 z-20 border-t border-[#E7E0D6] bg-[#F7F4EF]"
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
                "flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-[14px] text-[11px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8C7358] focus-visible:ring-offset-2 active:opacity-70",
                center || active ? "text-[#2C2825]" : "text-[#8A8178]",
              )}
            >
              <Icon
                className={center ? "size-7" : "size-[22px]"}
                strokeWidth={active || center ? 2 : 1.75}
                aria-hidden="true"
              />
              {center ? <span className="sr-only">{label}</span> : label}
            </Link>
          );
        })}
      </div>
      </nav>
    </>
  );
}

export function ToastNotice() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const queued = consumeToast();
    if (queued) {
      setMessage(queued);
    }
    const onToast = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (detail) {
        setMessage(detail);
      }
    };
    window.addEventListener(toastEventName(), onToast);
    return () => window.removeEventListener(toastEventName(), onToast);
  }, []);

  useEffect(() => {
    if (!message) {
      return;
    }
    const timer = window.setTimeout(() => setMessage(null), 2200);
    return () => window.clearTimeout(timer);
  }, [message]);

  if (!message) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 flex justify-center px-5">
      <p role="status" className="rounded-full bg-[#2C2825] px-4 py-2 text-[13px] text-[#F7F4EF]">
        {message}
      </p>
    </div>
  );
}

function createHref(pathname: string) {
  const match = pathname.match(/^\/spaces\/([^/]+)$/);
  if (!match || match[1] === "unclassified") {
    return "/moments/new";
  }
  return `/moments/new?space=${encodeURIComponent(match[1])}`;
}
