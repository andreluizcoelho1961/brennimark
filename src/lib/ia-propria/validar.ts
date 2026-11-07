import { capacidadesDe, modeloAutorizado, podeAnalisarImagem } from "../ai/catalogo";
import { PROVEDORES_DA_AGENCIA, type Encaixe } from "../ai/rotas-da-agencia";
import type { AIProvider } from "../ai/provider";

/**
 * Validação do cadastro de uma chave da agência (ADR-0009 §6) — a parte PURA,
 * antes de qualquer chamada. O servidor repete tudo aqui; a tela só ajuda.
 *
 * O que NÃO existe: campo de endereço da API. Aceitar o endereço que a pessoa
 * digita deixaria o servidor chamar qualquer lugar da rede (SSRF); a lista de
 * provedores e de modelos é fechada e vem do catálogo do produto.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */
export const ENCAIXES: readonly Encaixe[] = ["texto", "imagem", "reserva"];

export type ErroDeCadastro =
  | "encaixe_invalido"
  | "provedor_invalido"
  | "modelo_invalido"
  /** O encaixe "imagem" precisa de um modelo que o produto sabe usar com imagem. */
  | "modelo_sem_visao"
  | "chave_invalida";

export type CadastroValido = { encaixe: Encaixe; provedor: AIProvider; modelo: string; chave: string };

export function validarCadastro(entrada: unknown): { ok: true; cadastro: CadastroValido } | { ok: false; erro: ErroDeCadastro } {
  const e = (entrada ?? {}) as Record<string, unknown>;
  const encaixe = e.encaixe;
  if (typeof encaixe !== "string" || !ENCAIXES.includes(encaixe as Encaixe)) return { ok: false, erro: "encaixe_invalido" };
  const provedor = e.provedor;
  if (typeof provedor !== "string" || !PROVEDORES_DA_AGENCIA.includes(provedor as AIProvider)) return { ok: false, erro: "provedor_invalido" };
  const modelo = e.modelo;
  if (typeof modelo !== "string" || !modeloAutorizado(provedor, modelo)) return { ok: false, erro: "modelo_invalido" };
  const capacidades = capacidadesDe(provedor, modelo);
  if (encaixe === "imagem" && (!capacidades || !podeAnalisarImagem(capacidades))) return { ok: false, erro: "modelo_sem_visao" };
  const chave = typeof e.chave === "string" ? e.chave.trim() : "";
  // Uma chave de API é uma linha só, sem espaço, de tamanho razoável. Isto não
  // confere o formato de cada provedor (eles mudam); confere que não é lixo nem
  // um texto colado por engano. Quem diz se a chave vale é o teste de conexão.
  if (chave.length < 16 || chave.length > 400 || /\s/.test(chave)) return { ok: false, erro: "chave_invalida" };
  return { ok: true, cadastro: { encaixe: encaixe as Encaixe, provedor: provedor as AIProvider, modelo, chave } };
}

/** Os quatro últimos caracteres, para a tela dizer "termina em ••••1234". */
export function finalDaChave(chave: string): string {
  return chave.slice(-4);
}

/**
 * O modelo é gratuito, ou o provedor costuma ser usado em plano gratuito? É só
 * para o aviso da tela: não bloqueia, porque a escolha é da agência (e o termo
 * já diz isso), mas ela precisa ver o aviso no momento de escolher.
 */
export function pareceGratuito(provedor: string, modelo: string): boolean {
  return modelo === "openrouter/free" || modelo.endsWith(":free");
}
