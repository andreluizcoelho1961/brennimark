import { NextResponse } from "next/server";
import { PRODUCT_LOCALE, inEnglish } from "@/platform/locale";
import { marcaDaRota } from "@/lib/brandville/contexto-da-rota";
import { BUCKETS, pertenceAMarca } from "@/lib/storage/caminhos";
import { liberarDownload } from "@/lib/assets/download";

const isEnglish = inEnglish(PRODUCT_LOCALE);

/**
 * O download de um asset — registrado antes de o endereço ser EMITIDO.
 *
 * Até 14/09/2026 a biblioteca assinava um endereço de 1 hora para cada arquivo
 * na hora de listar, e o clique ia direto ao Storage: o servidor não sabia
 * quem baixou, e quem abria a página levava o acervo em links repassáveis.
 * Decisão do André: o download passa por aqui. Ver ADR-0007 §2.4, item 18.
 *
 * A ORDEM vive em `lib/assets/download.ts`, onde a suíte de unidade alcança —
 * inclusive as falhas de assinatura e de banco que a revisão externa de 14/09
 * apontou. Aqui ficam só os efeitos e as respostas.
 *
 * Os 60 segundos: o bastante para o navegador seguir o redirecionamento e
 * começar a transferência, que depois não depende mais da validade. Mais que
 * isso devolveria o link repassável que esta rota tirou de circulação.
 */
const VALIDADE_DO_ENDERECO_S = 60;

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const resolvido = await marcaDaRota(request);
  if (!resolvido.ok) return resolvido.resposta;
  const { auth, workspaceId, brandId } = resolvido;

  const resultado = await liberarDownload({
    buscar: async () => {
      // Os dois filtros, sempre. A RLS esconde asset de marca que a pessoa não
      // alcança; o filtro por marca impede que um id válido de OUTRA marca da
      // mesma pessoa seja servido sob o endereço desta.
      const { data, error } = await auth.supabase
        .from("brand_assets")
        .select("id, storage_path, file_name")
        .eq("id", id)
        .eq("workspace_id", workspaceId)
        .eq("brand_id", brandId)
        .maybeSingle();
      if (error) return { ok: false };
      return {
        ok: true,
        asset: data ? { id: data.id, storagePath: data.storage_path, fileName: data.file_name } : null,
      };
    },
    // A RLS protege a LINHA; ela não protege o objeto do Storage. Um caminho
    // gravado errado assinaria o arquivo de outra marca com esta sessão.
    pertenceAMarca: (caminho) => pertenceAMarca(caminho, workspaceId, brandId),
    assinar: async (asset) => {
      const { data } = await auth.supabase.storage
        .from(BUCKETS.assets)
        .createSignedUrl(asset.storagePath, VALIDADE_DO_ENDERECO_S, { download: asset.fileName });
      return data?.signedUrl ?? null;
    },
    registrar: async (asset) => {
      // Só o asset importa. Pessoa, e-mail, marca, rótulo e nome do arquivo são
      // preenchidos pelo banco a partir da sessão; o resto é descartado lá.
      const { error } = await auth.supabase.from("brand_asset_downloads").insert({
        asset_id: asset.id, brand_id: brandId, workspace_id: workspaceId,
        pessoa: auth.user.id, pessoa_email: "", asset_label: "", file_name: "",
      });
      return !error;
    },
  });

  switch (resultado.tipo) {
    case "emitir": {
      const resposta = NextResponse.redirect(resultado.endereco, 302);
      // O redirecionamento carrega um endereço assinado: é credencial. Em cache,
      // seria servido a outra pessoa — ou a esta, sem registrar de novo.
      resposta.headers.set("Cache-Control", "no-store");
      return resposta;
    }
    case "nao-encontrado":
      return NextResponse.json(
        { message: isEnglish ? "Asset not found." : "Asset não encontrado." },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    case "falha": {
      const mensagem = {
        busca: isEnglish ? "Couldn't reach the library right now. Try again." : "Não foi possível consultar a biblioteca agora. Tente de novo.",
        assinatura: isEnglish ? "Couldn't prepare the download. Try again." : "Não foi possível preparar o download. Tente de novo.",
        registro: isEnglish
          ? "The download couldn't be recorded, so it wasn't started. Try again."
          : "Não foi possível registrar o download, então ele não foi iniciado. Tente de novo.",
      }[resultado.etapa];
      // 503 nas três: são indisponibilidades momentâneas, e "tente de novo" é
      // verdade em todas. Nenhuma é "não existe".
      return NextResponse.json({ message: mensagem, etapa: resultado.etapa }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
  }
}
