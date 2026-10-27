/**
 * O que o `proxy` deixa passar sem sessão.
 *
 * `/api/manutencao/` entrou em 24/09/2026: quem chama é o Vercel Cron, que não
 * tem sessão — sem a exceção, o `proxy` o redirecionaria para `/login` e a
 * limpeza nunca rodaria, em silêncio (um 307 não é falha no log do Cron).
 *
 * Passar sem sessão NÃO é passar sem autorização: toda rota sob
 * `/api/manutencao/` exige o segredo do Cron por conta própria, antes de
 * qualquer cliente existir. A barra final é de propósito — `/api/manutencaox`
 * não é manutenção.
 *
 * O SITE entrou em 29/09/2026: a home (`/`) e as páginas públicas (`/vini`,
 * `/agencias`…). Estes casam pelo caminho EXATO, nunca por prefixo — `/` como
 * prefixo abriria o produto inteiro, e `/vini` como prefixo abriria qualquer
 * rota que um dia comece assim. Página do site é HTML gerado no deploy e não
 * lê dado nenhum; passar sem sessão não expõe nada.
 *
 * Os LINKS DE ENTREGA entraram em 30/09/2026 (ADR-0007 §2.5): `/receber/` é a
 * página de quem recebeu o link e não tem conta, e `/api/receber/` o download
 * dela. Também aqui, passar sem sessão não é passar sem autorização: as duas
 * só respondem ao código do link, conferido pelo banco a cada pedido. A barra
 * final é de propósito, como na manutenção.
 *
 * O WEBHOOK DO STRIPE entrou em 01/10/2026 (cobrança, fatia 1): quem chama é
 * o Stripe, sem sessão. Casa pelo caminho EXATO, porque as próximas rotas de
 * `/api/cobranca/` (o checkout, o portal) são de quem tem sessão. Passar sem
 * sessão não é passar sem autorização: a rota recusa todo aviso cuja
 * assinatura não confere com o segredo do webhook.
 *
 * A COMPRA entrou no mesmo dia (fatia 2): `/assinar`, `/assinar/obrigado` e
 * `/api/cobranca/checkout`. Quem compra ainda não tem conta. Nenhuma das três
 * dá acesso a nada: a rota só abre a página de pagamento do Stripe, com o
 * preço que o banco escolhe, e a conta continua nascendo só do webhook.
 *
 * A SENHA NA VOLTA entrou em 02/10/2026: `/api/cobranca/senha`, onde quem
 * acabou de pagar cria a senha. Ainda não há sessão. A trava é a prova do
 * navegador — o cookie de quem abriu o checkout, conferido contra o resumo que
 * o Stripe guardou — antes de qualquer consulta (`senha-na-volta.ts`).
 *
 * O "ESQUECI A SENHA" entrou em 03/10/2026: `/esqueci-senha` e
 * `/api/conta/esqueci-senha`. Quem esqueceu a senha não tem sessão. A rota
 * responde o mesmo exista o login ou não, e o que ela faz é mandar um e-mail
 * ao dono do endereço; a troca em si (`/nova-senha`) exige sessão.
 *
 * O BRENNIMARK KIT gratuito entrou em 09/10/2026: `/ferramentas/kit`, pelo
 * caminho EXATO. A página é estática e roda inteira no navegador de quem usa —
 * não lê dado nenhum e não chama API; o logo nem sai do computador.
 *
 * O BRENNIMARK CORES gratuito entrou em 10/10/2026: `/ferramentas/cores`,
 * pelo caminho exato, pelo mesmo motivo do Kit — página estática, tudo no
 * navegador, nenhum dado lido.
 *
 * O BRENNIMARK GRIDS gratuito entrou em 13/10/2026: `/ferramentas/grids`,
 * pelo caminho exato e pelo mesmo motivo — o grid é calculado e o IDML montado
 * no navegador; nenhum dado lido.
 *
 * Os ARTIGOS DA CENTRAL DE AJUDA entraram em 17/10/2026: `/ajuda/<artigo>` e
 * `/ajuda/categoria/<categoria>`, por PREFIXO (`/ajuda/`, com a barra) — a
 * própria `/ajuda` já é do site, pelo caminho exato. São HTML gerado no
 * build a partir de Markdown do repositório; só existem os endereços que o
 * `generateStaticParams` conhece (`dynamicParams = false`), então o prefixo
 * não abre nada além deles. `/ajudax` não casa.
 *
 * O CADASTRO GRATUITO entrou em 17/10/2026: `/api/cadastro`, pelo caminho
 * exato. Quem baixa de uma ferramenta do site não tem conta. A rota não dá
 * acesso a nada: só grava uma linha numa tabela fechada a qualquer sessão, com
 * a chave de serviço, e responde igual exista o e-mail ou não.
 *
 * A SAÍDA DA LISTA entrou no mesmo dia: `/sair/` (a página do link de todo
 * e-mail de marketing) e `/api/cadastro/saida`. Quem recebe o e-mail não tem
 * conta. A página não lê nada, e a rota só obedece ao token que o banco conferiu.
 *
 * A SAÍDA EM UM CLIQUE entrou em 22/10/2026: `/api/sair/` (prefixo, o token vai no
 * endereço). É o endereço do cabeçalho `List-Unsubscribe` de todo e-mail de
 * marketing: o Gmail e o iCloud fazem um POST sem sessão. Só PARA de receber, e
 * quem decide é o token que o banco conferiu. Fica fora de `/api/cadastro` para
 * a regra de limite do Firewall não barrar o provedor de e-mail.
 *
 * A CONFIRMAÇÃO DO E-MAIL entrou em 18/10/2026: `/confirmar/` (a página do botão
 * do e-mail) e `/api/cadastro/confirmar`. Mesmo desenho da saída: quem recebe o
 * e-mail não tem conta, a página não lê nada, e a rota só obedece ao token que o
 * banco conferiu.
 *
 * A FERRAMENTA EM JANELA SOLTA entrou em 21/10/2026: `/ferramentas/janela/kit`,
 * `/ferramentas/janela/cores` e `/ferramentas/janela/grids`, cada um pelo caminho
 * EXATO. É a mesma tela das páginas normais, sem o menu do site: estática, tudo
 * no navegador, nenhum dado lido.
 *
 * O BOTÃO DE IDIOMA entrou em 23/10/2026: `/api/idioma`, pelo caminho EXATO. A tela de
 * login também o tem, e quem está no login não tem sessão. A rota só grava o
 * cookie de idioma (e, havendo sessão, o perfil da PRÓPRIA pessoa, pela RLS).
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */
import { CAMINHOS_DO_SITE } from "../site/paginas";
import { caminhoDoSite, caminhoPtDeOutroIdioma, paginaTraduzida } from "../site/idiomas";

