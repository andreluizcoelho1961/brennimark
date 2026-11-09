import { NextResponse } from "next/server";
import { inEnglish } from "@/platform/locale";
import { idiomaDaSessao } from "@/lib/idioma-da-sessao";
import { marcaDaRota } from "@/lib/brennimark/contexto-da-rota";
import { BUCKETS, pertenceAMarca } from "@/lib/storage/caminhos";
import { liberarKit } from "@/lib/assets/liberar-kit";
import { MAXIMO_DO_KIT, finalidadeDoDownload, segmentoSeguro } from "@/lib/assets/kit";
import { liberarMarca, MAXIMO_DA_MARCA, TETO_DA_MARCA_BYTES } from "@/lib/assets/liberar-marca";
import { ehLicenca, leiaMeDeFontes, type LicencaDoItem } from "@/lib/assets/fonte";
import { createServiceClient } from "@/lib/supabase/service";
import type { Eixos } from "@/lib/assets/eixos";


/**
 * O kit de um item — fatia 5. "Cada tipo tem um botão que baixa o kit"
 * (André, 17/09). Também serve a seleção feita em "Escolher arquivos": com
 * `ids`, o kit leva só os escolhidos, do mesmo item.
 *
 * Devolve endereços assinados, e não bytes: o navegador busca cada um e monta
 * o ZIP (o teto de 4 MiB por resposta derrubaria qualquer kit de verdade). A
 * ordem vive em `lib/assets/liberar-kit.ts`, com teste — cada arquivo do kit
 * fica registrado em `brand_asset_downloads` ANTES de o endereço existir.
 *
 * Assinado com a chave de SERVIÇO pelo mesmo motivo do download avulso: desde
 * `storage_por_marca`, ninguém lê original direto no Storage. A AUTORIZAÇÃO
 * vem de antes — o item e as variantes foram lidos com a sessão da pessoa (a
 * RLS só os devolve a quem tem `consultar` na marca), e cada caminho é
 * conferido contra a pasta da marca.
 *
 * 120 segundos: o bastante para o navegador começar as buscas do kit, que
 * depois não dependem mais da validade.
 */
const VALIDADE_DO_ENDERECO_S = 120;

