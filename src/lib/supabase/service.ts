import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * O cliente com a chave que ignora a RLS. Cada uso é uma exceção deliberada,
 * e a autorização de quem pede vem SEMPRE de antes, pela sessão:
 *
 * - as três mutações financeiras do ledger de IA
 *   (`reservar_execucao_de_ia_server`, `consolidar_execucao_de_ia_server`,
 *   `liberar_reserva_de_ia_server`), função `service_role`-only;
 * - `registrar_documento_fonte`, função `service_role`-only;
 * - a assinatura do download da biblioteca (`/api/assets/[id]/download`),
 *   porque desde 15/09/2026 nenhuma sessão lê arquivo da biblioteca direto no
 *   Storage — é o que torna o registro de download incontornável.
 *
 * Comentário corrigido em 15/09: ele dizia que o cliente existia SÓ para o
 * ledger de IA, e já não era verdade antes desta data.
 *
 * `import "server-only"` faz o build FALHAR se este módulo acabar
 * importado por engano num Client Component — a chave nunca deveria nem
 * ter chance de chegar ao bundle do navegador.
 *
 * `SUPABASE_SECRET_KEY` é a chave secreta MODERNA (`sb_secret_...`), não a
 * legacy `service_role` (JWT): a moderna rejeita uso no navegador por
 * conta própria (protege mesmo se `server-only` falhar por algum motivo),
 * e pode ser rotacionada sozinha, sem tocar nas outras chaves do projeto.
 * Nomeada `brennimark-billing` no Supabase — só esta chave, com este nome,
 * é usada aqui.
 *
 * `persistSession`/`autoRefreshToken` desligados: não existe sessão de
 * usuário nenhuma aqui para persistir ou renovar — cada chamada já carrega
 * o `p_user_id` que decide quem é o ator, resolvido ANTES desta função ser
 * chamada, a partir de uma sessão já validada (nunca do corpo da
 * requisição).
 */
export function createServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    throw new Error(
      "SUPABASE_SECRET_KEY não está configurada — as mutações financeiras do " +
      "ledger de IA (reservar/consolidar/liberar) exigem o cliente de serviço, " +
      "não a sessão do usuário. Crie a chave em Supabase → Settings → API Keys " +
      "→ Publishable and secret API keys (nomeie-a, ex.: brennimark-billing) " +
      "e adicione SUPABASE_SECRET_KEY ao .env.local e às variáveis de ambiente " +
      "da Vercel. Ver docs/plan/p2-benchmark-multimodal-2026-09-03.md, achado P0-2.",
    );
  }

  return createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
