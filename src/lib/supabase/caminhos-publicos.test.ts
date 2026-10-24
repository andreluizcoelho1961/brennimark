import assert from "node:assert/strict";
import test from "node:test";
import { caminhoPublico, decisaoDeIdiomaDoSite, ehDoSite } from "./caminhos-publicos";

test("login e retorno da autenticação continuam abertos", () => {
  assert.equal(caminhoPublico("/login"), true);
  assert.equal(caminhoPublico("/auth/callback"), true);
});

test("a manutenção passa sem sessão — quem chama é o Cron, e a rota exige o segredo", () => {
  assert.equal(caminhoPublico("/api/manutencao/materiais-orfaos"), true);
});

test("só o prefixo exato: nada vizinho de manutenção passa", () => {
  assert.equal(caminhoPublico("/api/manutencao"), false);
  assert.equal(caminhoPublico("/api/manutencaox/qualquer"), false);
  assert.equal(caminhoPublico("/api/admin/assets"), false);
  assert.equal(caminhoPublico("/api/assets/kit"), false);
  assert.equal(caminhoPublico("/w/conta/b/marca/docs"), false);
});

test("o site passa sem sessão: a home e cada página pública", () => {
  assert.equal(caminhoPublico("/"), true);
  assert.equal(caminhoPublico("/vini"), true);
  assert.equal(caminhoPublico("/licenca-de-fontes"), true);
  assert.equal(caminhoPublico("/fonts"), true);
});

test("o site casa pelo caminho exato: a home não abre o produto", () => {
  // `/` como prefixo casaria com TUDO. Estes são o produto, e pedem sessão.
  assert.equal(caminhoPublico("/docs"), false);
  assert.equal(caminhoPublico("/console"), false);
  assert.equal(caminhoPublico("/api/console/ia"), false);
  assert.equal(caminhoPublico("/w/conta"), false);
  // Nem o que só começa como uma página do site.
  assert.equal(caminhoPublico("/vini/"), false);
  assert.equal(caminhoPublico("/vini/qualquer"), false);
  assert.equal(caminhoPublico("/vinix"), false);
  assert.equal(caminhoPublico("/manual-da-marca"), false);
});

test("o link de entrega passa sem sessão — a página e o download; a autorização é o código", () => {
  assert.equal(caminhoPublico("/receber/abc"), true);
  assert.equal(caminhoPublico("/api/receber/abc/baixar"), true);
});

test("só o prefixo exato do link público: a gestão dos links pede sessão", () => {
  assert.equal(caminhoPublico("/receber"), false);
  assert.equal(caminhoPublico("/receberx/abc"), false);
  assert.equal(caminhoPublico("/api/receber"), false);
  assert.equal(caminhoPublico("/api/links"), false);
  assert.equal(caminhoPublico("/api/links/x/revogar"), false);
  assert.equal(caminhoPublico("/w/conta/links"), false);
  // `/materiais` é a página do SITE que apresenta o recurso — casa exato, e só ela.
  // (`/entrega` virou redirecionamento em 22/10/2026, resolvido antes do proxy.)
  assert.equal(caminhoPublico("/materiais"), true);
  assert.equal(caminhoPublico("/materiais/abc"), false);
});

test("o webhook do Stripe passa sem sessão — a autorização é a assinatura do aviso", () => {
  assert.equal(caminhoPublico("/api/cobranca/stripe"), true);
});

test("só o caminho exato do webhook: o resto da cobrança pede sessão", () => {
  assert.equal(caminhoPublico("/api/cobranca"), false);
  assert.equal(caminhoPublico("/api/cobranca/"), false);
  assert.equal(caminhoPublico("/api/cobranca/stripe/"), false);
  assert.equal(caminhoPublico("/api/cobranca/stripex"), false);
  assert.equal(caminhoPublico("/api/cobranca/portal"), false);
});

test("a compra passa sem sessão — quem compra ainda não tem conta", () => {
  assert.equal(caminhoPublico("/assinar"), true);
  assert.equal(caminhoPublico("/assinar/obrigado"), true);
  assert.equal(caminhoPublico("/api/cobranca/checkout"), true);
  assert.equal(caminhoPublico("/assinar/qualquer"), false);
  assert.equal(caminhoPublico("/assinarx"), false);
  assert.equal(caminhoPublico("/api/cobranca/checkoutx"), false);
});

