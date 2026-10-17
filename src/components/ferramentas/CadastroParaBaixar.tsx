"use client";

import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  CARGOS, COMO_CONHECEU, COOKIE_DO_CADASTRO, EQUIPES, MARCAS, TEXTO_DO_ACEITE, type Origem,
} from "@/lib/cadastro/cadastro";

/**
 * O cadastro na hora de baixar (17/10/2026), nas ferramentas gratuitas.
 *
 * Decisão do André: a pessoa usa a ferramenta à vontade, e só quando vai levar
 * o arquivo deixa e-mail, nome e algumas respostas. Uma vez por aparelho: o
 * servidor marca um cookie, e a trava some. As regras de gravação estão em
 * `/api/cadastro` e no banco; aqui é só a tela e o momento de pedir.
 *
 * Duas escolhas de comportamento, ambas de propósito:
 *   - recusa de CAMPO (400) mostra a mensagem e mantém a pessoa no formulário;
 *   - falha do SERVIDOR (5xx, rede) NÃO trava o download: um problema nosso não
 *     pode impedir quem veio usar a ferramenta. O log do servidor diz o que
 *     aconteceu, e a pessoa é perguntada de novo da próxima vez.
 *
 * O cookie é só uma lembrança ("já me cadastrei") e não dá acesso a nada. As
 * ferramentas rodam inteiras no navegador, então este portão é de cadastro, não
 * de segurança — quem a quiser contornar contorna, e a lista é só de marketing.
 */

function jaCadastrado(): boolean {
  try {
    return document.cookie.split("; ").some((c) => c === `${COOKIE_DO_CADASTRO}=1`);
  } catch {
    return false;
  }
}

/**
 * `pedir(acao)` roda a ação na hora, se a pessoa já se cadastrou (ou se a trava
 * está desligada, como no assinante); senão abre o formulário e roda a ação
 * quando o cadastro for enviado. `dialogo` vai uma vez na árvore da ferramenta.
 */
export function useCadastroParaBaixar(origem: Origem, { ativo = true }: { ativo?: boolean } = {}): { pedir: (acao: () => void) => void; dialogo: ReactNode } {
  const [aberto, setAberto] = useState(false);
  const pendente = useRef<(() => void) | null>(null);

  const pedir = useCallback((acao: () => void) => {
    if (!ativo || jaCadastrado()) { acao(); return; }
    pendente.current = acao;
    setAberto(true);
  }, [ativo]);

  const concluir = useCallback(() => {
    const acao = pendente.current;
    pendente.current = null;
    setAberto(false);
    acao?.();
  }, []);

  const fechar = useCallback(() => {
    pendente.current = null;
    setAberto(false);
  }, []);

  return { pedir, dialogo: aberto ? <FormularioDeCadastro origem={origem} aoConcluir={concluir} aoFechar={fechar} /> : null };
}

const CAMPO = "w-full rounded-[var(--radius-control)] border border-platform-border bg-platform-panel px-3 py-2 text-sm text-platform-text";
const ROTULO = "mb-1 block font-mono text-[11px] uppercase tracking-[0.08em] text-platform-text-muted";

function Seletor({ id, rotulo, valor, aoMudar, opcoes }: { id: string; rotulo: string; valor: string; aoMudar: (v: string) => void; opcoes: readonly { id: string; rotulo: string }[] }) {
  return (
    <div>
      <label htmlFor={id} className={ROTULO}>{rotulo}</label>
      <select id={id} className={CAMPO} value={valor} onChange={(e) => aoMudar(e.target.value)}>
        <option value="">Prefiro não dizer</option>
        {opcoes.map((o) => <option key={o.id} value={o.id}>{o.rotulo}</option>)}
      </select>
    </div>
  );
}

