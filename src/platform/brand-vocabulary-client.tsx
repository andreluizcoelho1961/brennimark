"use client";

import { createContext, useContext } from "react";
import { resolveStatusLabels, type StatusLabels } from "@/components/docs/status";

/**
 * O vocabulário editorial da marca, para os componentes de cliente.
 *
 * Ele não é idioma de interface — é conteúdo: a marca declara como chama os
 * próprios estados, e pode chamá-los de "Documentado" ou "Em validação". Por
 * isso vive num provedor separado do de locale, alimentado pela marca
 * resolvida, e não pelo idioma de quem está lendo.
 *
 * Sem marca, o vocabulário padrão do produto responde — é o que a tela sem
 * marca precisa para não quebrar.
 */
const VocabularyContext = createContext<StatusLabels>(
  resolveStatusLabels({ language: "pt-BR" }),
);

export function BrandVocabularyProvider({
  language,
  statusLabels,
  children,
}: {
  language?: string;
  statusLabels?: StatusLabels;
  children: React.ReactNode;
}) {
  const labels = resolveStatusLabels({ language: language ?? "pt-BR", override: statusLabels });
  return <VocabularyContext.Provider value={labels}>{children}</VocabularyContext.Provider>;
}

export function useStatusLabels(): StatusLabels {
  return useContext(VocabularyContext);
}
