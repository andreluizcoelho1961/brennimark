import assert from "node:assert/strict";
import test from "node:test";
import {
  caminhoDaMarca,
  resolverAlvo,
  resolverSemAlvo,
  resolverWorkspace,
  destinoAoTrocarDeMarca,
  type EstadoDaPessoa,
  type WorkspaceDisponivel,
} from "./selecao";

const agencia: WorkspaceDisponivel = {
  id: "ws-1", slug: "agencia-norte", nome: "Agência Norte", papel: "owner",
  marcas: [
    { id: "b-1", key: "padaria", nome: "Padaria" },
    { id: "b-2", key: "livraria", nome: "Livraria" },
  ],
};

const clienteSolo: WorkspaceDisponivel = {
  id: "ws-2", slug: "sul", nome: "Sul", papel: "member",
  marcas: [{ id: "b-3", key: "oficina", nome: "Oficina" }],
};

const pessoa = (parcial: Partial<EstadoDaPessoa> = {}): EstadoDaPessoa => ({
  temSessao: true, cadastroCompleto: true, disponiveis: [agencia], ...parcial,
});

test("sem sessão vai para o login, mesmo com alvo na URL", () => {
  assert.equal(
    resolverAlvo(pessoa({ temSessao: false }), { workspaceSlug: "agencia-norte", brandKey: "padaria" }).tipo,
    "anonimo",
  );
});

test("sessão sem cadastro completo vai para o cadastro, não para 404", () => {
  // A distinção importa: 404 mandaria a primeira pessoa do produto para uma
  // parede em vez do cadastro que ela ainda precisa fazer.
  assert.equal(
    resolverAlvo(pessoa({ cadastroCompleto: false }), { workspaceSlug: "agencia-norte", brandKey: "padaria" }).tipo,
    "onboarding",
  );
});

test("alvo válido resolve para a marca pedida, não para a primeira", () => {
  const r = resolverAlvo(pessoa(), { workspaceSlug: "agencia-norte", brandKey: "livraria" });
  assert.equal(r.tipo, "pronto");
  assert.equal(r.tipo === "pronto" && r.marca.key, "livraria");
  assert.equal(r.tipo === "pronto" && r.marca.id, "b-2");
});

test("workspace do qual a pessoa não participa é não-encontrado", () => {
  assert.equal(
    resolverAlvo(pessoa(), { workspaceSlug: "de-outra-pessoa", brandKey: "padaria" }).tipo,
    "nao-encontrado",
  );
});

test("marca de outro workspace não é alcançável pela URL deste", () => {
  // O par tem de ser validado junto. Validar só o workspace deixaria
  // /w/agencia-norte/b/oficina servir a marca do workspace "sul".
  const estado = pessoa({ disponiveis: [agencia, clienteSolo] });
  assert.equal(
    resolverAlvo(estado, { workspaceSlug: "agencia-norte", brandKey: "oficina" }).tipo,
    "nao-encontrado",
  );
});

test("existir e não participar é indistinguível de não existir", () => {
  // Respostas diferentes confirmariam para quem sonda que o endereço é real.
  const naoParticipa = resolverAlvo(pessoa(), { workspaceSlug: "sul", brandKey: "oficina" });
  const naoExiste = resolverAlvo(pessoa(), { workspaceSlug: "inventado", brandKey: "qualquer" });
  assert.deepEqual(naoParticipa, naoExiste);
});

test("uma única marca TAMBÉM passa pela tela inicial", () => {
  /*
   * Mudou em 12/09/2026, por decisão do André, e o caso antigo afirmava o
   * contrário: com uma marca só, o login redirecionava direto para dentro dela.
   * A tela inicial passou a ser a porta do produto — é onde a pessoa entende
   * onde está e vê as marcas da conta, mesmo que seja uma.
   */
  const r = resolverSemAlvo(pessoa({ disponiveis: [clienteSolo] }));
  assert.equal(r.tipo, "escolher");
  assert.deepEqual(r.tipo === "escolher" && r.opcoes.flatMap((o) => o.marcas.map((m) => m.key)), ["oficina"]);
});

test("duas marcas no mesmo workspace perguntam, não escolhem", () => {
  // Este é o defeito que o M1 corrige: `.limit(1)` respondia "padaria" aqui.
  const r = resolverSemAlvo(pessoa());
  assert.equal(r.tipo, "escolher");
});

test("uma marca em cada um de dois workspaces também pergunta", () => {
  const r = resolverSemAlvo(pessoa({
    disponiveis: [{ ...agencia, marcas: [agencia.marcas[0]] }, clienteSolo],
  }));
  assert.equal(r.tipo, "escolher");
  assert.equal(r.tipo === "escolher" && r.opcoes.length, 2);
});

test("conta sem marca nenhuma leva à importação, sabendo em qual conta", () => {
  const r = resolverSemAlvo(pessoa({ disponiveis: [{ ...agencia, marcas: [] }] }));
  assert.equal(r.tipo, "sem-marca");
  assert.equal(r.tipo === "sem-marca" && r.workspaceSlug, "agencia-norte");
});

