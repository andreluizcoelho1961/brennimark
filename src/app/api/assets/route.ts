import { NextResponse } from "next/server";
import { PRODUCT_LOCALE, inEnglish } from "@/platform/locale";
import { marcaDaRota } from "@/lib/brandville/contexto-da-rota";
import { BUCKETS, pertenceAMarca } from "@/lib/storage/caminhos";
import { citarPaginas, lerManualDaMarca } from "@/lib/assets/regra-do-manual";

/**
 * A miniatura se vê por 10 minutos — o bastante para a tela aberta. Ela NÃO é
 * o arquivo: é um PNG pequeno, legível por quem consulta a marca (a policy do
 * bucket só fecha os originais). Ver a migration `materiais_regra_e_miniatura`.
 */
const VALIDADE_DA_MINIATURA_S = 600;

// Mensagem de erro é do produto, não do manual: quem lê é quem está usando o
// Brennimark. Enquanto a preferência de idioma não tem onde ser guardada, o
// padrão do produto responde por todo mundo — e a fonte é uma só.
const isEnglish = inEnglish(PRODUCT_LOCALE);

export async function GET(request: Request) {
  const resolvido = await marcaDaRota(request);
  // 409 com as opções quando há mais de uma conta: antes isso virava 401, que
  // é falso — a sessão está válida, falta dizer qual conta.
  if (!resolvido.ok) return resolvido.resposta;
  const { auth: context, workspaceId, brandId } = resolvido;

  // Os dois filtros, sempre. `brand_id` sozinho bastaria pela FK composta, mas
  // deixar o workspace de fora tornaria a consulta dependente de uma garantia
  // que vive em outro arquivo — e consultas viajam para outros arquivos.
  const [itensLidos, arquivosLidos] = await Promise.all([
    context.supabase.from("brand_asset_items")
      .select("id, tipo, nome, descricao, ordem, regra_paginas")
      .eq("workspace_id", workspaceId).eq("brand_id", brandId)
      .order("ordem", { ascending: true }).order("created_at", { ascending: true }),
    context.supabase.from("brand_assets")
      .select("id, item_id, label, description, storage_path, file_name, mime_type, size_bytes, status, created_at, descontinuado_em, substituido_por, hierarquia, lockup, cor, polaridade, espaco_de_cor, miniatura_path")
      .eq("workspace_id", workspaceId).eq("brand_id", brandId).order("created_at", { ascending: false }),
  ]);
  if (itensLidos.error || arquivosLidos.error) return NextResponse.json({ message: isEnglish ? "Couldn't load assets." : "Não foi possível carregar os assets." }, { status: 500 });

  /*
   * As miniaturas, assinadas com a SESSÃO numa ida só. Só as que pertencem à
   * pasta desta marca — a constraint do banco já garante, e a rota não confia
   * sozinha nisso.
   */
  const caminhosDasMiniaturas = (arquivosLidos.data ?? [])
    .map((a) => a.miniatura_path as string | null)
    .filter((c): c is string => Boolean(c) && pertenceAMarca(c!, workspaceId, brandId));
  const miniaturas = new Map<string, string>();
  if (caminhosDasMiniaturas.length > 0) {
    const { data: assinadas } = await context.supabase.storage
      .from(BUCKETS.assets).createSignedUrls(caminhosDasMiniaturas, VALIDADE_DA_MINIATURA_S);
    for (const a of assinadas ?? []) if (a.path && a.signedUrl) miniaturas.set(a.path, a.signedUrl);
  }

  // A regra de cada item: as páginas escolhidas, citadas com título e status.
  const { manual, sourceDocumentId } = await lerManualDaMarca(context.supabase, workspaceId, brandId);
  const todasAsPaginas = (itensLidos.data ?? []).flatMap((i) => (i.regra_paginas as number[] | null) ?? []);
  const citacoes = await citarPaginas(context.supabase, sourceDocumentId, todasAsPaginas);
  const assets = (arquivosLidos.data ?? []).map((asset) => {
    return {
      id: asset.id, itemId: asset.item_id, label: asset.label, description: asset.description,
      file_name: asset.file_name, mime_type: asset.mime_type, size_bytes: asset.size_bytes,
      status: asset.status, created_at: asset.created_at,
      // Os eixos da variante (ADR-0007 §2.2). Nulo é "não se aplica a este
      // tipo" — o banco garante que não é "esqueceram de preencher".
      eixos: {
        hierarquia: asset.hierarquia, lockup: asset.lockup, cor: asset.cor,
        polaridade: asset.polaridade, espaco_de_cor: asset.espaco_de_cor,
      },
      /*
       * A listagem não entrega mais endereço de arquivo nenhum.
       *
       * Até 14/09/2026 ela assinava um link de 1 hora para CADA asset da
       * marca: quem abria a página levava o acervo inteiro em links
       * repassáveis, e o servidor não sabia quem de fato baixou. Agora o
       * download passa por `/api/assets/[id]/download`, que registra antes de
       * assinar (ADR-0007 §2.4, item 18).
       *
       * O que fica aqui é só se o arquivo PODE ser servido: um `storage_path`
       * fora da pasta desta marca é defeito de dado, e a tela não deve
       * oferecer um botão que a rota vai recusar.
       */
      baixavel: pertenceAMarca(asset.storage_path, workspaceId, brandId),
      /*
       * Descontinuado vai junto, e não some da lista.
       *
       * O item 10 do ADR-0007 pede a versão anterior "visível e
       * identificada": quem baixou aquele logo ontem precisa poder chegar
       * nele e ver que foi trocado — e por qual. Filtrar aqui devolveria o
       * esquecimento que a coluna existe para evitar; quem separa as duas
       * listas é a tela.
       */
      descontinuadoEm: asset.descontinuado_em ?? null,
      substituidoPor: asset.substituido_por ?? null,
      // Nulo quando a variante não tem miniatura (EPS, AI sem compatibilidade
      // PDF, ou enviada antes da fatia 5): a tela diz o formato, e não um
      // quadrado vazio.
      miniatura: asset.miniatura_path ? (miniaturas.get(asset.miniatura_path) ?? null) : null,
    };
  });
  /*
   * Item sem arquivo vai junto.
   *
   * Cadastrar o item e subir as variantes são dois atos, às vezes de pessoas
   * diferentes. Esconder o item vazio faria quem o criou achar que falhou e
   * criar outro igual.
   */
  const itens = (itensLidos.data ?? []).map((item) => ({
    id: item.id, tipo: item.tipo, nome: item.nome, descricao: item.descricao, ordem: item.ordem,
    regra: ((item.regra_paginas as number[] | null) ?? []).map((p) => citacoes.get(p)!),
  }));
  return NextResponse.json({ itens, assets, manual }, { headers: { "Cache-Control": "no-store" } });
}
