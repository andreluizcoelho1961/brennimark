import type { FullConfig } from "@playwright/test";
import { PAGINAS_DO_SITE } from "../src/lib/site/paginas";
import { caminhoDoSite } from "../src/lib/site/idiomas";

/**
 * Aquece o servidor de desenvolvimento ANTES dos testes: abre, uma de cada vez,
 * toda página do site, em português e em inglês.
 *
 * Por quê (24/10/2026): a suíte roda sobre `next dev`, que compila cada rota na
 * primeira visita e, a cada rota com `generateStaticParams` (todas as de `[lang]`),
 * REESCREVE `.next/dev/prerender-manifest.json`. Duas rotas novas compiladas ao
 * mesmo tempo (os testes rodam em paralelo) fazem as gravações se atropelarem, o
 * JSON fica com lixo depois do fim ("Unexpected non-whitespace character after
 * JSON") e o servidor inteiro passa a falhar — uma rodada de 317 testes
 * vermelhos. Compilar as páginas em fila, antes, tira a concorrência do caminho.
 *
 * Falhar aqui não derruba a suíte: é só aquecimento.
 */
const PAGINAS_SEM_MENU = ["/", "/ferramentas/kit", "/ferramentas/cores", "/ferramentas/grids", "/ferramentas/janela/kit", "/ferramentas/janela/cores", "/ferramentas/janela/grids"];

export default async function aquecer(config: FullConfig) {
  const base = config.projects[0]?.use.baseURL;
  if (!base) return;
  const caminhosPt = [...PAGINAS_SEM_MENU, ...PAGINAS_DO_SITE.map((p) => `/${p.slug}`)];
  const urls = [...caminhosPt, ...caminhosPt.map((c) => caminhoDoSite("en", c))];
  let falhas = 0;
  for (const caminho of urls) {
    try {
      await fetch(new URL(caminho, base), { redirect: "follow", signal: AbortSignal.timeout(90_000) });
    } catch {
      falhas++;
    }
  }
  // A Central de ajuda: os artigos e as categorias saem do que a própria /ajuda lista, e a
  // busca (`/api/ajuda`) é a que os testes de ajuda usam logo no início da suíte.
  try {
    const html = await (await fetch(new URL("/ajuda", base), { signal: AbortSignal.timeout(90_000) })).text();
    const links = [...new Set([...html.matchAll(/href="(\/ajuda\/[a-z0-9\-/]+)"/g)].map((m) => m[1]))];
    for (const caminho of [...links, "/api/ajuda"]) {
      try { await fetch(new URL(caminho, base), { redirect: "follow", signal: AbortSignal.timeout(90_000) }); } catch { falhas++; }
    }
  } catch {
    falhas++;
  }
  if (falhas) console.warn(`[aquecimento] ${falhas} de ${urls.length} páginas não responderam; os testes seguem.`);
}