function FormularioDeCadastro({ origem, aoConcluir, aoFechar }: { origem: Origem; aoConcluir: () => void; aoFechar: () => void }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const base = useId();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [agencia, setAgencia] = useState("");
  const [cargo, setCargo] = useState("");
  const [equipe, setEquipe] = useState("");
  const [marcas, setMarcas] = useState("");
  const [comoConheceu, setComoConheceu] = useState("");
  const [aceite, setAceite] = useState(false);
  const [website, setWebsite] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    const d = dialogo.current;
    if (d && !d.open) d.showModal();
  }, []);

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEnviando(true);
    setErro("");
    try {
      const r = await fetch("/api/cadastro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email, nome, agencia, cargo, origem, aceiteMarketing: aceite, website,
          respostas: { equipe, marcas, comoConheceu },
        }),
      });
      if (r.status >= 400 && r.status < 500) {
        const corpo = await r.json().catch(() => null) as { message?: string } | null;
        setErro(corpo?.message ?? "Confira os campos e tente de novo.");
        setEnviando(false);
        return;
      }
      // Sucesso, ou falha nossa: nos dois casos a pessoa leva o arquivo.
      aoConcluir();
    } catch {
      aoConcluir();
    }
  }

  return (
    <dialog
      ref={dialogo}
      data-cadastro
      aria-labelledby={`${base}-t`}
      onCancel={(e) => { e.preventDefault(); aoFechar(); }}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-[var(--radius-control)] border border-platform-border bg-platform-bg p-0 text-platform-text backdrop:bg-black/60"
    >
      <form onSubmit={enviar} className="flex flex-col gap-4 p-6">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-platform-text-muted">Quase lá</p>
          <h2 id={`${base}-t`} className="mt-1 text-xl font-semibold tracking-tight">Para baixar, um cadastro rápido</h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-platform-text-muted">Só uma vez. A ferramenta continua gratuita, e o seu arquivo não sai do seu computador.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={`${base}-nome`} className={ROTULO}>Nome</label>
            <input id={`${base}-nome`} data-cadastro-nome className={CAMPO} value={nome} onChange={(e) => setNome(e.target.value)} required maxLength={120} autoComplete="name" autoFocus />
          </div>
          <div>
            <label htmlFor={`${base}-email`} className={ROTULO}>E-mail</label>
            <input id={`${base}-email`} data-cadastro-email type="email" className={CAMPO} value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={254} autoComplete="email" />
          </div>
          <div>
            <label htmlFor={`${base}-agencia`} className={ROTULO}>Agência ou estúdio</label>
            <input id={`${base}-agencia`} className={CAMPO} value={agencia} onChange={(e) => setAgencia(e.target.value)} maxLength={120} autoComplete="organization" />
          </div>
          <Seletor id={`${base}-cargo`} rotulo="Cargo" valor={cargo} aoMudar={setCargo} opcoes={CARGOS} />
          <Seletor id={`${base}-equipe`} rotulo="Tamanho da equipe" valor={equipe} aoMudar={setEquipe} opcoes={EQUIPES} />
          <Seletor id={`${base}-marcas`} rotulo="Marcas que você cuida" valor={marcas} aoMudar={setMarcas} opcoes={MARCAS} />
          <div className="sm:col-span-2">
            <Seletor id={`${base}-conheceu`} rotulo="Como conheceu o Brennimark" valor={comoConheceu} aoMudar={setComoConheceu} opcoes={COMO_CONHECEU} />
          </div>
        </div>

        {/* A isca: um campo que pessoa nenhuma vê nem preenche. */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label>Site<input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label>
        </div>

        <label className="flex items-start gap-2.5 text-[13px] leading-snug text-platform-text-muted">
          <input type="checkbox" data-cadastro-aceite className="mt-0.5" checked={aceite} onChange={(e) => setAceite(e.target.checked)} />
          <span>{TEXTO_DO_ACEITE}</span>
        </label>

        {erro && <p role="alert" data-cadastro-erro className="text-sm text-platform-danger">{erro}</p>}

        <div className="flex flex-wrap items-center justify-end gap-3">
          <button type="button" data-cadastro-fechar onClick={aoFechar} className="rounded-[var(--radius-control)] border border-platform-border px-4 py-2 text-sm text-platform-text">Agora não</button>
          <button type="submit" data-cadastro-enviar disabled={enviando} className="rounded-[var(--radius-control)] bg-platform-signal px-4 py-2.5 text-sm font-semibold text-platform-bg disabled:opacity-40">
            {enviando ? "Enviando…" : "Cadastrar e baixar"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
