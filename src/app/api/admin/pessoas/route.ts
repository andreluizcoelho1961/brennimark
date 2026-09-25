import { NextResponse } from "next/server";
import { PRODUCT_LOCALE, inEnglish } from "@/platform/locale";
import { workspaceDaRota } from "@/lib/brennimark/contexto-da-rota";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { conferirConcessao, normalizarEmail } from "@/lib/acesso/pessoas";
import { gerarSenhaProvisoria, prazoDaSenhaProvisoria } from "@/lib/acesso/senha-provisoria";

/**
 * Pessoas e acesso — conceder, revogar e listar (metade 1).
 *
 * A AUTORIZAÇÃO VIVE NO BANCO. As três funções chamadas aqui conferem, dentro
 * delas, quem administra a conta — e é assim que tem de ser, porque elas são
 * `security definer` e contornam a RLS. A rota não é a fronteira: ela é a porta
 * que devolve uma resposta legível.
 *
 * Nenhum e-mail sai daqui. Convite com mensagem nossa precisa de serviço de
 * e-mail próprio, e ficou fora da fatia 2.
 *
 * ─── A senha provisória (fatia 2, 18/09/2026) ────────────────────────────────
 *
 * Quem ainda não tem login recebe um, criado AQUI com a chave de serviço e uma
 * senha gerada aqui. A ordem importa: primeiro a concessão, como o
 * administrador (o banco confere se ele pode); só depois o login. Assim, sem
 * autorização, nenhum login nasce.
 *
 * A senha sai UMA vez, nesta resposta, e em nenhum outro lugar: não é gravada
 * legível, não vai para log (nada nesta rota registra corpo), e a resposta
 * carrega `no-store` para nenhum cache guardá-la.
 *
 * `app_metadata` leva `senha_provisoria_ate` e `criado_pela_conta`. Só a chave
 * de serviço o escreve, e o banco o lê para recusar acesso a senha provisória
 * e para impedir que outra conta dê acesso a este login.
 */
const isEnglish = inEnglish(PRODUCT_LOCALE);

const RECUSAS: Record<string, [string, string]> = {
  nome: ["Escreva o nome da pessoa.", "Write the person's name."],
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
    pessoas: (pessoas.data ?? []).map((p: {
      email: string; nome: string | null; papel: string; marcas: unknown; pendente: boolean;
      desde: string; senha_provisoria_ate: string | null;
    }) => ({
      email: p.email, nome: p.nome, papel: p.papel, marcas: p.marcas ?? [], pendente: p.pendente,
      desde: p.desde, senhaProvisoriaAte: p.senha_provisoria_ate,
    })),
    marcas: (marcas.data ?? []).map((b) => ({ id: b.id, nome: b.name })),
  });
}

export async function POST(request: Request) {
  const r = await workspaceDaRota(request);
  if (!r.ok) return r.resposta;

  const corpo = await request.json().catch(() => null);
  const conferido = conferirConcessao({
    nome: corpo?.nome, email: corpo?.email, papel: corpo?.papel, marcas: corpo?.marcas,
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
    p_nome: conferido.concessao.nome,
  });
  if (error) {
    const [message, status] = mensagemDoBanco(error.code, error.message);
    return NextResponse.json({ message }, { status });
  }
  if (data !== "pendente") return NextResponse.json({ resultado: data });

  // Pendente: pode ser quem ainda não tem login — então ele nasce aqui.
  const senha = gerarSenhaProvisoria();
  const validaAte = prazoDaSenhaProvisoria();
  const { error: erroDoLogin } = await createServiceClient().auth.admin.createUser({
    email: conferido.concessao.email,
    password: senha,
    // O endereço não é confirmado por mensagem: quem o atesta é o
    // administrador que o digitou. É por isso que o login fica preso à conta
    // que o criou (ver a migration da senha provisória).
    email_confirm: true,
    app_metadata: { senha_provisoria_ate: validaAte, criado_pela_conta: r.workspaceId },
    user_metadata: { full_name: conferido.concessao.nome },
  });

  if (erroDoLogin) {
    // O login já existia: a concessão ficou pendente e a pessoa ativa com a
    // senha que já tem. Sem senha nova na resposta.
    if (erroDoLogin.code === "email_exists" || erroDoLogin.code === "user_already_exists") {
      return NextResponse.json({ resultado: "pendente" });
    }
    // Só o código vai para o log — nunca o corpo, que tem a senha.
    console.error(JSON.stringify({ level: "error", msg: "login_provisorio_nao_criado", code: erroDoLogin.code ?? "unknown" }));
    return NextResponse.json({
      message: isEnglish
        ? "The grant was recorded, but the sign-in couldn't be created. Use “New password” on this person to try again."
        : "A concessão ficou registrada, mas o login não foi criado. Use “Gerar nova senha” nesta pessoa para tentar de novo.",
    }, { status: 502 });
  }

  return NextResponse.json(
    { resultado: "senha-provisoria", senha, validaAte },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * Gerar nova senha provisória — para quem ainda não trocou a primeira.
 *
 * O banco decide se o pedido é legítimo (`login_provisorio_da_conta`): só login
 * com senha AINDA provisória, criado por ESTA conta, com concessão pendente.
 * Sem essa regra, este botão trocaria a senha de qualquer login pelo e-mail.
 */
export async function PATCH(request: Request) {
  const r = await workspaceDaRota(request);
  if (!r.ok) return r.resposta;

  const corpo = await request.json().catch(() => null);
  const email = normalizarEmail(corpo?.email);
  if (!email) {
    return NextResponse.json({ message: isEnglish ? "Check the email address." : "Confira o e-mail." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: pessoa, error } = await supabase.rpc("login_provisorio_da_conta", {
    p_workspace_id: r.workspaceId, p_email: email,
  });
  if (error || typeof pessoa !== "string") {
    if (error?.code === "22023") {
      return NextResponse.json({
        message: isEnglish
          ? "There's no temporary password to renew for this person."
          : "Não há senha provisória a renovar para esta pessoa.",
      }, { status: 409 });
    }
    const [message, status] = mensagemDoBanco(error?.code, error?.message);
    return NextResponse.json({ message }, { status });
  }

  const senha = gerarSenhaProvisoria();
  const validaAte = prazoDaSenhaProvisoria();
  const { error: erroDaTroca } = await createServiceClient().auth.admin.updateUserById(pessoa, {
    password: senha,
    app_metadata: { senha_provisoria_ate: validaAte, criado_pela_conta: r.workspaceId },
  });
  if (erroDaTroca) {
    console.error(JSON.stringify({ level: "error", msg: "senha_provisoria_nao_renovada", code: erroDaTroca.code ?? "unknown" }));
    return NextResponse.json({
      message: isEnglish ? "Couldn't generate a new password." : "Não foi possível gerar outra senha.",
    }, { status: 502 });
  }

  return NextResponse.json(
    { resultado: "nova-senha", senha, validaAte },
    { headers: { "Cache-Control": "no-store" } },
  );
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