export async function POST(request: Request) {
  const isEnglish = inEnglish(await idiomaDaSessao());
  const resolvido = await marcaDaRota(request);
  if (!resolvido.ok) return resolvido.resposta;
  const { auth, workspaceId, brandId, brand } = resolvido;

  const corpo = await request.json().catch(() => null);
  const itemId = typeof corpo?.itemId === "string" ? corpo.itemId : "";
  const ids = Array.isArray(corpo?.ids) ? (corpo.ids as unknown[]).filter((i): i is string => typeof i === "string") : null;
  const finalidade = finalidadeDoDownload(corpo?.finalidade, ids);
  // `marca: true` pede TUDO o que está em uso na marca, de uma vez (03/11/2026).
  const marcaInteira = corpo?.marca === true && !itemId;
  if (!itemId && !marcaInteira) return NextResponse.json({ message: isEnglish ? "Choose an item." : "Escolha um item." }, { status: 400 });
  // Seleção acima do máximo é recusada já aqui, com o número que a pessoa
  // escolheu — antes, os ids eram cortados em silêncio (200, depois 60).
  if (ids && ids.length > MAXIMO_DO_KIT) {
    return NextResponse.json({ message: mensagemDeKitGrande(ids.length, true, isEnglish) }, { status: 400 });
  }

  if (marcaInteira) {
    const todos = await liberarMarca({
      marca: brand.brand.name, ingles: isEnglish,
      buscar: async () => {
        // Fotos e ilustrações têm o Banco de imagens; aqui, o resto, em uso e
        // sem fonte retirada.
        const itensLidos = await auth.supabase.from("brand_asset_items")
          .select("id, nome, tipo, licenca_tipo, licenca_titular, licenca_como_obter")
          .eq("workspace_id", workspaceId).eq("brand_id", brandId)
          .not("tipo", "in", "(foto,ilustracao)")
          .order("ordem", { ascending: true }).order("created_at", { ascending: true });
        if (itensLidos.error) return { ok: false as const };
        const itens = (itensLidos.data ?? []).map((i) => ({
          id: i.id as string, nome: i.nome as string, tipo: i.tipo as string,
          licenca: ehLicenca(i.licenca_tipo)
            ? { tipo: i.licenca_tipo, titular: (i.licenca_titular as string | null) ?? null, comoObter: (i.licenca_como_obter as string | null) ?? null }
            : null,
        }));
        if (itens.length === 0) return { ok: true as const, itens, arquivos: [] };
        const variantes = await auth.supabase.from("brand_assets")
          .select("id, item_id, storage_path, file_name, size_bytes, hierarquia, lockup, cor, polaridade, espaco_de_cor")
          .eq("workspace_id", workspaceId).eq("brand_id", brandId)
          .in("item_id", itens.map((i) => i.id))
          .is("descontinuado_em", null).is("retirada_em", null)
          .order("created_at", { ascending: true });
        if (variantes.error) return { ok: false as const };
        return {
          ok: true as const, itens,
          arquivos: (variantes.data ?? []).map((v) => ({
            id: v.id as string, itemId: v.item_id as string, storagePath: v.storage_path as string, fileName: v.file_name as string,
            tamanho: v.size_bytes as number,
            eixos: { hierarquia: v.hierarquia, lockup: v.lockup, cor: v.cor, polaridade: v.polaridade, espaco_de_cor: v.espaco_de_cor } as Eixos,
          })),
        };
      },
      pertenceAMarca: (caminho) => pertenceAMarca(caminho, workspaceId, brandId),
      assinar: async (caminhos) => {
        const { data, error } = await createServiceClient().storage
          .from(BUCKETS.assets).createSignedUrls(caminhos, VALIDADE_DO_ENDERECO_S);
        if (error || !data) return null;
        const enderecos = new Map<string, string>();
        for (const d of data) if (d.path && d.signedUrl) enderecos.set(d.path, d.signedUrl);
        return enderecos;
      },
      registrar: async (idsDoKit) => {
        const { error } = await auth.supabase.from("brand_asset_downloads").insert(
          idsDoKit.map((id) => ({
            asset_id: id, brand_id: brandId, workspace_id: workspaceId,
            pessoa: auth.user.id, pessoa_email: "", asset_label: "", file_name: "", finalidade: "download",
          })),
        );
        return !error;
      },
    });
    const sem = { "Cache-Control": "no-store" };
    switch (todos.tipo) {
      case "emitir": return NextResponse.json({ nome: todos.nome, arquivos: todos.arquivos, extras: todos.extras }, { headers: sem });
      case "vazio": return NextResponse.json({ message: isEnglish ? "This brand has no materials in use to download." : "Esta marca não tem materiais em uso para baixar." }, { status: 404, headers: sem });
      case "grande-demais":
        return NextResponse.json({ message: isEnglish
          ? `This brand has ${todos.total} files in use; the full download takes up to ${MAXIMO_DA_MARCA}. Download by item instead.`
          : `Esta marca tem ${todos.total} arquivos em uso; o download completo leva até ${MAXIMO_DA_MARCA}. Baixe por item.` }, { status: 400, headers: sem });
      case "pesado-demais":
        return NextResponse.json({ message: isEnglish
          ? `The full download is ${Math.round(todos.bytes / 1024 / 1024)} MB; the limit is ${Math.round(TETO_DA_MARCA_BYTES / 1024 / 1024)} MB. Download by item instead.`
          : `O download completo tem ${Math.round(todos.bytes / 1024 / 1024)} MB; o limite é ${Math.round(TETO_DA_MARCA_BYTES / 1024 / 1024)} MB. Baixe por item.` }, { status: 400, headers: sem });
      case "falha": {
        const mensagem = {
          busca: isEnglish ? "Couldn't reach the library right now. Try again." : "Não foi possível consultar a biblioteca agora. Tente de novo.",
          assinatura: isEnglish ? "Couldn't prepare the download. Try again." : "Não foi possível preparar o download. Tente de novo.",
          registro: isEnglish ? "The download couldn't be recorded, so it wasn't started. Try again." : "Não foi possível registrar o download, então ele não foi iniciado. Tente de novo.",
        }[todos.etapa];
        return NextResponse.json({ message: mensagem, etapa: todos.etapa }, { status: 503, headers: sem });
      }
    }
  }

  // O item lido em `buscar`, para o LEIA-ME de fonte depois.
  const guardado: { item: { nome: string; tipo: string; licenca: LicencaDoItem | null } | null } = { item: null };
  const resultado = await liberarKit({
    marca: brand.brand.name,
    buscar: async () => {
      const [itemBruto, variantesLidas] = await Promise.all([
        auth.supabase.from("brand_asset_items").select("nome, tipo, licenca_tipo, licenca_titular, licenca_como_obter")
          .eq("id", itemId).eq("workspace_id", workspaceId).eq("brand_id", brandId).maybeSingle(),
        (() => {
          let consulta = auth.supabase.from("brand_assets")
            .select("id, storage_path, file_name, hierarquia, lockup, cor, polaridade, espaco_de_cor")
            .eq("item_id", itemId).eq("workspace_id", workspaceId).eq("brand_id", brandId)
            // Fonte retirada (ADR-0007 §3, condição 3) não sai em kit nenhum.
            .is("retirada_em", null)
            .order("created_at", { ascending: true });
          // O kit inteiro leva só o que está em uso; a seleção leva o que a
          // pessoa escolheu — inclusive o que saiu de uso, se ela pediu.
          consulta = ids ? consulta.in("id", ids) : consulta.is("descontinuado_em", null);
          return consulta;
        })(),
      ]);
      if (itemBruto.error || variantesLidas.error) return { ok: false };
      // O item inteiro fica guardado, para o LEIA-ME de fonte depois.
      const lido = itemBruto.data;
      guardado.item = lido ? {
        nome: lido.nome as string, tipo: lido.tipo as string,
        licenca: ehLicenca(lido.licenca_tipo)
          ? { tipo: lido.licenca_tipo, titular: (lido.licenca_titular as string | null) ?? null, comoObter: (lido.licenca_como_obter as string | null) ?? null }
          : null,
      } : null;
      return {
        ok: true,
        item: lido ? { nome: lido.nome as string } : null,
        arquivos: (variantesLidas.data ?? []).map((v) => ({
          id: v.id as string, storagePath: v.storage_path as string, fileName: v.file_name as string,
          eixos: {
            hierarquia: v.hierarquia, lockup: v.lockup, cor: v.cor, polaridade: v.polaridade, espaco_de_cor: v.espaco_de_cor,
          } as Eixos,
        })),
      };
    },
    pertenceAMarca: (caminho) => pertenceAMarca(caminho, workspaceId, brandId),
    assinar: async (caminhos) => {
      const { data, error } = await createServiceClient().storage
        .from(BUCKETS.assets).createSignedUrls(caminhos, VALIDADE_DO_ENDERECO_S);
      if (error || !data) return null;
      const enderecos = new Map<string, string>();
      for (const d of data) if (d.path && d.signedUrl) enderecos.set(d.path, d.signedUrl);
      return enderecos;
    },
    registrar: async (idsDoKit) => {
      // Uma linha por arquivo: o registro diz o que cada pessoa levou, e não
      // "um kit". Pessoa, e-mail, marca e nome do arquivo vêm do banco. A
      // `finalidade` distingue o original que a ferramenta lê para desenhar
      // (`previa`) do que a pessoa levou (`download`): a linha nasce nos dois
      // casos, porque em ambos o endereço existiu.
      const { error } = await auth.supabase.from("brand_asset_downloads").insert(
        idsDoKit.map((id) => ({
          asset_id: id, brand_id: brandId, workspace_id: workspaceId,
          pessoa: auth.user.id, pessoa_email: "", asset_label: "", file_name: "", finalidade,
        })),
      );
      return !error;
    },
  });

  const semCache = { "Cache-Control": "no-store" };
  switch (resultado.tipo) {
    case "grande-demais":
      return NextResponse.json({ message: mensagemDeKitGrande(resultado.total, Boolean(ids), isEnglish) }, { status: 400, headers: semCache });
    case "emitir":
      // Endereços assinados são credencial: nada de cache.
      return NextResponse.json({
        nome: resultado.nome, arquivos: resultado.arquivos,
        // Kit de fonte leva um LEIA-ME com a licença e como instalar (§3.3).
        extras: guardado.item?.tipo === "fonte" ? [{
          caminho: `${segmentoSeguro(resultado.nome.replace(/\.zip$/i, ""), "materiais")}/LEIA-ME.txt`,
          texto: leiaMeDeFontes({
            marca: brand.brand.name, item: guardado.item.nome, licenca: guardado.item.licenca, ingles: isEnglish,
            arquivos: resultado.arquivos.map((a) => a.caminho.split("/").pop() ?? a.caminho),
          }),
        }] : [],
      }, { headers: semCache });
    case "vazio":
      return NextResponse.json({ message: isEnglish ? "This item has no files in use." : "Este item não tem arquivos em uso." }, { status: 404, headers: semCache });
    case "nao-encontrado":
      return NextResponse.json({ message: isEnglish ? "Item not found." : "Item não encontrado." }, { status: 404, headers: semCache });
    case "falha": {
      const mensagem = {
        busca: isEnglish ? "Couldn't reach the library right now. Try again." : "Não foi possível consultar a biblioteca agora. Tente de novo.",
        assinatura: isEnglish ? "Couldn't prepare the kit. Try again." : "Não foi possível preparar o kit. Tente de novo.",
        registro: isEnglish
          ? "The download couldn't be recorded, so it wasn't started. Try again."
          : "Não foi possível registrar o download, então ele não foi iniciado. Tente de novo.",
      }[resultado.etapa];
      return NextResponse.json({ message: mensagem, etapa: resultado.etapa }, { status: 503, headers: semCache });
    }
  }
}

/** O kit acima do máximo, dito com números — e o que fazer. */
function mensagemDeKitGrande(total: number, selecao: boolean, isEnglish: boolean): string {
  if (isEnglish) {
    return selecao
      ? `You selected ${total} files; a kit downloads up to ${MAXIMO_DO_KIT} at a time. Select fewer and download in parts.`
      : `This item has ${total} files in use; a kit downloads up to ${MAXIMO_DO_KIT} at a time. Select the files and download in parts.`;
  }
  return selecao
    ? `Você selecionou ${total} arquivos; um kit baixa até ${MAXIMO_DO_KIT} de cada vez. Selecione menos e baixe em partes.`
    : `Este item tem ${total} arquivos em uso; um kit baixa até ${MAXIMO_DO_KIT} de cada vez. Selecione os arquivos e baixe em partes.`;
}
