import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

/**
 * Quem CONSULTA a marca é atendido pela IA da conta — ensaio de 19/09/2026.
 *
 * A primeira pessoa de consulta a usar o chat ouviu "a IA desta conta ainda
 * não está configurada" numa conta configurada: o perfil de IA era lido com a
 * sessão dela, e as policies de `ai_settings` só deixam o dono ler. A correção
 * lê o perfil no servidor, com a chave de serviço, DEPOIS do portão da marca —
 * e com a conta que o portão resolveu, nunca a que o cliente mandou.
 *
 * Não há banco na suíte de unidade; esta guarda confere o código-fonte, como
 * `platform/leak-guard.test.ts`. O que ela impede é a volta silenciosa ao
 * defeito numa refatoração.
 */
// Roda a partir do diretório compilado em .tmp: a raiz é o cwd, como no leak-guard.
const raiz = join(process.cwd(), "src");
const ler = (caminho: string) => readFileSync(join(raiz, caminho), "utf8");

test("o perfil que atende é lido com a chave de serviço", () => {
  const fonte = ler("lib/ai/settings.ts");
  const corpo = fonte.slice(fonte.indexOf("export async function resolveFeatureRouting"));
  assert.match(corpo.slice(0, 600), /createServiceClient\(\)/,
    "resolveFeatureRouting voltou a usar a sessão de quem pede — quem só consulta fica sem IA");
});

test("as rotas passam a conta que o portão resolveu", () => {
  const chat = ler("app/api/ai/chat/route.ts");
  assert.ok(chat.indexOf("portaoDeIA(") < chat.indexOf("resolveChatRouting("), "o perfil é lido antes do portão da marca");
  assert.match(chat, /resolveChatRouting\(portao\.auth\.workspaceId\)/);

  const analise = ler("app/api/ai/analyze/route.ts");
  assert.ok(analise.indexOf("portaoDeIA(") < analise.indexOf("resolveAnalysisRouting("), "o perfil é lido antes do portão da marca");
  assert.match(analise, /workspaceId = portao\.auth\.workspaceId/);
  assert.match(analise, /resolveAnalysisRouting\(workspaceId\)/);
});

test("a tela de configuração continua com a sessão — só o dono lê e muda", () => {
  const fonte = ler("lib/ai/settings.ts");
  const listar = fonte.slice(fonte.indexOf("export async function listSettings"), fonte.indexOf("export async function listSettings") + 300);
  assert.match(listar, /await createClient\(\)/);
});
