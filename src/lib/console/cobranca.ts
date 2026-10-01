/**
 * As ações da cobrança no Console (fatia 2, 01/10/2026): ajustar plano, ligar
 * e desligar preço do Stripe, e gerar o link de pagamento do piloto.
 *
 * Quem pode é decidido no BANCO (`console_*` recusam com 42501 quem não é da
 * equipe); aqui só se confere a FORMA do pedido, para a recusa vir com frase.
 * O link de piloto não passa por função do banco: a rota confere a equipe
 * (`sou_da_equipe_brennimark`) antes de abrir o checkout.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */
import { lerPedidoDeCompra, type PedidoDeCompra } from "../cobranca/compra";

export type AcaoDeCobranca =
  | { tipo: "definir_plano"; codigo: string; nome: string; maximoDeMarcas: number | null; tetoMensalDoViniDolares: number;
      armazenamentoGb: number | null; aVenda: boolean; ordem: number }
  | { tipo: "registrar_preco"; plano: string; idExterno: string; moeda: "BRL" | "USD" }
  | { tipo: "desativar_preco"; id: string }
  | { tipo: "link_de_piloto"; pedido: PedidoDeCompra };

type Leitura = { ok: true; acao: AcaoDeCobranca } | { ok: false; motivo: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODIGO = /^[a-z0-9][a-z0-9-]{1,39}$/;

function inteiroOuNulo(valor: unknown, minimo: number, maximo: number): number | null | undefined {
  if (valor === null || valor === "") return null;
  const n = typeof valor === "string" ? Number(valor) : valor;
  return typeof n === "number" && Number.isInteger(n) && n >= minimo && n <= maximo ? n : undefined;
}

export function lerAcaoDeCobranca(corpo: unknown): Leitura {
  const c = (corpo ?? {}) as Record<string, unknown>;
  switch (c.tipo) {
    case "definir_plano": {
      const codigo = typeof c.codigo === "string" ? c.codigo.trim() : "";
      if (!CODIGO.test(codigo)) return { ok: false, motivo: "O código do plano usa letras minúsculas, números e hífen (2 a 40)." };
      const nome = typeof c.nome === "string" ? c.nome.trim() : "";
      if (nome.length < 1 || nome.length > 60) return { ok: false, motivo: "O nome do plano tem de 1 a 60 caracteres." };
      const maximoDeMarcas = inteiroOuNulo(c.maximoDeMarcas, 1, 100000);
      if (maximoDeMarcas === undefined) return { ok: false, motivo: "Máximo de marcas: um número a partir de 1, ou vazio para sem limite." };
      const teto = typeof c.tetoMensalDoViniDolares === "string" ? Number(c.tetoMensalDoViniDolares) : c.tetoMensalDoViniDolares;
      if (typeof teto !== "number" || !Number.isFinite(teto) || teto < 0 || teto > 100000) {
        return { ok: false, motivo: "Teto mensal do Vini: um valor em dólares, de 0 a 100.000." };
      }
      const armazenamentoGb = inteiroOuNulo(c.armazenamentoGb, 1, 100000);
      if (armazenamentoGb === undefined) return { ok: false, motivo: "Armazenamento: GB inteiros, ou vazio para a definir." };
      const ordem = inteiroOuNulo(c.ordem, 0, 99) ?? 0;
      return { ok: true, acao: { tipo: "definir_plano", codigo, nome, maximoDeMarcas, tetoMensalDoViniDolares: teto,
        armazenamentoGb, aVenda: c.aVenda === true, ordem } };
    }
    case "registrar_preco": {
      const plano = typeof c.plano === "string" && CODIGO.test(c.plano) ? c.plano : null;
      if (!plano) return { ok: false, motivo: "Escolha o plano." };
      const idExterno = typeof c.idExterno === "string" ? c.idExterno.trim() : "";
      if (!/^price_[A-Za-z0-9_]+$/.test(idExterno)) return { ok: false, motivo: "Cole o identificador do preço no Stripe (começa com price_)." };
      if (c.moeda !== "BRL" && c.moeda !== "USD") return { ok: false, motivo: "Escolha a moeda do preço." };
      return { ok: true, acao: { tipo: "registrar_preco", plano, idExterno, moeda: c.moeda } };
    }
    case "desativar_preco": {
      if (typeof c.id !== "string" || !UUID.test(c.id)) return { ok: false, motivo: "Preço inválido." };
      return { ok: true, acao: { tipo: "desativar_preco", id: c.id } };
    }
    case "link_de_piloto": {
      const lido = lerPedidoDeCompra(c);
      return lido.ok ? { ok: true, acao: { tipo: "link_de_piloto", pedido: lido.valor } } : lido;
    }
    default:
      return { ok: false, motivo: "Ação desconhecida." };
  }
}

/** A função do banco e os parâmetros de cada ação que passa pelo banco. */
export function chamadaDaAcaoDeCobranca(acao: Exclude<AcaoDeCobranca, { tipo: "link_de_piloto" }>, motivo: string) {
  switch (acao.tipo) {
    case "definir_plano":
      return { funcao: "console_definir_plano", parametros: {
        p_codigo: acao.codigo, p_nome: acao.nome, p_maximo_de_marcas: acao.maximoDeMarcas,
        p_teto_mensal_do_vini_micros: Math.round(acao.tetoMensalDoViniDolares * 1_000_000),
        p_armazenamento_bytes: acao.armazenamentoGb === null ? null : acao.armazenamentoGb * 1024 ** 3,
        p_a_venda: acao.aVenda, p_ordem: acao.ordem, p_motivo: motivo } };
    case "registrar_preco":
      return { funcao: "console_registrar_preco", parametros: {
        p_plano: acao.plano, p_id_externo: acao.idExterno, p_moeda: acao.moeda, p_intervalo: "mes", p_motivo: motivo } };
    case "desativar_preco":
      return { funcao: "console_desativar_preco", parametros: { p_id: acao.id, p_motivo: motivo } };
  }
}
