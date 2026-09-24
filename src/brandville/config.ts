import type { CSSProperties } from "react";
import { platformCssVars } from "../platform/tokens";

/**
 * O que sobrou deste módulo depois do V1: o tema da PLATAFORMA.
 *
 * Ele já foi o centro do produto. Exportava `brandvilleInstance` — a marca
 * escolhida por `NEXT_PUBLIC_BRANDVILLE_INSTANCE` na inicialização do processo
 * — e um registro de documentos derivado dela. Era global por processo: duas
 * contas servidas pelo mesmo processo veriam a mesma marca.
 *
 * O M1 tirou a resolução de marca daqui e a levou para a requisição; o M2
 * tirou os caminhos de conteúdo; o V1 removeu o que restava. Não há mais
 * instância global, nem registro de documentos em código, nem leitura daquela
 * variável de ambiente em lugar nenhum.
 *
 * O nome do diretório continua `brandville/` e os tipos continuam
 * `Brandville*`. São identificadores internos, que somem na compilação e não
 * aparecem em interface, venda, domínio ou contrato — que é onde o codinome
 * não pode voltar. Renomeá-los seria mexer em muitos arquivos para não mudar
 * nada observável, e o V1 não é sobre renomear.
 */
/*
 * O tema CLARO como estilo em linha. Desde a fatia 6 (24/09/2026) o layout raiz
 * não o usa mais: com dois temas, a paleta vai como CSS gerado
 * (`platformThemeCss`, em `platform/tokens.ts`), que um seletor consegue trocar
 * — estilo em linha nenhum seletor vence. Fica aqui porque `config.test.ts`
 * guarda que este módulo nunca mais exporte instância de marca.
 */
export const platformThemeStyle = {
  ...platformCssVars(),
} as CSSProperties;