test("a senha na volta do pagamento passa sem sessão, pelo caminho exato", () => {
  assert.equal(caminhoPublico("/api/cobranca/senha"), true);
  assert.equal(caminhoPublico("/api/cobranca/senha/"), false);
  assert.equal(caminhoPublico("/api/cobranca/senhax"), false);
});

test("o Esqueci a senha passa sem sessão; a troca, não", () => {
  assert.equal(caminhoPublico("/esqueci-senha"), true);
  assert.equal(caminhoPublico("/api/conta/esqueci-senha"), true);
  assert.equal(caminhoPublico("/nova-senha"), false);
  assert.equal(caminhoPublico("/api/conta/nova-senha"), false);
  assert.equal(caminhoPublico("/esqueci-senhax"), false);
});

test("o Kit gratuito é público pelo caminho exato, e só ele", () => {
  assert.equal(caminhoPublico("/ferramentas/kit"), true);
  assert.equal(caminhoPublico("/ferramentas"), false);
  assert.equal(caminhoPublico("/ferramentas/kitx"), false);
  assert.equal(caminhoPublico("/ferramentas/kit/qualquer"), false);
});

test("o Cores gratuito é público pelo caminho exato", () => {
  assert.equal(caminhoPublico("/ferramentas/cores"), true);
  assert.equal(caminhoPublico("/ferramentas/coresx"), false);
  // O Grids gratuito (13/10/2026): o mesmo caminho exato.
  assert.equal(caminhoPublico("/ferramentas/grids"), true);
  assert.equal(caminhoPublico("/ferramentas/gridsx"), false);
  assert.equal(caminhoPublico("/ferramentas/grids/qualquer"), false);
  // O cadastro gratuito (17/10/2026): só o caminho exato.
  assert.equal(caminhoPublico("/api/cadastro"), true);
  assert.equal(caminhoPublico("/api/cadastros"), false);
  assert.equal(caminhoPublico("/api/cadastro/qualquer"), false);
  // A saída da lista (17/10/2026): a página por prefixo, a rota pelo caminho exato.
  assert.equal(caminhoPublico("/sair/3f2504e0-4f89-41d3-9a0c-0305e82c3301"), true);
  assert.equal(caminhoPublico("/sairx"), false);
  assert.equal(caminhoPublico("/api/cadastro/saida"), true);
  assert.equal(caminhoPublico("/api/cadastro/saidax"), false);
  assert.equal(caminhoPublico("/api/cadastro/saida/qualquer"), false);
  // A confirmação do e-mail (18/10/2026): o mesmo desenho.
  assert.equal(caminhoPublico("/confirmar/3f2504e0-4f89-41d3-9a0c-0305e82c3301"), true);
  assert.equal(caminhoPublico("/confirmarx"), false);
  assert.equal(caminhoPublico("/api/cadastro/confirmar"), true);
  assert.equal(caminhoPublico("/api/cadastro/confirmarx"), false);
  assert.equal(caminhoPublico("/api/cadastro/confirmar/qualquer"), false);
  // A saída em um clique (22/10/2026): o endereço do cabeçalho List-Unsubscribe.
  assert.equal(caminhoPublico("/api/sair/3f2504e0-4f89-41d3-9a0c-0305e82c3301"), true);
  assert.equal(caminhoPublico("/api/sairx"), false);
  assert.equal(caminhoPublico("/api/sair"), false);
  assert.equal(caminhoPublico("/api/console/email"), false);
  // A ferramenta em janela solta (21/10/2026): só as três, pelo caminho exato.
  for (const f of ["kit", "cores", "grids"]) assert.equal(caminhoPublico(`/ferramentas/janela/${f}`), true);
  assert.equal(caminhoPublico("/ferramentas/janela"), false);
  assert.equal(caminhoPublico("/ferramentas/janela/fonts"), false);
  assert.equal(caminhoPublico("/ferramentas/janela/grids/x"), false);
  assert.equal(caminhoPublico("/ferramentas/janela/gridsx"), false);
});

