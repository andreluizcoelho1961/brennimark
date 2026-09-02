import assert from "node:assert/strict";
import test from "node:test";
import { marcaOferece, podeUsar } from "./permissao";
import { capabilitiesForRole } from "../../platform/capabilities";

const OWNER = capabilitiesForRole("owner");
const MEMBER = capabilitiesForRole("member");
const VISITANTE = capabilitiesForRole(null);

test("member usa chat quando a marca contratou", () => {
  assert.deepEqual(
    podeUsar({ utilidade: "chat", capabilities: MEMBER, utilityLinks: ["chat"] }),
    { permitido: true },
  );
});

test("marca que não contratou o chat não responde nem ao dono", () => {
  // A navegação já esconde o link. O que isto impede é a chamada direta à
  // rota: sem verificação no servidor, uma marca que não contratou o
  // assistente responderia perguntas para quem soubesse a URL.
  assert.deepEqual(
    podeUsar({ utilidade: "chat", capabilities: OWNER, utilityLinks: [] }),
    { permitido: false, motivo: "nao-contratada" },
  );
});

test("contratar chat não contrata análise", () => {
  const so_chat = { capabilities: OWNER, utilityLinks: ["chat"] };
  assert.equal(podeUsar({ ...so_chat, utilidade: "chat" }).permitido, true);
  assert.equal(podeUsar({ ...so_chat, utilidade: "analysis" }).permitido, false);
});

test("sem sessão não usa nada, nem o que a marca contratou", () => {
  assert.deepEqual(
    podeUsar({ utilidade: "chat", capabilities: VISITANTE, utilityLinks: ["chat"] }),
    { permitido: false, motivo: "sem-papel" },
  );
});

test("member não governa configurações de IA", () => {
  // Chave e roteamento são governo da conta: quem paga a fatura decide.
  assert.deepEqual(
    podeUsar({ utilidade: "ai-settings", capabilities: MEMBER, utilityLinks: ["ai-settings"] }),
    { permitido: false, motivo: "sem-papel" },
  );
});

test("owner governa configurações mesmo sem marca que use IA", () => {
  // Amarrar as duas coisas criaria o ovo e a galinha: configurar a IA exigiria
  // uma marca que já usa IA.
  assert.deepEqual(
    podeUsar({ utilidade: "ai-settings", capabilities: OWNER, utilityLinks: [] }),
    { permitido: true },
  );
});

test("não contratada é respondido ANTES de sem papel", () => {
  // Se a ordem fosse a inversa, a diferença entre 403 e 404 revelaria a quem
  // não tem papel nenhum quais funcionalidades a marca contratou.
  const r = podeUsar({ utilidade: "chat", capabilities: VISITANTE, utilityLinks: [] });
  assert.equal(r.permitido === false && r.motivo, "nao-contratada");
});

test("utilityLinks ausente é o mesmo que nada contratado", () => {
  // Marca antiga, sem o campo. Presumir "tudo contratado" abriria as rotas de
  // IA para todo manual importado antes de a escolha existir.
  assert.equal(marcaOferece(undefined, "chat"), false);
  assert.equal(
    podeUsar({ utilidade: "chat", capabilities: OWNER, utilityLinks: undefined }).permitido,
    false,
  );
});

test("uma utilidade não vale por outra de nome parecido", () => {
  assert.equal(marcaOferece(["chat-beta"], "chat"), false);
  assert.equal(marcaOferece(["analysis"], "analysis"), true);
});
