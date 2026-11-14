/**
 * Cabeçalhos de segurança que TODA resposta do produto leva.
 *
 * Antes de 14/11/2026 o único cabeçalho de segurança era o `strict-transport-security`
 * que a própria Vercel põe. A plataforma podia ser embutida em página de
 * terceiros (clickjacking) e o navegador podia "adivinhar" o tipo de um arquivo
 * enviado por um assinante.
 *
 * Escolhidos pelo que o produto REALMENTE faz — nenhum é cópia de lista pronta:
 *
 *   X-Frame-Options: DENY
 *     Nada no produto usa `<iframe>`/`<embed>` (conferido no código). Ninguém
 *     precisa enquadrar a plataforma, nem o site; a pré-visualização de link
 *     do WhatsApp/LinkedIn lê a imagem, não enquadra a página.
 *
 *   X-Content-Type-Options: nosniff
 *     O produto serve arquivos de assinante (logotipos, PDFs, fontes). Sem isto
 *     o navegador pode tratar um arquivo como outro tipo e executá-lo.
 *
 *   Referrer-Policy: strict-origin-when-cross-origin
 *     Os endereços do produto carregam identificadores de conta e de marca
 *     (`/w/<conta>/b/<marca>/...`). Ao seguir um link para fora, só a origem
 *     sai, nunca o caminho.
 *
 *   Permissions-Policy: camera=(), microphone=(), geolocation=()
 *     O produto não usa câmera, microfone nem localização (conta-gotas de
 *     cores é `EyeDropper`, que não depende destas permissões). Desligadas,
 *     um script injetado não consegue pedi-las em nome do site.
 *
 * FICA DE FORA, de propósito: `Content-Security-Policy`. Uma política
 * restritiva mexe com o worker do PDF.js, o Stripe, os estilos em linha do
 * Next e as imagens do Supabase; quebra o visualizador sem aviso se for
 * escrita no escuro. Entra numa fatia própria, primeiro em modo só-relatório.
 */
export const CABECALHOS_DE_SEGURANCA = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
] as const;
