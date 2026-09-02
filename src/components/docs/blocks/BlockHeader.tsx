export function BlockHeader({ eyebrow, title }: { eyebrow?: string; title?: string }) {
  if (!eyebrow && !title) return null;

  return (
    <header className="mb-8">
      {eyebrow && (
        <p className="font-display text-[10px] font-black uppercase tracking-[0.2em] text-brand-accent">
          {eyebrow}
        </p>
      )}
      {title && (
        <h2 className="mt-3 font-brand text-2xl font-black uppercase leading-tight tracking-tight text-brand-text md:text-3xl">
          {title}
        </h2>
      )}
    </header>
  );
}
