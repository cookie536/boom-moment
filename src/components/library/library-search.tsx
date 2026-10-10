import { Search, X } from "lucide-react";
import { text } from "@/constants/text";

type LibrarySearchProps = {
  value: string;
  onChange: (value: string) => void;
};

export function LibrarySearch({ value, onChange }: LibrarySearchProps) {
  return (
    <label className="flex h-11 items-center gap-2 rounded-2xl bg-white px-3.5 ring-1 ring-black/5">
      <Search className="size-[18px] shrink-0 text-neutral-400" aria-hidden="true" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={text.search}
        aria-label={text.search}
        enterKeyHint="search"
        className="min-w-0 flex-1 bg-transparent text-[17px] text-neutral-950 caret-neutral-950 placeholder:text-neutral-400 focus:outline-none"
      />
      {value ? (
        <button
          type="button"
          aria-label={text.clearSearch}
          onClick={() => onChange("")}
          className="flex size-6 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-neutral-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300"
        >
          <X className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
        </button>
      ) : null}
    </label>
  );
}
