import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { buscarSessaoNoStripe, chavesDoStripe } from "@/lib/cobranca/stripe";
import { conferirSenhaNova } from "@/lib/acesso/senha-provisoria";
import { DESTINO_PADRAO } from "@/platform/destino-de-retorno";
import {
  CAMINHO_DO_COOKIE, COOKIE_DA_PROVA, loginDaCompra, mesmoTexto, momentoDaVolta, resumoDaProva, sessaoValida,
  type LoginDaCompra, type Momento, type SessaoDaCompra,
} from "@/lib/cobranca/senha-na-volta";

/**
 * A senha criada na volta do pagamento (02/10/2026). As regras e o porquê
 * estão em `@/lib/cobranca/senha-na-volta`; aqui só as portas.
 *
 * Passa pelo `proxy` sem sessão (caminho exato em `caminhos-publicos.ts`):
 * quem acabou de pagar ainda não tem sessão nenhuma. Passar sem sessão não é
 * passar sem autorização — a trava é a PROVA DO NAVEGADOR (o cookie que só o
 * navegador que abriu o checkout tem), conferida contra o resumo que o Stripe
 * guardou, ANTES de qualquer consulta ao banco. Sem ela, a resposta é sempre a
 * mesma ("sem-prova") e não diz nada sobre a compra.
 *
 *   { sessao, acao: "ver" }                         → em que momento a volta está
 *   { sessao, acao: "criar", senha, confirmacao }   → cria a senha, uma vez
 *
 * Depois de criar, quem entra é o navegador (`signInWithPassword`, como na tela
 * de login): esta rota não abre sessão nenhuma.
 *
 * A senha não vai para log nem para a resposta. O e-mail volta só a quem tem a
 * prova — é o e-mail que essa mesma pessoa digitou na compra.
 */
type Contexto = {
  momento: Momento; email: string | null; userId: string | null; conta: string | null; metadados: Record<string, unknown>;
  comprador: string | null; empresa: string | null;
};

const SEM_PROVA = (status = 200) => NextResponse.json({ momento: "sem-prova" }, { status, headers: { "Cache-Control": "no-store" } });

async function contexto(request: NextRequest, idDaSessao: string): Promise<Contexto | NextResponse> {
  const prova = request.cookies.get(COOKIE_DA_PROVA)?.value;
  if (!prova) return SEM_PROVA();

  const chaves = chavesDoStripe();
  if (!chaves) return NextResponse.json({ message: "A compra online ainda não está aberta." }, { status: 503 });

  let sessao: SessaoDaCompra;
  try {
    sessao = await buscarSessaoNoStripe(chaves.chave, idDaSessao);
  } catch (erro) {
    // Sessão que não existe (ou de outra conta do Stripe) é só "sem prova".
    if ((erro as { code?: string }).code === "resource_missing") return SEM_PROVA();
    console.error(JSON.stringify({ level: "error", msg: "senha_na_volta_stripe_falhou", motivo: erro instanceof Error ? erro.message.slice(0, 200) : "desconhecido" }));
    return NextResponse.json({ message: "Não foi possível consultar o pagamento. Tente de novo." }, { status: 502 });
  }

  const provaConfere = sessao.resumoDaProva !== null && mesmoTexto(await resumoDaProva(prova), sessao.resumoDaProva);
  if (!provaConfere) return SEM_PROVA();

  const agora = Date.now();
  const servico = createServiceClient();
  let conta: string | null = null;
  let login: LoginDaCompra | null = null;
  let userId: string | null = null;
  let metadados: Record<string, unknown> = {};

  if (sessao.paga && sessao.idAssinatura && sessao.email) {
    const { data: assinatura, error } = await servico.from("assinaturas")
      .select("workspace_id, titular_email, workspaces(slug)")
      .eq("provedor", "stripe").eq("id_externo_assinatura", sessao.idAssinatura)
      .maybeSingle<{ workspace_id: string | null; titular_email: string; workspaces: { slug: string } | null }>();
    if (error) throw new Error(`assinatura: ${error.code}`);

    if (assinatura?.workspace_id && assinatura.titular_email.toLowerCase() === sessao.email) {
      conta = assinatura.workspaces?.slug ?? null;
      // O titular é dono da conta que a compra abriu. Entre os donos, o login
      // cujo e-mail é o da compra — nunca outro.
      const { data: donos, error: erroDosDonos } = await servico.from("workspace_members")
        .select("user_id").eq("workspace_id", assinatura.workspace_id).eq("role", "owner");
      if (erroDosDonos) throw new Error(`donos: ${erroDosDonos.code}`);
      for (const { user_id } of (donos ?? []) as { user_id: string }[]) {
        const { data } = await servico.auth.admin.getUserById(user_id);
        if (data.user?.email?.toLowerCase() === sessao.email) {
          login = loginDaCompra(data.user);
          userId = data.user.id;
          metadados = (data.user.app_metadata ?? {}) as Record<string, unknown>;
          break;
        }
      }
    }
  }

  return {
    momento: momentoDaVolta({ provaConfere, sessao, contaExiste: conta !== null, login, agora }),
    email: sessao.email, userId, conta, metadados, comprador: sessao.comprador, empresa: sessao.empresa,
  };
}

