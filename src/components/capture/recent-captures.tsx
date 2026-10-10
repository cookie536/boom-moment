import { text } from "@/constants/text";

export type CaptureItem = {
  id: string;
  title: string;
};

type RecentCapturesProps = {
  items: CaptureItem[];
};

export function RecentCaptures({ items }: RecentCapturesProps) {
  return (
    <section className="mt-14" aria-labelledby="recent-captures-heading">
      <h2
        id="recent-captures-heading"
        className="px-1 text-[22px] font-semibold tracking-[-0.02em] text-neutral-950"
      >
        {text.recent}
      </h2>
      <ul className="mt-4 flex flex-col gap-3">
        {items.map((item) => (
          <li key={item.id}>
            <article className="rounded-2xl bg-white px-5 py-4 text-[17px] leading-snug text-neutral-950 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-black/5">
              {item.title}
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}
