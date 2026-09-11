import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { receberRastro } from "@/lib/import/rastro";

/**
 * Recebe o rastro de um arquivo que a importação deixou sem destino, e o
 * escreve no log do SERVIDOR.
 *
 * O importador é um componente de tela: um `console.error` dele fica no
 * navegador de quem importou e some quando a aba fecha. Esta rota é o caminho
 * até um log que alguém consulta. A regra — forma do aviso, sessão, conta —
 * vive em `@/lib/import/rastro`, com teste; aqui ficam só as portas reais.
 *
 * Só a sessão, sob RLS. Nenhuma chave de serviço: registrar um log não precisa
 * de privilégio nenhum além de saber quem é quem.
 */
export async function POST(request: Request) {
  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ codigo: "pedido_invalido" }, { status: 400 });
  }

  const sessao = await createClient();

  const resposta = await receberRastro(corpo, {
    async ator() {
      // `getUser`, e não `getSession`: o token é validado, não só lido do
      // cookie. É o ator que vai escrito na linha de log.
      const { data } = await sessao.auth.getUser();
      return data.user ? { id: data.user.id } : null;
    },

    async membroDaConta(contaId) {
      // A RLS de `workspaces` só devolve a linha a quem é membro. Erro é
      // "não sei" — `null` —, e não "não é membro".
      const { data, error } = await sessao
        .from("workspaces")
        .select("id")
        .eq("id", contaId)
        .maybeSingle();
      if (error) return null;
      return data !== null;
    },

    registrar(linha) {
      console.error(JSON.stringify(linha));
    },
  });

  return NextResponse.json({ codigo: resposta.codigo }, { status: resposta.status });
}
