"use client";

import { BottomNav } from "@/components/navigation/bottom-nav";

export function LaterScreen({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-lg bg-white">
      <header className="px-5 pt-8">
        <h1 className="text-[28px] font-semibold tracking-[-0.03em] text-[#171717]">{title}</h1>
      </header>
      <main className="px-5 pt-4 pb-32">
        <p className="text-[16px] leading-relaxed text-[#8A8A8E]">{body}</p>
      </main>
      <BottomNav />
    </div>
  );
}
