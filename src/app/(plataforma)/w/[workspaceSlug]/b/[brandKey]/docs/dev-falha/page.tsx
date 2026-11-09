import { notFound } from "next/navigation";

/**
 * Uma falha de propósito, para provar que a fronteira de erro funciona.
 *
 * Fronteira de erro é a peça que, por definição, nunca aparece quando tudo vai
 * bem — e por isso é a que mais facilmente está quebrada sem ninguém saber.
 * Testá-la exige um erro real, e no ambiente de teste não há E/S para falhar:
 * o servidor roda com `BRENNIMARK_DEV_SKIP_AUTH`, então nenhuma consulta ao
 * Supabase acontece.
 *
 * A alternativa seria só verificar que os arquivos existem, o que prova que
 * alguém os escreveu — não que o React os monta no lugar certo, que a copy
 * aparece, e que a mensagem técnica não vaza.
 *
 * Fechada em produção pelo mesmo padrão de `/dev/shell-v2` e
 * `/dev/admin-panel`, e coberta pela mesma guarda estrutural.
 */
export default async function FalhaDeliberada() {
  if (process.env.NODE_ENV === "production") notFound();

  throw new Error(
    "falha deliberada de laboratório: /dev/senha=hunter2 e SELECT * FROM manual_do_cliente",
  );
}
