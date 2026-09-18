import { NextResponse } from "next/server";
import { PRODUCT_LOCALE, inEnglish } from "@/platform/locale";
import { workspaceDaRota } from "@/lib/brandville/contexto-da-rota";
import { createClient } from "@/lib/supabase/server";
import { conferirConcessao, normalizarEmail } from "@/lib/acesso/pessoas";

/**
 * Pessoas e acesso — conceder, revogar e listar (metade 1).
 *
 * A AUTORIZAÇÃO VIVE NO BANCO. As três funções chamadas aqui conferem, dentro
 * delas, quem administra a conta — e é assim que tem de ser, porque elas são
 * `security definer` e contornam a RLS. A rota não é a fronteira: ela é a porta
 * que devolve uma resposta legível.
 *
 * Nenhum e-mail sai daqui. Quem manda o e-mail de autenticação é o Supabase
 * Auth, quando a pessoa entra pela primeira vez. Convite com mensagem nossa é a
 * metade 2, e precisa de serviço de e-mail próprio.
 */
const isEnglish = inEnglish(PRODUCT_LOCALE);

const RECUSAS: Record<string, [string, string]> = {
  email: ["Confira o e-mail.", "Check the email address."],
  papel: ["Escolha o nível de acesso.", "Choose the access level."],
  "administrador-com-marca": [
    "Quem administra alcança todas as marcas da conta — não se escolhe marca a marca.",
    "An administrator reaches every brand in the account — brands aren't picked one by one.",
  ],
  "consulta-sem-marca": ["Escolha ao menos uma marca.", "Choose at least one brand."],
};

/** A recusa do banco, traduzida. Código desconhecido não vira frase inventada. */
function mensagemDoBanco(code: string | undefined, message: string | undefined): [string, number] {
  if (code === "42501") {
    return [isEnglish ? "Only an administrator can manage access." : "Só quem administra a conta gerencia o acesso.", 403];
  }
  if (code === "23514" && (message ?? "").includes("administrador")) {
    return [
      isEnglish
        ? "The account would be left without an administrator. Grant administration to someone else first."
        : "A conta ficaria sem administrador. Conceda a administração a outra pessoa antes.",
      409,
    ];
  }
  if (code === "22023") {
    return [isEnglish ? "Check the details of this grant." : "Revise os dados desta concessão.", 400];
  }
  return [isEnglish ? "Couldn't complete this." : "Não foi possível concluir.", 500];
}

export async function GET(request: Request) {
  const r = await workspaceDaRota(request);
  if (!r.ok) return r.resposta;
  const supabase = await createClient();

  // As marcas vêm pela RLS normal: quem administra a conta as alcança todas, e
  // é essa mesma lista que o formulário oferece.
  const [pessoas, marcas] = await Promise.all([
    supabase.rpc("pessoas_da_conta", { p_workspace_id: r.workspaceId }),
    supabase.from("brands").select("id, name").eq("workspace_id", r.workspaceId).order("name"),
  ]);

  if (pessoas.error) {
    const [message, status] = mensagemDoBanco(pessoas.error.code, pessoas.error.message);
    return NextResponse.json({ message }, { status });
  }

  return NextResponse.json({
    pessoas: (pessoas.data ?? []).map((p: { email: string; papel: string; marcas: unknown; pendente: boolean; desde: string }) => ({
      email: p.email, papel: p.papel, marcas: p.marcas ?? [], pendente: p.pendente, desde: p.desde,
    })),
    marcas: (marcas.data ?? []).map((b) => ({ id: b.id, nome: b.name })),
  });
}

export async function POST(request: Request) {
  const r = await workspaceDaRota(request);
  if (!r.ok) return r.resposta;

  const corpo = await request.json().catch(() => null);
  const conferido = conferirConcessao({
    email: corpo?.email, papel: corpo?.papel, marcas: corpo?.marcas,
  });
  if (!conferido.ok) {
    const par = RECUSAS[conferido.motivo];
    return NextResponse.json({ message: isEnglish ? par[1] : par[0] }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("conceder_acesso", {
    p_workspace_id: r.workspaceId,
    p_email: conferido.concessao.email,
    p_papel: conferido.concessao.papel,
    p_marcas: conferido.concessao.marcas,
  });
  if (error) {
    const [message, status] = mensagemDoBanco(error.code, error.message);
    return NextResponse.json({ message }, { status });
  }
  return NextResponse.json({ resultado: data });
}

export async function DELETE(request: Request) {
  const r = await workspaceDaRota(request);
  if (!r.ok) return r.resposta;

  const corpo = await request.json().catch(() => null);
  const email = normalizarEmail(corpo?.email);
  const marca = typeof corpo?.marca === "string" && corpo.marca ? corpo.marca : null;
  if (!email) {
    return NextResponse.json({ message: isEnglish ? "Check the email address." : "Confira o e-mail." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("revogar_acesso", {
    p_workspace_id: r.workspaceId, p_email: email, p_marca: marca,
  });
  if (error) {
    const [message, status] = mensagemDoBanco(error.code, error.message);
    return NextResponse.json({ message }, { status });
  }
  return NextResponse.json({ resultado: data });
}
