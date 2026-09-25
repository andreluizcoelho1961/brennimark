import assert from "node:assert/strict";
import test from "node:test";
import { buscarTrechos, perguntaDasMensagens } from "./buscar";
import { LIMITES_DE_IA } from "./recuperacao";

/**
 * Um Supabase de mentira, só com o que a busca usa.
 *
 * Ele conta as chamadas: é assim que o teste prova que, no erro, nada segue
 * adiante — inclusive o provedor de IA, representado aqui pelo contador que a
 * rota incrementaria.
 */
function supabaseFalso(resposta: { data?: unknown; error?: { code?: string; message: string } | null }) {
  const chamadas: { fn: string; args: Record<string, unknown> }[] = [];
  return {
    chamadas,
    cliente: {
      rpc: async (fn: string, args: Record<string, unknown>) => {
        chamadas.push({ fn, args });
        return { data: resposta.data ?? null, error: resposta.error ?? null };
      },
    } as never,
  };
}

const LINHA = {
  document_slug: "cor", document_title: "Cor", group_name: "Fundamentos",
  section: "Paleta", status: "ready", page_start: 12, page_end: 18,
  content: "A cor institucional é o vermelho.",
};

test("busca sem resultado é sucesso com lista vazia", () => {
  // Zero resultados é uma resposta VERDADEIRA sobre o manual: consultamos, e
  // não havia nada. Ela autoriza dizer "não há diretriz documentada".
  const { cliente } = supabaseFalso({ data: [] });
  return buscarTrechos(cliente, "marca-1", "algo").then((r) => {
    assert.equal(r.ok, true);
    assert.deepEqual(r.ok && r.trechos, []);
  });
});

test("erro de busca NÃO vira lista vazia", async () => {
  // A regressão que isto impede: engolir o erro do Supabase e devolver `[]`.
  // "Não há diretriz documentada" é uma afirmação sobre o CONTEÚDO, e uma
  // falha de banco, RLS ou RPC não dá base nenhuma para fazê-la — o produto
  // não consultou o manual, e diria ao cliente que o manual dele está vazio.
  const { cliente } = supabaseFalso({ error: { code: "42501", message: "permission denied" } });
  const r = await buscarTrechos(cliente, "marca-1", "algo");
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.motivo, "42501");
});

test("os dois casos são distinguíveis pelo chamador", async () => {
  const vazio = await buscarTrechos(supabaseFalso({ data: [] }).cliente, "m", "x");
  const falha = await buscarTrechos(
    supabaseFalso({ error: { message: "boom" } }).cliente, "m", "x",
  );
  assert.notEqual(vazio.ok, falha.ok, "erro e ausência precisam ser diferenciáveis");
});

test("o erro não carrega a mensagem do banco adiante", async () => {
  // A mensagem pode conter fragmento da consulta e, por ela, texto do manual
  // do cliente. Só o código sobe.
  const { cliente } = supabaseFalso({
    error: { code: "22023", message: 'syntax error near "vermelho #E1251B"' },
  });
  const r = await buscarTrechos(cliente, "marca-1", "algo");
  assert.equal(r.ok, false);
  assert.doesNotMatch(JSON.stringify(r), /E1251B/, "conteúdo do manual vazou no erro");
});

test("pergunta vazia não é falha: é zero resultados de verdade", async () => {
  const { cliente, chamadas } = supabaseFalso({ data: [LINHA] });
  const r = await buscarTrechos(cliente, "marca-1", "   ");
  assert.equal(r.ok, true);
  assert.deepEqual(r.ok && r.trechos, []);
  assert.equal(chamadas.length, 0, "não faz sentido consultar o banco sem pergunta");
});

test("a busca vai com o brand_id e com o teto de fontes", async () => {
  const { cliente, chamadas } = supabaseFalso({ data: [LINHA] });
  await buscarTrechos(cliente, "marca-42", "qual a cor?");
  assert.equal(chamadas[0].fn, "buscar_trechos");
  assert.equal(chamadas[0].args.p_brand_id, "marca-42");
  assert.equal(chamadas[0].args.p_limite, LIMITES_DE_IA.maxTrechos);
});

test("a linha do banco vira trecho com procedência completa", async () => {
  const { cliente } = supabaseFalso({ data: [LINHA] });
  const r = await buscarTrechos(cliente, "m", "cor");
  assert.equal(r.ok, true);
  const [trecho] = r.ok ? r.trechos : [];
  assert.equal(trecho.documentSlug, "cor");
  assert.equal(trecho.section, "Paleta");
  assert.equal(trecho.pageStart, 12);
  assert.equal(trecho.pageEnd, 18);
  assert.equal(trecho.status, "ready");
});

test("seção e páginas ausentes viram nulo, não zero nem string vazia", async () => {
  // `page_start: 0` seria uma página que não existe; `section: ""` seria uma
  // seção sem nome. Os dois apareceriam na tela como se fossem informação.
  const { cliente } = supabaseFalso({
    data: [{ ...LINHA, section: null, page_start: null, page_end: null }],
  });
  const r = await buscarTrechos(cliente, "m", "cor");
  const [trecho] = r.ok ? r.trechos : [];
  assert.equal(trecho.section, null);
  assert.equal(trecho.pageStart, null);
});

// ─── A pergunta sobre a qual se busca ──────────────────────────────────────

test("a busca é sobre a última pergunta, não sobre a conversa", () => {
  // Buscar sobre o histórico traz os assuntos já encerrados e afoga a pergunta
  // atual: a recuperação pioraria quanto mais longa a conversa.
  const pergunta = perguntaDasMensagens([
    { role: "user", content: "fale da tipografia" },
    { role: "assistant", content: "a família é..." },
    { role: "user", content: "e a cor?" },
  ]);
  assert.equal(pergunta, "e a cor?");
});

test("resposta do assistente não vira pergunta", () => {
  assert.equal(
    perguntaDasMensagens([
      { role: "user", content: "qual a cor?" },
      { role: "assistant", content: "o vermelho institucional" },
    ]),
    "qual a cor?",
  );
});

test("mensagem multimodal contribui só com o texto", () => {
  // A análise manda imagem junto. Sem o filtro, o objeto da imagem viraria
  // parte da consulta e a busca procuraria por "image".
  assert.equal(
    perguntaDasMensagens([
      { role: "user", content: [{ type: "text", text: "esta peça está certa?" }, { type: "image" }] },
    ]),
    "esta peça está certa?",
  );
});

test("conversa sem pergunta nenhuma devolve vazio", () => {
  assert.equal(perguntaDasMensagens([{ role: "assistant", content: "olá" }]), "");
  assert.equal(perguntaDasMensagens([]), "");
});