test("sem workspace nenhum não inventa conta de destino", () => {
  const r = resolverSemAlvo(pessoa({ disponiveis: [] }));
  assert.equal(r.tipo, "sem-marca");
  assert.equal(r.tipo === "sem-marca" && r.workspaceSlug, null);
});

test("nenhuma resolução depende da ordem das listas", () => {
  // Se a ordem importasse, o resultado seria "a primeira" com outro nome.
  const direta = resolverSemAlvo(pessoa({ disponiveis: [agencia, clienteSolo] }));
  const invertida = resolverSemAlvo(pessoa({ disponiveis: [clienteSolo, agencia] }));
  assert.equal(direta.tipo, invertida.tipo);
  assert.equal(
    resolverAlvo(pessoa({ disponiveis: [agencia, clienteSolo] }), { workspaceSlug: "sul", brandKey: "oficina" }).tipo,
    resolverAlvo(pessoa({ disponiveis: [clienteSolo, agencia] }), { workspaceSlug: "sul", brandKey: "oficina" }).tipo,
  );
});

test("o caminho canônico da marca sai de um lugar só", () => {
  const alvo = { workspaceSlug: "agencia-norte", brandKey: "padaria" };
  assert.equal(caminhoDaMarca(alvo), "/w/agencia-norte/b/padaria/docs");
  assert.equal(caminhoDaMarca(alvo, "docs/chat"), "/w/agencia-norte/b/padaria/docs/chat");
  assert.equal(caminhoDaMarca(alvo, "/docs/chat"), "/w/agencia-norte/b/padaria/docs/chat");
});

test("um único workspace resolve sozinho, mesmo sem marca alguma", () => {
  // A porta de entrada do produto: importar a primeira marca acontece antes de
  // existir marca. Exigir marca aqui trancaria a conta nova do lado de fora.
  const r = resolverWorkspace(pessoa({ disponiveis: [{ ...agencia, marcas: [] }] }));
  assert.equal(r.tipo, "workspace");
  assert.equal(r.tipo === "workspace" && r.workspace.slug, "agencia-norte");
});

test("dois workspaces sem alvo perguntam, também para operações sem marca", () => {
  const r = resolverWorkspace(pessoa({ disponiveis: [agencia, clienteSolo] }));
  assert.equal(r.tipo, "escolher");
});

test("workspace pedido por slug é o que resolve, não o único disponível", () => {
  const r = resolverWorkspace(pessoa({ disponiveis: [agencia, clienteSolo] }), "sul");
  assert.equal(r.tipo === "workspace" && r.workspace.slug, "sul");
});

test("workspace pedido do qual não se participa é não-encontrado", () => {
  assert.equal(resolverWorkspace(pessoa(), "de-outra-pessoa").tipo, "nao-encontrado");
});

test("sem conta nenhuma, nenhum workspace é inventado", () => {
  const r = resolverWorkspace(pessoa({ disponiveis: [] }));
  assert.equal(r.tipo, "escolher");
  assert.equal(r.tipo === "escolher" && r.opcoes.length, 0);
});

// ─── Trocar de marca a partir de uma rota filha ─────────────────────────────

test("trocar de marca vai para a visão geral, não para a página atual", () => {
  // Estando em /w/agencia-norte/b/padaria/docs/cor, o destino é a visão geral
  // de "sul" — o caminho `cor` NÃO acompanha. A marca de destino pode não ter
  // uma página com esse nome, e as três saídas de levar o caminho junto são
  // todas erradas: mostrar a página da outra marca é vazamento entre clientes;
  // inferir uma equivalente é inventar conteúdo; e um 404 logo depois de
  // clicar no nome de uma marca faz a troca parecer quebrada.
  assert.equal(
    destinoAoTrocarDeMarca({ workspaceSlug: "sul", brandKey: "oficina" }),
    "/w/sul/b/oficina/docs",
  );
});

test("nenhum destino de troca carrega segmento além de /docs", () => {
  for (const opcao of [...agencia.marcas, ...clienteSolo.marcas]) {
    const destino = destinoAoTrocarDeMarca({ workspaceSlug: "sul", brandKey: opcao.key });
    assert.match(destino, /^\/w\/[^/]+\/b\/[^/]+\/docs$/, `${destino} leva caminho junto`);
  }
});

test("o documento pedido é procurado na marca da URL, não na anterior", () => {
  // A regressão: /w/sul/b/oficina/docs/cor resolvendo para a marca "padaria"
  // porque ela era a anterior, e servindo a página `cor` DELA. Aqui o alvo é o
  // único que decide, e a marca resolvida é a de "oficina".
  const estado = pessoa({ disponiveis: [agencia, clienteSolo] });
  const r = resolverAlvo(estado, { workspaceSlug: "sul", brandKey: "oficina" });
  assert.equal(r.tipo, "pronto");
  assert.equal(r.tipo === "pronto" && r.marca.id, "b-3");
  assert.notEqual(r.tipo === "pronto" && r.marca.id, "b-1");
});
