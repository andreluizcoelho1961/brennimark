import type { NextConfig } from "next";

/**
 * A guarda vigiava o NOME ERRADO, e por isso não guardava nada.
 *
 * O código lê `BRENNIMARK_DEV_SKIP_AUTH` em cinco lugares, incluindo o
 * middleware. Esta verificação checava `BRENNIMARK_DEV_SKIP_AUTH` — o codinome
 * legado. A renomeação trocou os leitores e esqueceu o guarda, então ligar a
 * flag em produção NÃO derrubava o build: servia o produto sem autenticação, em
 * silêncio.
 *
 * BRENNIMARK_DEV_SKIP_AUTH desliga a verificação de sessão e serve o conteúdo
 * estático do guide sem login. É uma conveniência de desenvolvimento local e
 * nunca deve alcançar um ambiente publicado — demonstrações comerciais usam uma
 * instalação sanitizada com autenticação real, não esta flag.
 */
if (process.env.BRENNIMARK_DEV_SKIP_AUTH === "true" && process.env.NODE_ENV === "production") {
  throw new Error(
    "BRENNIMARK_DEV_SKIP_AUTH=true em build de producao. Essa flag serve o guide sem autenticacao " +
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
/**
 * Host, protocolo E porta do Storage, os três da MESMA URL.
 *
 * O protocolo estava fixo em `https` e a porta não era considerada — o que
 * funciona contra o Supabase hospedado e falha contra o stack local, que é
 * `http://127.0.0.1:54321`. O sintoma não é sutil: `next/image` recusa a URL
 * com "Invalid src prop" e a página inteira cai no limite de erro.
 *
 * Presumir o protocolo do ambiente publicado é o tipo de suposição que só
 * aparece quando alguém tenta rodar o produto localmente pela primeira vez.
 */
const supabaseImagem = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return undefined;
  const { hostname, protocol, port } = new URL(url);
  return {
    hostname,
    protocol: protocol.replace(":", "") as "http" | "https",
    ...(port ? { port } : {}),
  };
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
    remotePatterns: supabaseImagem
      ? [{ ...supabaseImagem, pathname: "/storage/v1/object/sign/**" }]
      : [],
  },
};

export default nextConfig;
