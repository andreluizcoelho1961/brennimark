import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

/**
 * As rotas da IA própria (ADR-0009) guardam e usam a chave de um cliente. Não
 * há banco na suíte de unidade; esta guarda confere o código-fonte, como
 * `platform/leak-guard.test.ts`. O que ela impede é a volta silenciosa, numa
 * refatoração, de uma rota sem portão de dona, de uma chave num log ou de uma
 * chave devolvida à tela.
 */
const raiz = join(process.cwd(), "src");
const ler = (caminho: string) => readFileSync(join(raiz, caminho), "utf8");
const ROTAS = ["ia/route.ts", "ia/termo/route.ts", "ia/chave/route.ts", "ia/testar/route.ts", "ia/teto/route.ts"].map((r) => `app/api/configuracoes/${r}`);

test("toda rota da IA própria resolve a conta e recusa quem não administra", () => {
  for (const rota of ROTAS) {
    const fonte = ler(rota);
    assert.match(fonte, /workspaceDaRota\(request\)/, `${rota} não resolve a conta pelo contexto da rota`);
    assert.match(fonte, /r\.papel !== "owner"/, `${rota} não recusa quem não administra`);
  }
});

test("nenhuma rota nem módulo da IA própria registra a chave em log", () => {
  for (const arquivo of [...ROTAS, "lib/ia-propria/testar.ts"]) {
    for (const linha of ler(arquivo).split("\n").filter((l) => /console\.(log|warn|error|info|debug)/.test(l))) {
      assert.doesNotMatch(linha, /apiKey|chave|ciphertext|cifra|\bkey\b/i, `${arquivo} põe a chave num log: ${linha.trim()}`);
    }
  }
});

test("o estado da conta nunca devolve o texto cifrado nem a chave", () => {
  const fonte = ler("app/api/configuracoes/ia/route.ts");
  assert.doesNotMatch(fonte, /chave_cifrada|chave_iv|chaves_de_ia_da_conta/, "a rota de leitura tocou o texto cifrado");
  assert.match(fonte, /listar_chaves_de_ia/);
});

test("guardar chave usa a sessão da pessoa, e só o teste usa a chave de serviço", () => {
  const chave = ler("app/api/configuracoes/ia/chave/route.ts");
  assert.doesNotMatch(chave, /createServiceClient/, "guardar/apagar não pode rodar com a chave de serviço: o banco precisa ver a dona");
  assert.match(chave, /guardar_chave_de_ia/);
  const testar = ler("app/api/configuracoes/ia/testar/route.ts");
  // A dona é conferida pela sessão ANTES de a chave de serviço tocar no cifrado.
  assert.ok(testar.indexOf("listar_chaves_de_ia") < testar.indexOf("chave_de_ia_para_uso"),
    "o teste leu a chave antes de conferir a dona");
});

test("a chave do corpo é descartada: nenhuma resposta de guardar a repete", () => {
  const chave = ler("app/api/configuracoes/ia/chave/route.ts");
  // Só `chaveFinal` (quatro caracteres) pode aparecer num corpo de resposta.
  for (const resposta of chave.match(/NextResponse\.json\(\{[^}]*\}/g) ?? []) {
    assert.doesNotMatch(resposta, /\bchave\b\s*[,:}]/, `a resposta devolve a chave: ${resposta}`);
    assert.doesNotMatch(resposta, /cifra|ciphertext/i);
  }
});

test("a tela não guarda a chave além do envio e nunca a lê de volta", () => {
  const tela = ler("components/configuracoes/IaDaAgencia.tsx");
  assert.match(tela, /setChave\(""\)/, "a chave precisa sair da memória da tela depois do envio");
  assert.match(tela, /type="password"/);
  assert.match(tela, /autoComplete="new-password"/);
  assert.doesNotMatch(tela, /localStorage|sessionStorage/);
});