test("os artigos da Central de ajuda passam sem sessão, e só sob /ajuda/", () => {
  assert.equal(caminhoPublico("/ajuda"), true);
  assert.equal(caminhoPublico("/ajuda/kit"), true);
  assert.equal(caminhoPublico("/ajuda/categoria/materiais-da-marca"), true);
  // vizinhos: nada que apenas comece com as mesmas letras
  assert.equal(caminhoPublico("/ajudax"), false);
  assert.equal(caminhoPublico("/ajuda-interna"), false);
});

test("o idioma do site: sem prefixo reescreve por dentro, /pt-BR volta, /en segue", () => {
  assert.deepEqual(decisaoDeIdiomaDoSite("/"), { tipo: "reescrever", para: "/pt-BR" });
  assert.deepEqual(decisaoDeIdiomaDoSite("/vini"), { tipo: "reescrever", para: "/pt-BR/vini" });
  assert.deepEqual(decisaoDeIdiomaDoSite("/ferramentas/kit"), { tipo: "reescrever", para: "/pt-BR/ferramentas/kit" });
  assert.deepEqual(decisaoDeIdiomaDoSite("/ajuda/primeiros-passos"), { tipo: "reescrever", para: "/pt-BR/ajuda/primeiros-passos" });
  // Duas URLs para a mesma página dividiriam links e buscador.
  assert.deepEqual(decisaoDeIdiomaDoSite("/pt-BR"), { tipo: "redirecionar", para: "/", permanente: true, aviso: false });
  assert.deepEqual(decisaoDeIdiomaDoSite("/pt-BR/vini"), { tipo: "redirecionar", para: "/vini", permanente: true, aviso: false });
});

test("o site em inglês: endereço traduzido reescreve, pasta em português redireciona, sem tradução volta ao português", () => {
  // Traduzida (só o Manifesto, por enquanto): a pasta é a mesma, o endereço também.
  assert.deepEqual(decisaoDeIdiomaDoSite("/en/manifesto"), { tipo: "nenhuma" });
  // Ainda sem tradução: vai à equivalente em português, com aviso, e é provisório (307).
  assert.deepEqual(decisaoDeIdiomaDoSite("/en/agencies"), { tipo: "redirecionar", para: "/agencias", permanente: false, aviso: true });
  assert.deepEqual(decisaoDeIdiomaDoSite("/en"), { tipo: "redirecionar", para: "/", permanente: false, aviso: true });
  assert.deepEqual(decisaoDeIdiomaDoSite("/en/tools/window/kit"), { tipo: "redirecionar", para: "/ferramentas/janela/kit", permanente: false, aviso: true });
  // Pasta em português com prefixo: vira o endereço traduzido (uma URL por página).
  assert.deepEqual(decisaoDeIdiomaDoSite("/en/agencias"), { tipo: "redirecionar", para: "/en/agencies", permanente: true, aviso: false });
  assert.deepEqual(decisaoDeIdiomaDoSite("/en/ajuda"), { tipo: "redirecionar", para: "/en/help", permanente: true, aviso: false });
  // O que não existe no site segue para o 404.
  assert.deepEqual(decisaoDeIdiomaDoSite("/en/nao-existe"), { tipo: "nenhuma" });
  assert.deepEqual(decisaoDeIdiomaDoSite("/en/login"), { tipo: "nenhuma" });
});

test("a plataforma e a API nunca são reescritas para o site", () => {
  for (const p of ["/login", "/docs", "/w/conta/b/marca/docs", "/api/idioma", "/assinar", "/esqueci-senha", "/receber/abc", "/dev/marcas", "/console"]) {
    assert.deepEqual(decisaoDeIdiomaDoSite(p), { tipo: "nenhuma" }, p);
    assert.equal(ehDoSite(p), false, p);
  }
  // Prefixos parecidos não enganam: `/envia` não é `/en`, `/pt-BRx` não é `/pt-BR`.
  assert.deepEqual(decisaoDeIdiomaDoSite("/envia"), { tipo: "nenhuma" });
  assert.deepEqual(decisaoDeIdiomaDoSite("/pt-BRx"), { tipo: "nenhuma" });
});

test("o site em inglês passa sem sessão, e a lookalike não", () => {
  assert.equal(caminhoPublico("/en"), true);
  assert.equal(caminhoPublico("/en/vini"), true);
  assert.equal(caminhoPublico("/envia"), false);
  assert.equal(caminhoPublico("/entrar"), false);
});
