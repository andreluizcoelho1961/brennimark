import { NextResponse } from "next/server";
import { PRODUCT_LOCALE, inEnglish } from "@/platform/locale";
import { marcaDaRota } from "@/lib/brennimark/contexto-da-rota";
import { BUCKETS, pertenceAImportacao } from "@/lib/storage/caminhos";
import { liberarDownload } from "@/lib/assets/download";
import { nomeDoArquivoDoManual } from "@/lib/documento-fonte/nome-do-arquivo";

const isEnglish = inEnglish(PRODUCT_LOCALE);

/**
 * Baixar o manual em PDF — registrado antes de o endereço ser EMITIDO.
 *
 * Decisão do André (spec da tela do manual, 17/09; tabela aprovada em 23/09):
 * o manual se baixa também no Book, e o download passa por aqui para ficar
 * registrado. Mesma ordem do download de assets, com o mesmo `liberarDownload`
 * — buscar, conferir o caminho, assinar, registrar, e só então emitir: download
 * que não se registra não começa.
 *
 * Os BYTES não passam por esta função. O teto de 4 MiB por resposta derrubaria
 * qualquer manual maior (ver o transporte do documento-fonte no CLAUDE.md): a
 * rota redireciona para um endereço assinado do Storage, válido por 60 s — o
 * bastante para o navegador começar a transferência, que depois não depende
 * mais da validade.
 *
 * ─── O que o registro afirma ───────────────────────────────────────────────
 *
 * O download INICIADO pelo botão. Quem lê o manual já recebe os bytes do PDF
 * pela rota de leitura — é assim que as páginas aparecem —, e a leitura não
 * passa por aqui. Ver o comentário da migration `downloads_do_manual`.
 *
 * ─── Por que assina com a SESSÃO ───────────────────────────────────────────
 *
 * Ao contrário da biblioteca, o bucket de importação já é legível por quem
 * alcança a marca — o visualizador lê o PDF com a sessão da pessoa. Assinar com
 * a chave de serviço não fecharia caminho nenhum e traria uma credencial que
 * ignora a RLS para dentro da rota. A sessão só assina o que a policy do
 * Storage já deixa ler.
 */
const VALIDADE_DO_ENDERECO_S = 60;

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const resolvido = await marcaDaRota(request);
  if (!resolvido.ok) return resolvido.resposta;
  const { auth, workspaceId, brandId, brand } = resolvido;

  // A importação lida em `buscar`, para conferir o caminho contra ela.
  let importacaoLida: string | null = null;

  const resultado = await liberarDownload({
    buscar: async () => {
      // Os dois filtros, sempre: a RLS esconde a importação de marca que a
      // pessoa não alcança, e o filtro por marca impede que um id válido de
      // OUTRA marca dela seja servido sob o endereço desta.
      const { data, error } = await auth.supabase
        .from("brand_imports")
        .select("id, import_id, storage_path, arquivo:report->>arquivo")
        .eq("id", id)
        .eq("workspace_id", workspaceId)
        .eq("brand_id", brandId)
        .maybeSingle();
      if (error) return { ok: false };
      if (!data) return { ok: true, asset: null };
      const linha = data as { id: string; import_id: string; storage_path: string; arquivo: string | null };
      importacaoLida = linha.import_id;
      return {
        ok: true,
        asset: { id: linha.id, storagePath: linha.storage_path, fileName: nomeDoArquivoDoManual(linha.arquivo, brand.brand.name) },
      };
    },
    // A linha veio da RLS; o caminho, não. Ver `pertenceAImportacao`.
    pertenceAMarca: (caminho) => importacaoLida !== null && pertenceAImportacao(caminho, workspaceId, importacaoLida),
    assinar: async (manual) => {
      const { data } = await auth.supabase.storage
        .from(BUCKETS.importacoes)
        .createSignedUrl(manual.storagePath, VALIDADE_DO_ENDERECO_S, { download: manual.fileName });
      return data?.signedUrl ?? null;
    },
    registrar: async (manual) => {
      // Só a importação importa. Pessoa, e-mail, marca, conta e nome do arquivo
      // são preenchidos pelo banco a partir da sessão; o resto é descartado lá.
      const { error } = await auth.supabase.from("downloads_do_manual").insert({
        import_id: manual.id, brand_id: brandId, workspace_id: workspaceId,
        pessoa: auth.user.id, pessoa_email: "", file_name: "",
      });
      return !error;
    },
  });

  switch (resultado.tipo) {
    case "emitir": {
      const resposta = NextResponse.redirect(resultado.endereco, 302);
      // O redirecionamento carrega um endereço assinado: é credencial.
      resposta.headers.set("Cache-Control", "no-store");
      return resposta;
    }
    case "nao-encontrado":
      return NextResponse.json(
        { message: isEnglish ? "Manual not found." : "Manual não encontrado." },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    case "falha": {
      const mensagem = {
        busca: isEnglish ? "Couldn't reach the manual right now. Try again." : "Não foi possível consultar o manual agora. Tente de novo.",
        assinatura: isEnglish ? "Couldn't prepare the download. Try again." : "Não foi possível preparar o download. Tente de novo.",
        registro: isEnglish
          ? "The download couldn't be recorded, so it wasn't started. Try again."
          : "Não foi possível registrar o download, então ele não foi iniciado. Tente de novo.",
      }[resultado.etapa];
      return NextResponse.json({ message: mensagem, etapa: resultado.etapa }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
  }
}
