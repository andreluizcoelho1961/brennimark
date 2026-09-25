import { NextResponse } from "next/server";
import { PRODUCT_LOCALE, inEnglish } from "@/platform/locale";
import { marcaDaRota } from "@/lib/brennimark/contexto-da-rota";
import { BUCKETS, pertenceAMarca } from "@/lib/storage/caminhos";
import { liberarKit } from "@/lib/assets/liberar-kit";
import { createServiceClient } from "@/lib/supabase/service";
import type { Eixos } from "@/lib/assets/eixos";

const isEnglish = inEnglish(PRODUCT_LOCALE);

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
  const resolvido = await marcaDaRota(request);
  if (!resolvido.ok) return resolvido.resposta;
  const { auth, workspaceId, brandId, brand } = resolvido;

  const corpo = await request.json().catch(() => null);
  const itemId = typeof corpo?.itemId === "string" ? corpo.itemId : "";
  const ids = Array.isArray(corpo?.ids) ? (corpo.ids as unknown[]).filter((i): i is string => typeof i === "string") : null;
  if (!itemId) return NextResponse.json({ message: isEnglish ? "Choose an item." : "Escolha um item." }, { status: 400 });

  const resultado = await liberarKit({
    marca: brand.brand.name,
    buscar: async () => {
      const [itemLido, variantesLidas] = await Promise.all([
        auth.supabase.from("brand_asset_items").select("nome")
          .eq("id", itemId).eq("workspace_id", workspaceId).eq("brand_id", brandId).maybeSingle(),
        (() => {
          let consulta = auth.supabase.from("brand_assets")
            .select("id, storage_path, file_name, hierarquia, lockup, cor, polaridade, espaco_de_cor")
            .eq("item_id", itemId).eq("workspace_id", workspaceId).eq("brand_id", brandId)
            .order("created_at", { ascending: true });
          // O kit inteiro leva só o que está em uso; a seleção leva o que a
          // pessoa escolheu — inclusive o que saiu de uso, se ela pediu.
          consulta = ids ? consulta.in("id", ids.slice(0, 200)) : consulta.is("descontinuado_em", null);
          return consulta;
        })(),
      ]);
      if (itemLido.error || variantesLidas.error) return { ok: false };
      return {
        ok: true,
        item: itemLido.data ? { nome: itemLido.data.nome as string } : null,
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
      // "um kit". Pessoa, e-mail, marca e nome do arquivo vêm do banco.
      const { error } = await auth.supabase.from("brand_asset_downloads").insert(
        idsDoKit.map((id) => ({
          asset_id: id, brand_id: brandId, workspace_id: workspaceId,
          pessoa: auth.user.id, pessoa_email: "", asset_label: "", file_name: "",
        })),
      );
      return !error;
    },
  });

  const semCache = { "Cache-Control": "no-store" };
  switch (resultado.tipo) {
    case "emitir":
      // Endereços assinados são credencial: nada de cache.
      return NextResponse.json({ nome: resultado.nome, arquivos: resultado.arquivos }, { headers: semCache });
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
