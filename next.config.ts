import type { NextConfig } from "next";

/**
 * BRANDVILLE_DEV_SKIP_AUTH desliga a verificação de sessão e serve o conteúdo
 * estático do guide sem login. É uma conveniência de desenvolvimento local e
 * nunca deve alcançar um ambiente publicado — demonstrações comerciais usam uma
 * instalação sanitizada com autenticação real, não esta flag.
 */
if (process.env.BRANDVILLE_DEV_SKIP_AUTH === "true" && process.env.NODE_ENV === "production") {
  throw new Error(
    "BRANDVILLE_DEV_SKIP_AUTH=true em build de producao. Essa flag serve o guide sem autenticacao " +
      "e e exclusiva de desenvolvimento local. Remova-a das variaveis de ambiente deste deploy.",
  );
}

/**
 * Sem alias de fonte.
 *
 * A tipografia da interface vive em --font-ui (globals.css) e não depende de
 * arquivo embutido. A tipografia da marca chega pelo `fontStack` da instância,
 * como valor — a plataforma não hospeda fonte licenciada de cliente algum.
 *
 * Quando uma marca precisar de fonte auto-hospedada, ela virá como asset dela,
 * servido pelo bucket da marca, não compilado no bundle do produto.
 */
const supabaseHost = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return url ? new URL(url).hostname : undefined;
})();

const nextConfig: NextConfig = {
  images: {
    /*
     * Achado da auditoria de produto (04/09): sem isto, `next/image` não
     * carrega URL nenhuma do Supabase Storage — nem asset da biblioteca,
     * nem a imagem de página inteira da Fase 1g. `next.config.ts` nunca
     * teve `remotePatterns`, porque nada até agora tentava exibir uma
     * imagem vinda de fora de `/public`.
     */
    remotePatterns: supabaseHost
      ? [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/sign/**" }]
      : [],
  },
};

export default nextConfig;
