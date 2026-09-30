/**
 * O que a página pública do link mostra — montado a partir do que o banco
 * devolveu (`abrir_link_de_entrega`), já com os endereços de exibição.
 *
 * Esta é a fronteira entre o servidor e o navegador de quem NÃO tem conta. Só
 * atravessa o que a página precisa mostrar. O caminho de Storage de cada
 * arquivo (`storage_path`) fica do lado de cá: ele serve à rota de download,
 * que assina depois de registrar, e nunca à tela. Há teste disso.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */
import type { StatusDaRegra } from "../assets/regra";

export type ArquivoDoBanco = {
  id: string;
  atual_id: string | null;
  retirado: boolean;
  atualizado_em: string | null;
  label: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  miniatura_path: string | null;
  storage_path?: string | null;
  item_id: string | null;
  item_nome: string | null;
  item_tipo: string | null;
  regra_paginas: number[];
};

export type PaginaDoBanco = { pagina: number; titulo: string | null; status: string | null; imagem_path: string | null };

export type AbertoAtivo = {
  estado: "ativo";
  link: { id: string; nome: string; destinatario: string; expira_em: string; workspace_id: string; brand_id: string; marca: string };
  arquivos: ArquivoDoBanco[];
  paginas: PaginaDoBanco[];
};

export type PaginaDaRegra = { pagina: number; titulo: string | null; status: StatusDaRegra; imagem: string | null };

export type ItemDaEntrega = {
  id: string;
  nome: string;
  tipo: string | null;
  regra: PaginaDaRegra[];
  arquivos: {
    id: string;
    label: string;
    file_name: string;
    mime_type: string | null;
    size_bytes: number | null;
    miniatura: string | null;
    atualizado_em: string | null;
    retirado: boolean;
  }[];
};

export type VistaDaEntrega = {
  marca: string;
  nome: string;
  destinatario: string;
  expira_em: string;
  itens: ItemDaEntrega[];
};

const STATUS: ReadonlySet<string> = new Set(["ready", "draft", "pending"]);

/** Os caminhos que precisam de endereço de exibição: miniaturas e imagens de página. */
export function caminhosDeExibicao(aberto: AbertoAtivo): string[] {
  return [
    ...aberto.arquivos.map((a) => a.miniatura_path),
    ...aberto.paginas.map((p) => p.imagem_path),
  ].filter((c): c is string => Boolean(c));
}

/**
 * Agrupa os arquivos por item, na ordem do link, e cola em cada item as
 * páginas que o regem. Página sem seção é citada só pelo número (status
 * `sem-secao`), sem título inventado — a mesma honestidade de Materiais.
 */
export function vistaDaEntrega(aberto: AbertoAtivo, enderecos: ReadonlyMap<string, string>): VistaDaEntrega {
  const paginas = new Map(aberto.paginas.map((p) => [p.pagina, p]));
  const itens = new Map<string, ItemDaEntrega>();

  for (const a of aberto.arquivos) {
    const chave = a.item_id ?? `sem-item-${a.id}`;
    let item = itens.get(chave);
    if (!item) {
      item = {
        id: chave,
        nome: a.item_nome ?? a.label,
        tipo: a.item_tipo,
        regra: (a.regra_paginas ?? []).map((n) => {
          const p = paginas.get(n);
          return {
            pagina: n,
            titulo: p?.titulo?.trim() || null,
            status: (p?.status && STATUS.has(p.status) ? p.status : "sem-secao") as StatusDaRegra,
            imagem: p?.imagem_path ? (enderecos.get(p.imagem_path) ?? null) : null,
          };
        }),
        arquivos: [],
      };
      itens.set(chave, item);
    }
    item.arquivos.push({
      id: a.id,
      label: a.label,
      file_name: a.file_name,
      mime_type: a.mime_type,
      size_bytes: a.size_bytes,
      miniatura: a.miniatura_path ? (enderecos.get(a.miniatura_path) ?? null) : null,
      atualizado_em: a.atualizado_em,
      retirado: a.retirado,
    });
  }

  return {
    marca: aberto.link.marca,
    nome: aberto.link.nome,
    destinatario: aberto.link.destinatario,
    expira_em: aberto.link.expira_em,
    itens: [...itens.values()],
  };
}
