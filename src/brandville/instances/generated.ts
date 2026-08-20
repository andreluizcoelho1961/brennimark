import type { BrandvilleInstance } from "../types";

import { brandvilleInstanceDefinition as empresaModeloInstance } from "./empresa-modelo";
import { brandvilleInstanceDefinition as hairlineInstance } from "./hairline";

// Este arquivo e atualizado pelo onboarding de novas instancias.
export const generatedBrandvilleInstances = {
  "empresa-modelo": empresaModeloInstance,
  "hairline": hairlineInstance,
} satisfies Record<string, BrandvilleInstance>;
