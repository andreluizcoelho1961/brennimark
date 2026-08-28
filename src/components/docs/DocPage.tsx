import Image from "next/image";
import type { DocPageEntry } from "@/content/docs";
import { StatusBadge } from "@/components/docs/StatusBadge";
import { AssetGrid } from "@/components/docs/AssetGrid";
import { BlockRenderer } from "@/components/docs/blocks/BlockRenderer";
import { brandvilleInstance } from "@/brandville/config";

function Title({ title }: { title: string }) {
  const words = title.split(" ");
  const lastWord = words.pop();
  const rest = words.join(" ");

  return (
    <h1
      className="break-words font-brand font-black uppercase leading-[0.9] tracking-tight text-release-analog-white"
      style={{ fontSize: "clamp(2rem, 4.5vw, 4rem)", overflowWrap: "anywhere" }}
    >
      {rest && `${rest} `}
      <span className={rest ? "text-release-analog-turquoise" : undefined}>{lastWord}</span>
    </h1>
  );
}

export function DocPage({ entry, children }: { entry: DocPageEntry; children?: React.ReactNode }) {
  const [heroImage, ...restImages] = entry.images ?? [];
  const hasBody = Boolean(entry.body && entry.body.length > 0);
  const isEnglish = brandvilleInstance.metadata.language === "en";

  return (
    <article className="px-page-inline py-12 md:py-16">
      <div className={`grid gap-10 ${heroImage ? "md:grid-cols-12" : ""}`}>
        <div className={heroImage ? "md:col-span-7" : "max-w-3xl"}>
          <div className="mb-6 inline-flex w-fit items-center gap-3 bg-release-analog-turquoise px-4 py-1.5">
            <span className="font-display text-[11px] font-black uppercase tracking-[0.2em] text-release-analog-black">
              {entry.group}
            </span>
          </div>

          <Title title={entry.title} />

          <div className="mt-5">
            <StatusBadge status={entry.status} />
          </div>

          {hasBody && (
            <div className="mt-10 space-y-5 border-l-2 border-release-analog-turquoise pl-8">
              {entry.body!.map((paragraph, i) => (
                <p key={i} className="text-base leading-relaxed text-text-secondary md:text-lg">
                  {paragraph}
                </p>
              ))}
            </div>
          )}

          {entry.status === "pending" && !hasBody && !heroImage && (
            <p className="mt-10 border border-dashed border-border-default px-5 py-4 text-sm leading-relaxed text-text-secondary">
              {isEnglish
                ? "This page depends on a brand strategy decision that hasn't been made yet — it isn't something that can be written from the material we already have. It stays open until there's real input for it."
                : "Esta página depende de uma decisão de estratégia de marca que ainda não foi feita — não é algo que se escreve a partir do material que já temos. Fica em aberto até existir input real pra isso."}
            </p>
          )}
        </div>

        {heroImage && (
          <div className="md:col-span-4 md:col-start-9">
            <div className="relative aspect-[4/5] overflow-hidden border border-border-default">
              <Image src={heroImage.src} alt={heroImage.alt} fill className="object-cover" />
            </div>
            {heroImage.caption && (
              <p className="mt-3 font-display text-[10px] font-bold uppercase tracking-wide text-text-secondary">
                {heroImage.caption}
              </p>
            )}
          </div>
        )}
      </div>

      {entry.blocks && entry.blocks.length > 0 && (
        <div className="mt-16 space-y-16">
          {entry.blocks.map((block, i) => (
            <BlockRenderer key={i} block={block} />
          ))}
        </div>
      )}

      {restImages.length > 0 && <AssetGrid images={restImages} />}

      {children && <div className="mt-16 border-t border-border-default pt-14">{children}</div>}
    </article>
  );
}
