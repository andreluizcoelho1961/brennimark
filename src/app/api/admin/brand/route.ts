import { NextResponse } from "next/server";
import { conteudoDaRota } from "@/lib/brennimark/contexto-da-rota";
import { PRODUCT_LOCALE, inEnglish } from "@/platform/locale";
import { drenarFilaDeExclusao } from "@/lib/import/limpeza";
import { parseTheme } from "@/lib/brennimark/brand-row";

const isEnglish = inEnglish(PRODUCT_LOCALE);

async function contextoDeAdministracao(request: Request) {
  const resolvido = await conteudoDaRota(request);
  if (!resolvido.ok) return { ok: false as const, resposta: resolvido.resposta };
  const { contexto, auth } = resolvido;
  if (!contexto.capabilities.includes("administrar") || !contexto.brand) {
    return { ok: false as const, resposta: null };
  }
  return { ok: true as const, auth, brand: contexto.brand };
}

const SEM_PERMISSAO = {
  message: isEnglish
    ? "Only owners can delete a brand."
    : "Apenas quem administra pode excluir uma marca.",
};

/**
 * Apagar uma marca, e limpar o que ficou para trás.
 *
 * A rota é IDEMPOTENTE, e isso é a correção principal. Antes, a drenagem da
 * fila só acontecia depois de uma exclusão bem-sucedida: se o Storage
 * falhasse, a marca já não existia, a segunda tentativa recebia "brand not
 * found" e devolvia 404 antes de chegar à fila. Numa conta com uma marca só,
 * nada mais dispararia a limpeza — a fila era durável e inalcançável.
 *
 * Agora a marca ausente não interrompe nada: ela significa que a exclusão já
 * aconteceu, e o que resta é terminar de limpar.
 */
export async function DELETE(request: Request) {
  const resolvido = await contextoDeAdministracao(request);
  if (!resolvido.ok && resolvido.resposta) return resolvido.resposta;
  const auth = resolvido.ok ? resolvido.auth : null;
  if (!auth) return NextResponse.json(SEM_PERMISSAO, { status: 403 });

  const entrada = await request.json().catch(() => null);
  const brandId = typeof entrada?.brandId === "string" ? entrada.brandId : "";
  if (!brandId) {
    return NextResponse.json(
      { message: isEnglish ? "Invalid brand." : "Marca inválida." },
      { status: 400 },
    );
  }

  // Uma transação apaga a marca E registra os arquivos a remover. A fila não
  // tem vínculo com a marca, então sobrevive à cascata — ela existe justamente
  // para o que resta depois que a marca deixou de existir.
  const { data: enfileirados, error } = await auth.supabase.rpc("delete_brand_with_files", {
    p_brand_id: brandId,
  });

  const jaNaoExiste = error?.code === "P0002";
  if (error && !jaNaoExiste) {
    return NextResponse.json(
      { message: isEnglish ? "Couldn't delete the brand." : "Não foi possível excluir a marca." },
      { status: 403 },
    );
  }

  const fila = await drenarFilaDeExclusao(auth);

  return NextResponse.json({
    ok: true,
    // Marca ausente é sucesso: quer dizer que a exclusão já tinha acontecido.
    jaEstavaExcluida: jaNaoExiste,
    arquivosEnfileirados: enfileirados ?? 0,
    arquivosRemovidos: fila.removidos,
    // O número real da conta, não só o desta chamada.
    pendentes: fila.pendentes,
  });
}

/**
 * Drenar sem apagar nada.
 *
 * Existe para que a limpeza não dependa de haver uma marca para excluir. A
 * administração a chama ao abrir, então uma pendência de ontem não espera a
 * próxima exclusão para ser tentada de novo.
 */
export async function POST(request: Request) {
  const resolvido = await contextoDeAdministracao(request);
  if (!resolvido.ok && resolvido.resposta) return resolvido.resposta;
  const auth = resolvido.ok ? resolvido.auth : null;
  if (!auth) return NextResponse.json(SEM_PERMISSAO, { status: 403 });

  const fila = await drenarFilaDeExclusao(auth);
  return NextResponse.json({ ok: true, ...fila });
}

const SEM_PERMISSAO_TEMA = {
  message: isEnglish
    ? "Only owners can edit the brand's visual identity."
    : "Apenas quem administra pode editar a identidade visual da marca.",
};
const TEMA_INVALIDO = {
  message: isEnglish
    ? "Review the theme values — every color is required."
    : "Revise os valores do tema — toda cor é obrigatória.",
};

/**
 * Grava o tema de uma marca já existente.
 *
 * Achado da auditoria de produto: `publish_brand_import` grava um tema
 * neutro placeholder e é o ÚNICO lugar que escreve `brands.theme` — nenhuma
 * tela existia para uma agência substituir isso pela identidade real do
 * manual que acabou de importar. Esta rota é essa tela.
 *
 * Escrita direta via RLS (`Owners can update brands in their workspace`,
 * migração 20260828120000), sem RPC nova: o gate de `administrar` aqui já é
 * equivalente a `owner` hoje (`capabilitiesForRole`), então a policy não
 * precisa mudar.
 */
export async function PATCH(request: Request) {
  const resolvido = await contextoDeAdministracao(request);
  if (!resolvido.ok && resolvido.resposta) return resolvido.resposta;
  const contexto = resolvido.ok ? resolvido : null;
  if (!contexto) return NextResponse.json(SEM_PERMISSAO_TEMA, { status: 403 });

  const input = await request.json().catch(() => null);
  const tema = parseTheme(input?.theme);
  if (!tema) return NextResponse.json(TEMA_INVALIDO, { status: 400 });

  const { error } = await contexto.auth.supabase
    .from("brands")
    .update({ theme: tema })
    .eq("id", contexto.brand.id);

  if (error) {
    return NextResponse.json(
      { message: isEnglish ? "Couldn't save the theme." : "Não foi possível salvar o tema." },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, theme: tema });
}