export const CAMINHOS_PUBLICOS = ["/login", "/auth/callback", "/api/manutencao/", "/receber/", "/api/receber/", "/ajuda/", "/sair/", "/confirmar/", "/api/sair/"] as const;

/** As ferramentas gratuitas do site: páginas estáticas, no idioma do endereço. */
export const FERRAMENTAS_DO_SITE = ["/ferramentas/kit", "/ferramentas/cores", "/ferramentas/grids", "/ferramentas/janela/kit", "/ferramentas/janela/cores", "/ferramentas/janela/grids"] as const;

export const CAMINHOS_PUBLICOS_EXATOS = new Set(["/api/cobranca/stripe", "/assinar", "/assinar/obrigado", "/api/cobranca/checkout", "/api/cobranca/senha", "/esqueci-senha", "/api/conta/esqueci-senha", ...FERRAMENTAS_DO_SITE, "/api/cadastro", "/api/cadastro/saida", "/api/cadastro/confirmar", "/api/idioma", "/demonstracao", "/api/demonstracao/entrar"]);

/**
 * O endereço é do SITE público — o que mora em `app/[lang]`?
 *
 * A home, as páginas do menu, as ferramentas gratuitas e os artigos da
 * Central de ajuda (prefixo `/ajuda/`, a própria `/ajuda` já é página do menu).
 * Só estes ganham o idioma no endereço; login, contas, manual e API seguem o
 * idioma da pessoa.
 */
