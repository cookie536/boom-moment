"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BottomNav } from "@/components/navigation/bottom-nav";
import { text } from "@/constants/text";
import { searchMoments } from "@/lib/moments";
import { displayTitle, formatWhen, previewText, type Moment } from "@/lib/model";

export function SearchScreen() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Moment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const needle = query.trim();
    if (!needle) {
      setResults(null);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void searchMoments(needle)
        .then((moments) => {
          if (!cancelled) {
            setResults(moments);
            setError(null);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setError(text.v1.loadError);
          }
        });
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  return (
    <div className="mx-auto min-h-dvh w-full max-w-lg bg-[#F7F4EF]">
      <header className="px-5 pt-6">
        <label className="flex min-h-11 items-center gap-2 border-b border-[#E7E0D6]">
          <Search className="size-4 text-[#8A8178]" aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={text.v1.searchPlaceholder}
            aria-label={text.v1.searchPlaceholder}
            className="min-w-0 flex-1 bg-transparent py-3 text-[16px] text-[#2C2825] outline-none placeholder:text-[#8A8178]"
          />
        </label>
      </header>
      <main className="px-5 pt-4 pb-32">
        {error ? <p className="py-10 text-center text-[15px] text-[#8A8178]">{error}</p> : null}
        {!query.trim() ? <p className="py-10 text-center text-[15px] text-[#8A8178]">{text.v1.searchHint}</p> : null}
        {query.trim() && results?.length === 0 ? (
          <p className="py-10 text-center text-[15px] text-[#8A8178]">{text.v1.searchEmpty}</p>
        ) : null}
        <ul>
          {results?.map((moment) => (
            <li key={moment.id} className="border-b border-[#E7E0D6]">
              <Link href={`/moments/${moment.id}`} className="block py-3">
                <p className="text-[16px] font-medium text-[#2C2825]">{displayTitle(moment)}</p>
                {previewText(moment) ? (
                  <p className="mt-1 line-clamp-2 text-[14px] text-[#8A8178]">{previewText(moment)}</p>
                ) : null}
                <p className="mt-1 text-[12px] text-[#8A8178]">{formatWhen(moment.updatedAt)}</p>
              </Link>
            </li>
          ))}
        </ul>
      </main>
      <BottomNav />
    </div>
  );
}
