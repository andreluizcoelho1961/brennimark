/**
 * A sequência de um download por link de entrega — e a ordem que a torna
 * honesta (30/09/2026).
 *
 * É a mesma ordem do download da biblioteca (`lib/assets/download.ts`):
 * abrir → assinar → registrar → emitir. Assinar só produz endereços na memória
 * do servidor; se falhar, nada é registrado (o registro não afirma download que
 * não houve). Registrar vem antes de emitir; se falhar, os endereços são
 * descartados e expiram sozinhos. Só com os dois de pé eles saem.
 *
 * Quem decide se o link vale e o que ele entrega é o BANCO
 * (`abrir_link_de_entrega`, `registrar_acesso_ao_link`) — as duas chamadas
 * conferem código, prazo, revogação e pertença, cada uma por conta própria.
 * Aqui se confere ainda que cada caminho é da pasta da marca do link, antes de
 * a chave de serviço assinar.
 *
 * Módulo puro: a rota injeta o banco e o Storage.
 */

export type EstadoDoLink = "inexistente" | "expirado" | "revogado" | "ativo";

export type ArquivoAberto = {
  id: string;
  atual_id: string | null;
  retirado: boolean;
  storage_path: string | null;
  file_name: string;
};

export type LinkAberto =
  | { estado: Exclude<EstadoDoLink, "ativo"> }
  | { estado: "ativo"; link: { workspace_id: string; brand_id: string }; arquivos: ArquivoAberto[] };

export type Registrado = { asset_id: string; atual_id: string; storage_path: string; file_name: string };

export type ResultadoDaEntrega =
  | { tipo: "emitir"; arquivos: { id: string; url: string; file_name: string }[] }
  | { tipo: "indisponivel"; estado: Exclude<EstadoDoLink, "ativo"> }
  | { tipo: "recusado"; motivo: "fora-do-link" | "retirado" | "identificacao" }
  | { tipo: "falha"; etapa: "abrir" | "caminho" | "assinatura" | "registro" | "mudou" };

export async function liberarEntrega(deps: {
  pedidos: readonly string[];
  abrir: () => Promise<LinkAberto | null>;
  pertenceAMarca: (caminho: string, workspaceId: string, brandId: string) => boolean;
  assinar: (caminho: string, nomeDoArquivo: string) => Promise<string | null>;
  /** Os arquivos escolhidos que serão entregues, e as versões já assinadas, na mesma ordem. */
  registrar: (ids: string[], versoes: string[]) => Promise<
    | { ok: true; linhas: Registrado[] }
    | { ok: false; motivo: "identificacao" | "fora-do-link" | "indisponivel" | "mudou" | "falha"; estado?: Exclude<EstadoDoLink, "ativo"> }
  >;
}): Promise<ResultadoDaEntrega> {
  const aberto = await deps.abrir();
  if (!aberto) return { tipo: "falha", etapa: "abrir" };
  if (aberto.estado !== "ativo") return { tipo: "indisponivel", estado: aberto.estado };

  const doLink = new Map(aberto.arquivos.map((a) => [a.id, a]));
  const escolhidos = deps.pedidos.map((id) => doLink.get(id));
  if (escolhidos.some((a) => !a)) return { tipo: "recusado", motivo: "fora-do-link" };
  // Retirado de uso não é entregue: o banco também não o registra.
  const entregaveis = (escolhidos as ArquivoAberto[]).filter((a) => !a.retirado && a.atual_id && a.storage_path);
  if (entregaveis.length === 0) return { tipo: "recusado", motivo: "retirado" };

  const { workspace_id, brand_id } = aberto.link;
  if (entregaveis.some((a) => !deps.pertenceAMarca(a.storage_path!, workspace_id, brand_id))) {
    return { tipo: "falha", etapa: "caminho" };
  }

  const assinados = new Map<string, string>();
  for (const a of entregaveis) {
    const url = await deps.assinar(a.storage_path!, a.file_name);
    if (!url) return { tipo: "falha", etapa: "assinatura" };
    assinados.set(a.atual_id!, url);
  }

  const registro = await deps.registrar(entregaveis.map((a) => a.id), entregaveis.map((a) => a.atual_id!));
  if (!registro.ok) {
    if (registro.motivo === "indisponivel") return { tipo: "indisponivel", estado: registro.estado ?? "expirado" };
    if (registro.motivo === "identificacao") return { tipo: "recusado", motivo: "identificacao" };
    if (registro.motivo === "fora-do-link") return { tipo: "recusado", motivo: "fora-do-link" };
    if (registro.motivo === "mudou") return { tipo: "falha", etapa: "mudou" };
    return { tipo: "falha", etapa: "registro" };
  }

  // O que foi registrado precisa ser exatamente o que foi assinado. O banco já
  // recusa, ANTES de gravar, versão assinada que deixou de ser a atual
  // (`arquivos_do_link_versao_mudou`); esta conferência é a segunda trava.
  const saem = registro.linhas.map((l) => ({ id: l.asset_id, url: assinados.get(l.atual_id), file_name: l.file_name }));
  if (saem.length !== entregaveis.length || saem.some((s) => !s.url)) return { tipo: "falha", etapa: "mudou" };
  return { tipo: "emitir", arquivos: saem as { id: string; url: string; file_name: string }[] };
}
