import { NextResponse } from "next/server";
import { PRODUCT_LOCALE, inEnglish } from "@/platform/locale";
import { BUCKETS, pertenceAMarca } from "@/lib/storage/caminhos";
import { createServiceClient } from "@/lib/supabase/service";
import { codigoValido, identificacaoValida, MAXIMO_DE_ARQUIVOS, resumoDoCodigo } from "@/lib/links/links";
import { liberarEntrega, type LinkAberto } from "@/lib/links/entrega";

const isEnglish = inEnglish(PRODUCT_LOCALE);

/**
 * O download por LINK DE ENTREGA — ADR-0007 §2.5 (30/09/2026).
 *
 * Quem chama não tem conta. O `proxy` deixa passar sem sessão (`/api/receber/`),
 * e passar sem sessão NÃO é passar sem autorização: a autorização é o código
 * do link, conferido pelo BANCO em cada uma das duas chamadas
 * (`abrir_link_de_entrega` e `registrar_acesso_ao_link`, só da chave de
 * serviço). A ordem — abrir, assinar, registrar, emitir — vive em
 * `lib/links/entrega.ts`, com teste.
 *
 * 120 segundos de validade, como o kit: o bastante para o navegador começar as
 * buscas do ZIP, que depois não dependem mais do endereço.
 */
const VALIDADE_DO_ENDERECO_S = 120;
const SEM_CACHE = { "Cache-Control": "no-store" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function t(pt: string, en: string) {
  return isEnglish ? en : pt;
}

export async function POST(request: Request, ctx: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await ctx.params;
  if (!codigoValido(codigo)) {
    return NextResponse.json({ estado: "inexistente", message: t("Este link não existe.", "This link doesn't exist.") }, { status: 404, headers: SEM_CACHE });
  }

  const corpo = await request.json().catch(() => null);
  const nome = typeof corpo?.nome === "string" ? corpo.nome.trim() : "";
  const email = typeof corpo?.email === "string" ? corpo.email.trim() : "";
  const pedidos = Array.isArray(corpo?.arquivos) ? (corpo.arquivos as unknown[]).filter((a): a is string => typeof a === "string" && UUID.test(a)) : [];
  if (!identificacaoValida(nome, email)) {
    return NextResponse.json({ message: t("Diga seu nome e e-mail antes de baixar.", "Tell us your name and email before downloading.") }, { status: 400, headers: SEM_CACHE });
  }
  if (pedidos.length === 0 || pedidos.length > MAXIMO_DE_ARQUIVOS || new Set(pedidos).size !== pedidos.length) {
    return NextResponse.json({ message: t("Escolha os arquivos de novo.", "Choose the files again.") }, { status: 400, headers: SEM_CACHE });
  }

  const hash = resumoDoCodigo(codigo);
  const servico = createServiceClient();

  const resultado = await liberarEntrega({
    pedidos,
    abrir: async () => {
      const { data, error } = await servico.rpc("abrir_link_de_entrega", { p_token_hash: hash });
      return error || !data ? null : (data as LinkAberto);
    },
    pertenceAMarca,
    assinar: async (caminho, nomeDoArquivo) => {
      const { data } = await servico.storage.from(BUCKETS.assets)
        .createSignedUrl(caminho, VALIDADE_DO_ENDERECO_S, { download: nomeDoArquivo });
      return data?.signedUrl ?? null;
    },
    registrar: async (ids, versoes) => {
      const { data, error } = await servico.rpc("registrar_acesso_ao_link", {
        p_token_hash: hash, p_evento: "baixou", p_nome: nome, p_email: email, p_asset_ids: ids, p_versoes: versoes,
      });
      if (!error) return { ok: true, linhas: data ?? [] };
      // As funções do link põem o nome da recusa na DICA; o estado do link, na mensagem (P0002).
      if (error.code === "P0002") {
        const estado = (["inexistente", "expirado", "revogado"] as const).find((e) => error.message.includes(e));
        return { ok: false, motivo: "indisponivel", estado };
      }
      if (error.hint === "acessos_de_link_identificacao") return { ok: false, motivo: "identificacao" };
      if (error.hint === "arquivos_do_link_pertence") return { ok: false, motivo: "fora-do-link" };
      if (error.hint === "arquivos_do_link_versao_mudou") return { ok: false, motivo: "mudou" };
      console.error(JSON.stringify({ level: "error", msg: "entrega_registro_falhou", code: error.code ?? "unknown" }));
      return { ok: false, motivo: "falha" };
    },
  });

  switch (resultado.tipo) {
    case "emitir":
      // Endereços assinados são credencial: nada de cache.
      return NextResponse.json({ arquivos: resultado.arquivos }, { headers: SEM_CACHE });
    case "indisponivel": {
      const mensagem = {
        inexistente: t("Este link não existe.", "This link doesn't exist."),
        expirado: t("Este link expirou. Peça um novo a quem o enviou.", "This link has expired. Ask whoever sent it for a new one."),
        revogado: t("Este link foi encerrado por quem o enviou.", "This link was closed by whoever sent it."),
      }[resultado.estado];
      return NextResponse.json({ estado: resultado.estado, message: mensagem }, { status: 410, headers: SEM_CACHE });
    }
    case "recusado": {
      const mensagem = {
        "fora-do-link": t("Um dos arquivos não faz parte deste link.", "One of the files isn't part of this link."),
        retirado: t("Este arquivo foi retirado de uso pela marca.", "This file was withdrawn by the brand."),
        identificacao: t("Diga seu nome e e-mail antes de baixar.", "Tell us your name and email before downloading."),
      }[resultado.motivo];
      return NextResponse.json({ message: mensagem }, { status: 400, headers: SEM_CACHE });
    }
    case "falha": {
      if (resultado.etapa === "caminho") {
        console.error(JSON.stringify({ level: "error", msg: "entrega_caminho_fora_da_marca" }));
      }
      const mensagem = resultado.etapa === "mudou"
        ? t("Um arquivo acabou de ser atualizado pela marca. Tente de novo.", "A file was just updated by the brand. Try again.")
        : t("Não foi possível preparar o download agora. Tente de novo.", "Couldn't prepare the download right now. Try again.");
      return NextResponse.json({ message: mensagem, etapa: resultado.etapa }, { status: 503, headers: SEM_CACHE });
    }
  }
}
