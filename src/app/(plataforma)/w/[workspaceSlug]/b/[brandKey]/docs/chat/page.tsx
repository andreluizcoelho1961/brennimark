import { redirect } from "next/navigation";
import { caminhoDaMarca } from "@/lib/brennimark/selecao";

/**
 * O endereço antigo do chat.
 *
 * Desde a fatia 4a (19/09/2026) a conversa acontece na janela do Vini, no canto
 * de qualquer tela da marca. Esta página era uma tela inteira só de chat, e o
 * ensaio mostrou alguém caindo nela por um endereço guardado — com a resposta
 * sem formatação e sem a citação que leva ao PDF. Quem chega aqui vai ao
 * manual, onde o Vini está.
 *
 * O `layout` desta rota continua valendo: marca que não contratou o chat
 * recebe 404 antes de chegar aqui.
 */
export default async function ChatAntigo({
  params,
}: {
  params: Promise<{ workspaceSlug: string; brandKey: string }>;
}) {
  redirect(`${caminhoDaMarca(await params)}/original`);
}
