import type { Metadata } from "next";
import { LocaleProvider } from "@/platform/locale-client";
import { PRODUCT_LOCALE } from "@/platform/locale";
import { BUCKETS, pertenceAMarca } from "@/lib/storage/caminhos";
import { createServiceClient } from "@/lib/supabase/service";
import { codigoValido, resumoDoCodigo } from "@/lib/links/links";
import { caminhosDeExibicao, vistaDaEntrega, type AbertoAtivo } from "@/lib/links/vista";
import { EntregaPublica, LinkIndisponivel } from "@/components/entrega/EntregaPublica";

/**
 * A página de quem recebeu um LINK DE ENTREGA — ADR-0007 §2.5 (30/09/2026).
 *
 * Sem sessão: o `proxy` deixa passar `/receber/`. A autorização é o código do
 * link, que o BANCO confere (`abrir_link_de_entrega`, só da chave de serviço).
 * A chave de serviço aqui só assina o que o banco já devolveu para ESTE link —
 * miniaturas e imagens das páginas que regem os itens —, depois de conferir que
 * cada caminho é da pasta da marca do link.
 *
 * `no-referrer`: o endereço desta página carrega o código. Sem a política, cada
 * imagem e cada download mandaria o código ao Storage no cabeçalho `Referer`.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Entrega de arquivos",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/** 15 minutos: o bastante para olhar a página; a imagem não é o arquivo. */
const VALIDADE_DE_EXIBICAO_S = 900;

export default async function PaginaDaEntrega({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  return <LocaleProvider locale={PRODUCT_LOCALE}>{await conteudo(codigo)}</LocaleProvider>;
}

async function conteudo(codigo: string) {
  if (!codigoValido(codigo)) return <LinkIndisponivel estado="inexistente" />;

  const hash = resumoDoCodigo(codigo);
  const servico = createServiceClient();
  const { data, error } = await servico.rpc("abrir_link_de_entrega", { p_token_hash: hash });
  if (error || !data) {
    console.error(JSON.stringify({ level: "error", msg: "entrega_abrir_falhou", code: error?.code ?? "sem_dados" }));
    return <LinkIndisponivel estado="erro" />;
  }
  if (data.estado !== "ativo") return <LinkIndisponivel estado={data.estado} />;
  const aberto = data as AbertoAtivo;

  // A abertura fica registrada. Falhar aqui não impede a página: o que a
  // marca precisa saber com certeza — quem BAIXOU — é registrado no download,
  // e sem registro nada é entregue.
  const abertura = await servico.rpc("registrar_acesso_ao_link", {
    p_token_hash: hash, p_evento: "abriu", p_nome: null, p_email: null, p_asset_ids: null,
  });
  if (abertura.error) {
    console.error(JSON.stringify({ level: "error", msg: "entrega_abertura_nao_registrada", code: abertura.error.code ?? "unknown" }));
  }

  const { workspace_id, brand_id } = aberto.link;
  const caminhos = caminhosDeExibicao(aberto).filter((c) => pertenceAMarca(c, workspace_id, brand_id));
  const enderecos = new Map<string, string>();
  if (caminhos.length > 0) {
    const { data: assinadas } = await servico.storage.from(BUCKETS.assets).createSignedUrls(caminhos, VALIDADE_DE_EXIBICAO_S);
    for (const a of assinadas ?? []) if (a.path && a.signedUrl) enderecos.set(a.path, a.signedUrl);
  }

  return <EntregaPublica codigo={codigo} vista={vistaDaEntrega(aberto, enderecos)} />;
}
