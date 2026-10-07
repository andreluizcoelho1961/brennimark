import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { POLITICA_DE_PRIVACIDADE, TERMOS_DE_USO } from "@/lib/site/documentos-legais";

/**
 * O aceite dos Termos e da Política, gravado pelo servidor (a sessão não
 * escreve em `aceites_de_documentos`). Os Termos dizem: "registramos a versão
 * aceita, a data e o horário".
 *
 * Falhar aqui não tira o acesso de ninguém: o erro vai ao log, e a pessoa
 * segue. A versão aceita na compra também está no Stripe.
 */
const VERSAO = /^\d{4}-\d{2}-\d{2}$/;

export async function gravarAceites(
  servico: SupabaseClient,
  p: { userId: string; origem: "compra" | "primeiro-acesso"; ip: string | null; termos?: string | null; privacidade?: string | null },
): Promise<void> {
  const termos = p.termos && VERSAO.test(p.termos) ? p.termos : TERMOS_DE_USO.versao;
  const privacidade = p.privacidade && VERSAO.test(p.privacidade) ? p.privacidade : POLITICA_DE_PRIVACIDADE.versao;
  const { error } = await servico.from("aceites_de_documentos").insert([
    { user_id: p.userId, documento: "termos", versao: termos, origem: p.origem, ip: p.ip },
    { user_id: p.userId, documento: "privacidade", versao: privacidade, origem: p.origem, ip: p.ip },
  ]);
  if (error) console.error(JSON.stringify({ level: "error", msg: "aceite_nao_gravado", origem: p.origem, code: error.code ?? "unknown" }));
}
