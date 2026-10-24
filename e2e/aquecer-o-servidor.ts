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
 * Pede também os scripts e os estilos que cada página carrega: o `next dev` só compila
 * o JavaScript do navegador quando o navegador o pede pela primeira vez, e uma página
 * "fria" demorava mais de 25 s para acordar (`data-site-vivo`) quando a suíte inteira
 * rodava, o que reprovava testes do site que passam isolados e no CI.
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
  const jaPedidos = new Set<string>();
  /** Abre a página e pede, uma vez só, cada script e estilo que ela referencia. */
  const aquecerPagina = async (caminho: string) => {
    try {
      const resposta = await fetch(new URL(caminho, base), { redirect: "follow", signal: AbortSignal.timeout(90_000) });
      const html = await resposta.text();
      const recursos = [...html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+\.(?:js|css)[^"]*)"/g)].map((m) => m[1]);
      for (const recurso of recursos) {
        if (jaPedidos.has(recurso)) continue;
        jaPedidos.add(recurso);
        try { await (await fetch(new URL(recurso, base), { signal: AbortSignal.timeout(90_000) })).arrayBuffer(); } catch { /* aquecimento */ }
      }
    } catch {
      falhas++;
    }
  };
  for (const caminho of urls) await aquecerPagina(caminho);
  // A Central de ajuda: os artigos e as categorias saem do que a própria /ajuda lista, e a
  // busca (`/api/ajuda`) é a que os testes de ajuda usam logo no início da suíte.
  for (const [inicio, prefixo] of [["/ajuda", "/ajuda"], ["/en/help", "/en/help"]] as const) {
    try {
      const html = await (await fetch(new URL(inicio, base), { signal: AbortSignal.timeout(90_000) })).text();
      const links = [...new Set([...html.matchAll(new RegExp(`href="(${prefixo}/[a-z0-9\\-/]+)"`, "g"))].map((m) => m[1]))];
      for (const caminho of links) await aquecerPagina(caminho);
    } catch {
      falhas++;
    }
  }
  try { await fetch(new URL("/api/ajuda", base), { signal: AbortSignal.timeout(90_000) }); } catch { falhas++; }
  if (falhas) console.warn(`[aquecimento] ${falhas} de ${urls.length} páginas não responderam; os testes seguem.`);
}
