import { BrandCanvas } from "@/components/BrandCanvas";
import { notFound } from "next/navigation";
import { getResolvedBrandDoc } from "@/lib/brandville/server";
import { DocPage } from "@/components/docs/DocPage";
import { ColorSection } from "@/components/ColorSection";
import { TypographySection } from "@/components/TypographySection";
import { PhotographySection } from "@/components/PhotographySection";
import { VoiceSection } from "@/components/VoiceSection";
import { LogoSection } from "@/components/LogoSection";
import { IconographySection } from "@/components/IconographySection";
import { brandvilleInstance } from "@/brandville/config";
import { HairlineBrandSection, HAIRLINE_CUSTOM_SLUGS } from "@/components/hairline/HairlineBrandSection";
import { HairlineStrategySection, HAIRLINE_STRATEGY_SLUGS } from "@/components/hairline/HairlineStrategySection";
import { HairlineVoiceSection, HAIRLINE_VOICE_SLUGS } from "@/components/hairline/HairlineVoiceSection";

const COMPONENT_SLUGS: Record<string, React.ComponentType> = {
  "universo-visual/guia-de-cores": ColorSection,
  "universo-visual/tipografia": TypographySection,
  "universo-visual/imagens-arquetipicas": PhotographySection,
  "universo-verbal/tom-de-voz": VoiceSection,
  "universo-visual/simbolos-e-logotipos": LogoSection,
  "universo-visual/iconografia": IconographySection,
};

export default async function DocSlugPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const path = slug.join("/");
  const entry = await getResolvedBrandDoc(path);

  if (!entry) {
    notFound();
  }

  const CustomComponent = COMPONENT_SLUGS[path];
  const isHairlineVisual = brandvilleInstance.key === "hairline" && HAIRLINE_CUSTOM_SLUGS.has(path);
  const isHairlineStrategy = brandvilleInstance.key === "hairline" && HAIRLINE_STRATEGY_SLUGS.has(path);
  const isHairlineVoice = brandvilleInstance.key === "hairline" && HAIRLINE_VOICE_SLUGS.has(path);
  const isHairlineCustom = isHairlineVisual || isHairlineStrategy || isHairlineVoice;
  const displayEntry = isHairlineCustom ? { ...entry, body: undefined, images: undefined } : entry;

  return (
    <BrandCanvas>
      <DocPage entry={displayEntry}>
        {CustomComponent && (
          <div className="mt-8">
            <CustomComponent />
          </div>
        )}
        {isHairlineVisual && <HairlineBrandSection slug={path} />}
        {isHairlineStrategy && <HairlineStrategySection slug={path} />}
        {isHairlineVoice && <HairlineVoiceSection slug={path} />}
      </DocPage>
    </BrandCanvas>
  );
}
