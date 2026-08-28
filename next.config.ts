import path from "node:path";
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
 * Carregador da tipografia DA MARCA — não da interface.
 *
 * A interface tem fonte própria (--font-ui em globals.css) e não depende
 * disto. O que este alias carrega é a fonte da marca consultada, usada apenas
 * em títulos do manual e blocos de espécime (--font-brand).
 *
 * next/font/local emite os arquivos de toda chamada localFont() presente no
 * grafo de módulos, então a instância ativa escolhe o seu módulo aqui em vez
 * de o layout importar todos — assim a fonte licenciada de uma marca nunca é
 * publicada no domínio de outra.
 *
 * Uma instância só precisa de módulo próprio se a fonte da marca for
 * auto-hospedada. Quando a fonte é de sistema ou já está no CSS, deixe fora
 * daqui: `fontStack` na instância basta.
 */
const fontModuleByInstance: Record<string, string> = {};

const activeInstance = process.env.NEXT_PUBLIC_BRANDVILLE_INSTANCE ?? "the-bluesmaker";
// Turbopack resolves the alias as a project-relative specifier; webpack needs an absolute path.
const relativeFontModule = fontModuleByInstance[activeInstance] ?? "./src/fonts/gotham.ts";

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: { "@brand-font": relativeFontModule },
  },
  webpack: (config) => {
    config.resolve.alias = { ...config.resolve.alias, "@brand-font": path.resolve(relativeFontModule) };
    return config;
  },
};

export default nextConfig;
