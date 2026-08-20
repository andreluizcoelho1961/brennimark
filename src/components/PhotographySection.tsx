import Image from "next/image";
import { brandvilleInstance } from "@/brandville/config";
import { photographyDirection, photographyGallery } from "@/content/brand";

export function PhotographySection() {
  return (
    <>
      <div className="grid gap-10 md:grid-cols-12">
        <div className="md:col-span-5">
          <div className="relative aspect-[4/5] overflow-hidden border border-border-default">
            <Image
              src="/images/portrait-duotone.png"
              alt={`Referência fotográfica: ${brandvilleInstance.brand.name}`}
              fill
              sizes="(min-width: 768px) 40vw, 100vw"
              className="object-cover object-[30%_15%]"
            />
          </div>
          <p className="mt-3 font-display text-[10px] font-bold uppercase tracking-wide text-text-secondary">
            Reference — Call Me Analog Man campaign
          </p>
        </div>

        <div className="grid gap-8 md:col-span-6 md:col-start-7 md:grid-cols-2">
          <div>
            <p className="font-display text-xs font-bold uppercase tracking-wide text-release-analog-turquoise">
              What we look for
            </p>
            <ul className="mt-3 space-y-1.5">
              {photographyDirection.lookFor.map((item) => (
                <li key={item} className="text-sm leading-relaxed text-text-secondary">
                  — {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-display text-xs font-bold uppercase tracking-wide text-release-analog-white">
              What pulls it off course
            </p>
            <ul className="mt-3 space-y-1.5">
              {photographyDirection.pullsAway.map((item) => (
                <li key={item} className="text-sm leading-relaxed text-text-secondary">
                  — {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="mt-16 border-t border-border-default pt-10">
        <p className="font-display text-xs font-bold uppercase tracking-wide text-release-analog-turquoise">
          Session reference
        </p>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-secondary">
          A single session, shot to the direction above: directional cool
          light, real texture, restrained styling, no posturing. Every
          frame here is duotone-ready — the treatment is a grade applied
          to real photography, not a filter standing in for it.
        </p>

        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {photographyGallery.map((photo) => (
            <div
              key={photo.src}
              className={`relative aspect-[4/5] overflow-hidden border border-border-default ${photo.wide ? "col-span-2 aspect-[16/9] sm:col-span-3" : ""}`}
            >
              <Image
                src={photo.src}
                alt={photo.alt}
                fill
                sizes={photo.wide ? "100vw" : "(min-width: 640px) 30vw, 45vw"}
                className="object-cover"
              />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
