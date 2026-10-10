type CaptureHeaderProps = {
  title: string;
  subtitle: string;
};

export function CaptureHeader({ title, subtitle }: CaptureHeaderProps) {
  return (
    <header className="px-6 pt-10 pb-10">
      <h1 className="text-[40px] leading-none font-semibold tracking-[-0.03em] text-neutral-950">
        {title}
      </h1>
      <p className="mt-3 text-[17px] leading-snug text-neutral-500">{subtitle}</p>
    </header>
  );
}