export async function POST(request: NextRequest) {
  const corpo = await request.json().catch(() => null) as { sessao?: unknown; acao?: unknown; senha?: unknown; confirmacao?: unknown } | null;
  if (!sessaoValida(corpo?.sessao)) return SEM_PROVA(400);

  let c: Contexto | NextResponse;
  try {
    c = await contexto(request, corpo.sessao);
  } catch (erro) {
    console.error(JSON.stringify({ level: "error", msg: "senha_na_volta_falhou", motivo: erro instanceof Error ? erro.message.slice(0, 200) : "desconhecido" }));
    return NextResponse.json({ message: "Não foi possível conferir a compra. Tente de novo." }, { status: 500 });
  }
  if (c instanceof NextResponse) return c;

  const mostraEmail = c.momento === "criar-senha" || c.momento === "ja-tem-acesso";
  const leitura = { momento: c.momento, email: mostraEmail ? c.email : null };

  if (corpo.acao !== "criar") return NextResponse.json(leitura, { headers: { "Cache-Control": "no-store" } });

  if (c.momento !== "criar-senha" || !c.userId) return NextResponse.json(leitura, { status: 409 });

  const recusa = conferirSenhaNova(corpo.senha, corpo.confirmacao);
  if (recusa) {
    const frases = {
      curta: "A senha precisa de ao menos 12 caracteres.",
      longa: "A senha passou do tamanho máximo.",
      diferentes: "As duas senhas não são iguais.",
    } as const;
    return NextResponse.json({ ...leitura, message: frases[recusa] }, { status: 400 });
  }

  const servico = createServiceClient();
  // Senha e marca no MESMO pedido: a marca é o que faz a próxima tentativa
  // ver "já tem acesso" — a senha se cria uma vez por aqui.
  const { error } = await servico.auth.admin.updateUserById(c.userId, {
    password: corpo.senha as string,
    app_metadata: { ...c.metadados, senha_criada_na_compra: new Date().toISOString() },
  });
  if (error) {
    console.error(JSON.stringify({ level: "error", msg: "senha_na_volta_gravar_falhou", code: error.code ?? "unknown" }));
    const fraca = error.code === "weak_password";
    return NextResponse.json({
      ...leitura,
      message: fraca ? "Esta senha é fácil demais de adivinhar. Escolha outra." : "Não foi possível criar a senha. Tente de novo.",
    }, { status: fraca ? 400 : 502 });
  }

  // Idempotente: garante o perfil, como na troca da senha provisória.
  const { error: erroDaAtivacao } = await servico.rpc("ativar_login", { p_user_id: c.userId });
  if (erroDaAtivacao) {
    console.error(JSON.stringify({ level: "error", msg: "senha_na_volta_ativacao_falhou", code: erroDaAtivacao.code ?? "unknown" }));
  }

  // O nome e a empresa já foram digitados no `/assinar`. Sem eles no perfil,
  // a entrada mandaria a pessoa ao cadastro para digitá-los de novo (achado no
  // teste real, 02/10/2026). Só preenche o que está vazio.
  if (c.comprador) {
    const { error: erroDoPerfil } = await servico.from("profiles")
      .update({ full_name: c.comprador, ...(c.empresa ? { company: c.empresa } : {}) })
      .eq("id", c.userId).or("full_name.is.null,full_name.eq.");
    if (erroDoPerfil) {
      console.error(JSON.stringify({ level: "error", msg: "senha_na_volta_perfil_falhou", code: erroDoPerfil.code ?? "unknown" }));
    }
  }

  const resposta = NextResponse.json(
    { momento: "ja-tem-acesso", email: c.email, destino: DESTINO_PADRAO },
    { headers: { "Cache-Control": "no-store" } },
  );
  // A prova cumpriu o papel: sai do navegador.
  resposta.cookies.set(COOKIE_DA_PROVA, "", { path: CAMINHO_DO_COOKIE, maxAge: 0 });
  return resposta;
}