export function ehDoSite(pathname: string): boolean {
  return CAMINHOS_DO_SITE.has(pathname)
    || (FERRAMENTAS_DO_SITE as readonly string[]).includes(pathname)
    || pathname.startsWith("/ajuda/");
}

/**
 * O que o `proxy` faz com o idioma do site (fatia 5, 24/10/2026).
 *
 * - Sem prefixo e do site: REESCREVE para `/pt-BR/...`. É por dentro: o
 *   endereço que a pessoa vê e compartilha continua `/vini`.
 * - `/pt-BR/...` direto: REDIRECIONA (308) para o endereço sem prefixo. Duas
 *   URLs para a mesma página dividiriam links e buscador.
 * - `/en/...` com endereço traduzido (`/en/agencies`): REESCREVE para a pasta
 *   (`/en/agencias`), que existe uma só, em português.
 * - `/en/agencias` (pasta em português com prefixo): REDIRECIONA (308) para o
 *   endereço traduzido (`/en/agencies`).
 * - Página que ainda não tem versão no idioma: REDIRECIONA (307, é provisório)
 *   para a equivalente em português, com um aviso (`?idioma=indisponivel`) que
 *   a página lê para dizer o porquê. Nada de 404 nem de texto misturado.
 * - O resto (plataforma, API): intocado.
 */
export type DecisaoDeIdioma =
  | { tipo: "nenhuma" }
  | { tipo: "reescrever"; para: string }
  | { tipo: "redirecionar"; para: string; permanente: boolean; aviso: boolean };

export function decisaoDeIdiomaDoSite(pathname: string): DecisaoDeIdioma {
  if (pathname === "/pt-BR" || pathname.startsWith("/pt-BR/")) {
    return { tipo: "redirecionar", para: pathname.slice("/pt-BR".length) || "/", permanente: true, aviso: false };
  }
  if (pathname === "/en" || pathname.startsWith("/en/")) {
    const resto = pathname.slice("/en".length) || "/";
    const pt = caminhoPtDeOutroIdioma("en", resto);
    if (pt === null) {
      // `/en/agencias`: pasta em português com prefixo. Vale como a traduzida.
      if (resto !== "/" && ehDoSite(resto)) return { tipo: "redirecionar", para: caminhoDoSite("en", resto), permanente: true, aviso: false };
      return { tipo: "nenhuma" };
    }
    if (!ehDoSite(pt)) return { tipo: "nenhuma" };
    if (!paginaTraduzida("en", pt)) return { tipo: "redirecionar", para: pt, permanente: false, aviso: true };
    const pasta = pt === "/" ? "/en" : `/en${pt}`;
    return pasta === pathname ? { tipo: "nenhuma" } : { tipo: "reescrever", para: pasta };
  }
  if (ehDoSite(pathname)) return { tipo: "reescrever", para: pathname === "/" ? "/pt-BR" : `/pt-BR${pathname}` };
  return { tipo: "nenhuma" };
}

export function caminhoPublico(pathname: string): boolean {
  // O site em outro idioma (`/en`, `/en/...`): é o mesmo site, só que traduzido.
  if (pathname === "/en" || pathname.startsWith("/en/")) return true;
  if (CAMINHOS_DO_SITE.has(pathname)) return true;
  if (CAMINHOS_PUBLICOS_EXATOS.has(pathname)) return true;
  return CAMINHOS_PUBLICOS.some((prefixo) => pathname.startsWith(prefixo));
}
