"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { conferirSenhaNova } from "@/lib/acesso/senha-provisoria";
import type { Momento } from "@/lib/cobranca/senha-na-volta";

/**
 * A volta do pagamento (02/10/2026): pagou, cria a senha, entra.
 *
 * Quem decide em que momento a volta está é o servidor (`/api/cobranca/senha`),
 * que confere a prova do navegador antes de dizer qualquer coisa. Esta tela só
 * pergunta, espera o webhook do Stripe abrir a conta (segundos, no cartão) e
 * mostra o gesto certo para cada momento.
 *
 * Depois de criar a senha, quem abre a sessão é o navegador, como na tela de
 * login — a rota não abre sessão nenhuma.
 */
const INTERVALO_MS = 2500;
/** Quanto tempo esperar a conta nascer antes de parar de perguntar sozinho. */
const ESPERA_MAXIMA_MS = 180_000;

type Estado = Momento | "conferindo" | "demorou" | "falhou";

export function SenhaNaVolta({ sessao }: { sessao: string | null }) {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>(sessao ? "conferindo" : "sem-prova");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const inicio = useRef(0);

  const conferir = useCallback(async (): Promise<Estado> => {
    const resposta = await fetch("/api/cobranca/senha", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessao, acao: "ver" }),
    }).catch(() => null);
    if (!resposta?.ok) return "falhou";
    const dados = await resposta.json().catch(() => ({})) as { momento?: Momento; email?: string | null };
    if (dados.email) setEmail(dados.email);
    return dados.momento ?? "falhou";
  }, [sessao]);

  useEffect(() => {
    if (!sessao) return;
    let vivo = true;
    let espera: ReturnType<typeof setTimeout> | undefined;
    inicio.current = Date.now();
    const rodada = async () => {
      const momento = await conferir();
      if (!vivo) return;
      if (momento === "aguardando") {
        if (Date.now() - inicio.current > ESPERA_MAXIMA_MS) { setEstado("demorou"); return; }
        setEstado("aguardando");
        espera = setTimeout(rodada, INTERVALO_MS);
        return;
      }
      setEstado(momento);
    };
    void rodada();
    return () => { vivo = false; if (espera) clearTimeout(espera); };
  }, [sessao, conferir]);

  async function conferirDeNovo() {
    inicio.current = Date.now();
    setEstado("conferindo");
    const momento = await conferir();
    setEstado(momento === "aguardando" ? "demorou" : momento);
  }

  async function criar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro("");
    const recusa = conferirSenhaNova(senha, confirmacao);
    if (recusa) {
      setErro(recusa === "curta" ? "A senha precisa de ao menos 12 caracteres."
        : recusa === "longa" ? "A senha passou do tamanho máximo." : "As duas senhas não são iguais.");
      return;
    }
    setEnviando(true);
    const resposta = await fetch("/api/cobranca/senha", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessao, acao: "criar", senha, confirmacao }),
    }).catch(() => null);
    const dados = await resposta?.json().catch(() => ({})) as { message?: string; momento?: Momento; destino?: string; email?: string } | undefined;
    if (!resposta?.ok || !dados?.destino) {
      setEnviando(false);
      if (resposta?.status === 409 && dados?.momento) { setEstado(dados.momento); return; }
      setErro(dados?.message ?? "Não foi possível criar a senha. Tente de novo.");
      return;
    }
    const { error } = await createClient().auth.signInWithPassword({ email: dados.email ?? email, password: senha });
    if (error) {
      // A senha foi criada; só a entrada automática falhou. O caminho é o login.
      setEnviando(false);
      setEstado("ja-tem-acesso");
      return;
    }
    router.replace(dados.destino);
    router.refresh();
  }

  const campo = "w-full border border-platform-border bg-transparent px-4 py-3 text-sm text-platform-text placeholder:text-platform-text-muted focus:border-platform-signal";
  const rotulo = "mb-1.5 block font-display text-xs font-bold uppercase tracking-wide text-platform-text-muted";
  const botao = "border border-platform-signal px-6 py-3 font-display text-xs font-bold uppercase tracking-wide text-platform-text transition-colors duration-150 hover:bg-platform-text hover:text-platform-bg disabled:opacity-50";

  const titulo: Record<Estado, string> = {
    conferindo: "Pagamento enviado",
    aguardando: "Confirmando o pagamento",
    "criar-senha": "Crie a sua senha",
    "ja-tem-acesso": "Sua conta está pronta",
    "sem-prova": "Pagamento enviado",
    expirado: "Pagamento enviado",
    demorou: "Confirmando o pagamento",
    falhou: "Pagamento enviado",
  };

  return (
    <div className="w-full max-w-md" data-volta-do-pagamento data-momento={estado}>
      <p className="font-display text-xs font-bold uppercase tracking-[0.2em] text-platform-text">Brennimark</p>
      <h1 className="mt-3 font-display text-3xl font-black uppercase leading-[0.95] text-platform-text">{titulo[estado]}</h1>

      {(estado === "conferindo" || estado === "aguardando") && (
        <p role="status" className="mt-4 text-sm leading-relaxed text-platform-text-muted">
          Estamos esperando o Stripe confirmar o pagamento e abrindo a sua conta. No cartão, isso leva alguns segundos.
          Não feche esta página.
        </p>
      )}

      {estado === "demorou" && (
        <div className="mt-4 flex flex-col gap-4">
          <p className="text-sm leading-relaxed text-platform-text-muted">
            A confirmação está demorando mais que o normal. Você pode conferir de novo daqui a pouco, nesta mesma página.
          </p>
          <button type="button" onClick={conferirDeNovo} className={`${botao} self-start`}>Conferir de novo</button>
        </div>
      )}

      {estado === "criar-senha" && (
        <form onSubmit={criar} data-form-senha-na-volta className="mt-6 flex flex-col gap-4">
          <p className="text-sm leading-relaxed text-platform-text-muted">
            Pagamento confirmado. Crie a senha com que você vai entrar no Brennimark.
          </p>
          <label>
            <span className={rotulo}>E-mail</span>
            <input type="email" value={email} readOnly autoComplete="username" className={`${campo} opacity-70`} />
          </label>
          <label>
            <span className={rotulo}>Senha</span>
            <input type="password" required autoComplete="new-password" value={senha}
              onChange={(e) => setSenha(e.target.value)} className={campo} />
          </label>
          <label>
            <span className={rotulo}>Repita a senha</span>
            <input type="password" required autoComplete="new-password" value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)} className={campo} />
          </label>
          <p className="text-[12px] text-platform-text-muted">Ao menos 12 caracteres.</p>
          <button type="submit" disabled={enviando} className={botao}>{enviando ? "…" : "Criar senha e entrar"}</button>
          {erro && <p role="alert" data-erro-da-senha className="text-xs text-platform-text-muted">{erro}</p>}
        </form>
      )}

      {estado === "ja-tem-acesso" && (
        <div className="mt-4 flex flex-col gap-4">
          <p className="text-sm leading-relaxed text-platform-text-muted">
            {email ? <>Entre com <strong className="text-platform-text">{email}</strong> e a sua senha do Brennimark.</>
              : "Entre com o seu e-mail e a sua senha do Brennimark."}
          </p>
          <Link href="/login" className={`${botao} self-start`}>Entrar</Link>
        </div>
      )}

      {(estado === "sem-prova" || estado === "expirado" || estado === "falhou") && (
        <p className="mt-4 text-sm leading-relaxed text-platform-text-muted" data-volta-sem-senha>
          {estado === "falhou"
            ? "Não conseguimos conferir a compra agora. Recarregue esta página em instantes."
            : estado === "expirado"
              ? "O prazo para criar a senha por esta página passou. Use “Esqueci a senha” na tela de entrar, com o e-mail da compra."
              : "Assim que o Stripe confirmar o pagamento, a sua conta é criada. Para criar a senha aqui, abra esta página no mesmo navegador em que fez a compra — ou use “Esqueci a senha” na tela de entrar, com o e-mail da compra."}
        </p>
      )}

      <p className="mt-8 border-t border-platform-border pt-6 text-xs text-platform-text-muted">
        Já tem acesso? <Link href="/login" className="underline">Entrar</Link>
      </p>
    </div>
  );
}
