"use client";

import { useCallback, useEffect, useState } from "react";
import { localeDeFormato } from "@/platform/locale";
import { useIsEnglish } from "@/platform/locale-client";
import { comAlvo, useAlvo } from "@/platform/alvo-client";
import { TERMO } from "@/lib/ia-propria/termo";

/**
 * Configurações › IA (ADR-0009, 07/11/2026) — só existe em conta de plano "traga
 * a sua IA". A agência cadastra até três chaves: o texto (responde e lê o
 * manual), a imagem (interpreta as peças) e a reserva (assume se a principal
 * falhar). Se nenhuma funcionar, o Vini avisa e para: não existe IA da
 * Brennimark por baixo.
 *
 * A chave é digitada UMA vez, vai ao servidor e nunca volta: a tela só sabe
 * "termina em ••••1234". Para mudar, cadastra-se outra no lugar.
 */
type Encaixe = "texto" | "imagem" | "reserva";
const ENCAIXES: Encaixe[] = ["texto", "imagem", "reserva"];

type Modelo = { model: string; label: string; vision: boolean; gratuito: boolean };
type Provedor = { value: string; label: string; modelos: Modelo[] };
type Chave = { encaixe: Encaixe; provedor: string; modelo: string; chaveFinal: string; atualizadaEm: string; testadaEm: string | null; testeOk: boolean | null };
type Dados = {
  modo: "propria";
  termo: { aceito: boolean; vigente: boolean; versao: string | null; em: string | null };
  chaves: Chave[];
  provedores: Provedor[];
};

const TITULO = "font-display text-sm font-black uppercase tracking-wider text-platform-text";
const DT = "text-[11px] uppercase tracking-wide text-platform-text-muted";
const CAMPO = "border border-platform-border bg-platform-bg px-3 py-2 text-sm text-platform-text focus:border-platform-signal focus:outline-none";
const ROTULO = "mb-1 block text-[11px] font-bold uppercase tracking-wide text-platform-text-muted";
const BOTAO = "border border-platform-signal px-4 py-2 font-display text-xs font-bold uppercase tracking-wide text-platform-text transition-colors duration-150 hover:bg-platform-text hover:text-platform-bg disabled:opacity-50";
const BOTAO_QUIETO = "px-2 py-2 text-xs font-bold uppercase tracking-wide text-platform-text-muted hover:text-platform-text disabled:opacity-50";

export function IaDaAgencia() {
  const alvo = useAlvo();
  const isEnglish = useIsEnglish();
  const t = (en: string, pt: string) => (isEnglish ? en : pt);
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState("");
  const [aberto, setAberto] = useState<Encaixe | null>(null);
  const [removendo, setRemovendo] = useState<Encaixe | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ encaixe: Encaixe; ok: boolean; texto: string } | null>(null);
  const [aceitei, setAceitei] = useState(false);
  const [provedor, setProvedor] = useState("");
  const [modelo, setModelo] = useState("");
  const [chave, setChave] = useState("");

  // `versao` sobe quando uma ação muda o estado; o efeito relê do servidor.
  const [versao, setVersao] = useState(0);
  const carregar = useCallback(() => setVersao((v) => v + 1), []);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const resposta = await fetch(comAlvo("/api/configuracoes/ia", alvo), { cache: "no-store" }).catch(() => null);
      const corpo = resposta ? await resposta.json().catch(() => ({})) : {};
      if (cancelado) return;
      if (resposta?.ok && corpo.modo === "propria") { setDados(corpo as Dados); setErro(""); }
      else setErro(corpo.message ?? t("Couldn't load the AI settings.", "Não foi possível carregar a IA da conta."));
    })();
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alvo, versao]);

  const data = (iso: string | null) => (iso ? new Intl.DateTimeFormat(localeDeFormato(isEnglish), { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso)) : "");

  function textoDoTeste(code: string): string {
    switch (code) {
      case "invalid_key": return t("The provider refused the key. Check that it is correct and still active.", "O provedor recusou a chave. Confira se está certa e ainda ativa.");
      case "rate_limited": return t("The provider's usage limit was reached. Try again in a few minutes.", "O limite de uso do provedor foi atingido. Tente de novo em alguns minutos.");
      case "model_unavailable": return t("This model isn't available for this key.", "Este modelo não está disponível para esta chave.");
      case "overloaded": return t("The provider is overloaded right now. Try again shortly.", "O provedor está sobrecarregado agora. Tente de novo daqui a pouco.");
      case "timed_out": return t("The provider took too long to answer.", "O provedor demorou demais para responder.");
      case "chave_ilegivel": return t("The saved key can't be read anymore. Register it again.", "A chave guardada não pode mais ser lida. Cadastre-a de novo.");
      default: return t("Couldn't reach the provider.", "Não foi possível falar com o provedor.");
    }
  }

  async function testar(encaixe: Encaixe) {
    setOcupado(`testar-${encaixe}`);
    const resposta = await fetch(comAlvo("/api/configuracoes/ia/testar", alvo), {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ encaixe }),
    }).catch(() => null);
    const corpo = resposta ? await resposta.json().catch(() => ({})) : {};
    setOcupado(null);
    setAviso({
      encaixe,
      ok: corpo.ok === true,
      texto: corpo.ok === true ? t("Connection works.", "A conexão funciona.") : textoDoTeste(corpo.code ?? "unknown"),
    });
    carregar();
  }

  async function aceitarTermo() {
    setOcupado("termo");
    const resposta = await fetch(comAlvo("/api/configuracoes/ia/termo", alvo), { method: "POST" }).catch(() => null);
    setOcupado(null);
    if (resposta?.ok) { setAceitei(false); carregar(); }
    else setErro(t("Couldn't register the acceptance. Try again.", "Não foi possível registrar o aceite. Tente de novo."));
  }

  function abrirFormulario(encaixe: Encaixe) {
    setAberto(encaixe); setRemovendo(null); setAviso(null); setErro("");
    setProvedor(""); setModelo(""); setChave("");
  }

  async function salvar(encaixe: Encaixe) {
    setOcupado(`salvar-${encaixe}`); setErro(""); setAviso(null);
    const resposta = await fetch(comAlvo("/api/configuracoes/ia/chave", alvo), {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ encaixe, provedor, modelo, chave }),
    }).catch(() => null);
    const corpo = resposta ? await resposta.json().catch(() => ({})) : {};
    // Em qualquer desfecho a chave sai da memória da tela.
    setChave("");
    if (!resposta?.ok) {
      setOcupado(null);
      const mensagens: Record<string, string> = {
        chave_invalida: t("That doesn't look like an API key: it should be one line, without spaces. Keys are shown only once by the provider; if you no longer have it, create a new one.", "Isto não parece uma chave de API: deve ser uma linha só, sem espaços. O provedor mostra a chave só uma vez; se você não a tem mais, crie outra."),
        modelo_invalido: t("Choose a model from the list.", "Escolha um modelo da lista."),
        modelo_sem_visao: t("The image slot needs a model that accepts images.", "O encaixe de imagem precisa de um modelo que aceite imagens."),
        termo_pendente: t("Accept the terms first.", "Aceite o termo antes."),
        servidor_sem_cofre: t("Keys can't be stored right now. Contact Brennimark.", "As chaves não podem ser guardadas agora. Fale com a Brennimark."),
      };
      setErro(mensagens[corpo.error] ?? t("Couldn't save the key.", "Não foi possível guardar a chave."));
      return;
    }
    setAberto(null);
    carregar();
    setOcupado(null);
    await testar(encaixe);
  }

  async function remover(encaixe: Encaixe) {
    setOcupado(`remover-${encaixe}`);
    const resposta = await fetch(comAlvo(`/api/configuracoes/ia/chave?encaixe=${encaixe}`, alvo), { method: "DELETE" }).catch(() => null);
    setOcupado(null); setRemovendo(null);
    if (!resposta?.ok) setErro(t("Couldn't remove the key.", "Não foi possível remover a chave."));
    carregar();
  }

  if (erro && !dados) return <p role="alert" className="text-sm text-platform-text">{erro}</p>;
  if (!dados) return <p className="text-sm text-platform-text-muted">{t("Loading…", "Carregando…")}</p>;

  const termo = isEnglish ? TERMO.en : TERMO.pt;
  const nomeDoEncaixe: Record<Encaixe, { titulo: string; ajuda: string }> = {
    texto: { titulo: t("Text", "Texto"), ajuda: t("Answers questions and reads the manual.", "Responde perguntas e lê o manual.") },
    imagem: { titulo: t("Image", "Imagem"), ajuda: t("Reviews pieces. Needs a model that accepts images.", "Confere peças. Precisa de um modelo que aceite imagens.") },
    reserva: { titulo: t("Backup", "Reserva"), ajuda: t("Takes over if the main one fails. Can be another provider.", "Assume se a principal falhar. Pode ser de outro provedor.") },
  };

  return (
    <div data-ia-da-agencia className="space-y-8">
      <p className="max-w-[46rem] text-sm text-platform-text-muted">
        {t("On this plan, Vini runs on the AI keys your agency already pays for. If a key fails, Vini says so and stops — it never switches to another AI.",
           "Neste plano, o Vini usa as chaves de IA que a sua agência já paga. Se uma chave falhar, o Vini avisa e para: ele nunca troca para outra IA por conta própria.")}
      </p>

      <p data-aviso-ia-gratuita role="note" className="max-w-[46rem] border-l-2 border-platform-text pl-3 text-sm text-platform-text">
        {t("Avoid free AI plans. Free providers may use what is sent to them, including your clients' manuals, to train models. We recommend paid plans with a no-training clause.",
           "Evite planos gratuitos de IA. Provedores gratuitos podem usar o que recebem, inclusive os manuais dos seus clientes, para treinar modelos. Recomendamos planos pagos, com cláusula de não treinamento.")}
      </p>

      {!dados.termo.vigente && (
        <section data-termo aria-labelledby="titulo-do-termo" className="max-w-[46rem]">
          <h2 id="titulo-do-termo" className={TITULO}>{termo.titulo}</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-platform-text-muted">
            {termo.itens.map((item) => <li key={item}>{item}</li>)}
          </ol>
          <label className="mt-4 flex items-start gap-2 text-sm text-platform-text">
            <input type="checkbox" data-aceito checked={aceitei} onChange={(e) => setAceitei(e.target.checked)} className="mt-1" />
            <span>{termo.aceite}</span>
          </label>
          <button type="button" data-aceitar-termo disabled={!aceitei || ocupado === "termo"} onClick={aceitarTermo} className={`${BOTAO} mt-4`}>
            {ocupado === "termo" ? t("Saving…", "Salvando…") : t("Accept and continue", "Aceitar e continuar")}
          </button>
        </section>
      )}

      {dados.termo.vigente && (
        <section aria-labelledby="titulo-das-chaves">
          <h2 id="titulo-das-chaves" className={TITULO}>{t("Keys", "Chaves")}</h2>
          <p className="mt-2 text-xs text-platform-text-muted">
            {t(`Terms accepted on ${data(dados.termo.em)}.`, `Termo aceito em ${data(dados.termo.em)}.`)}
          </p>
          <ul className="mt-4 space-y-4">
            {ENCAIXES.map((encaixe) => {
              const atual = dados.chaves.find((c) => c.encaixe === encaixe);
              const provedorEscolhido = dados.provedores.find((p) => p.value === provedor);
              const modelos = (provedorEscolhido?.modelos ?? []).filter((m) => encaixe !== "imagem" || m.vision);
              const modeloEscolhido = modelos.find((m) => m.model === modelo);
              const rotuloDoAtual = atual
                ? `${dados.provedores.find((p) => p.value === atual.provedor)?.label ?? atual.provedor} · ${dados.provedores.flatMap((p) => p.modelos).find((m) => m.model === atual.modelo)?.label ?? atual.modelo}`
                : "";
              return (
                <li key={encaixe} data-encaixe={encaixe} className="border border-platform-border p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <h3 className="font-display text-sm font-black uppercase tracking-wide text-platform-text">{nomeDoEncaixe[encaixe].titulo}</h3>
                      <p className="mt-1 text-xs text-platform-text-muted">{nomeDoEncaixe[encaixe].ajuda}</p>
                    </div>
                    {atual && (
                      <p data-teste className="text-xs text-platform-text-muted">
                        {atual.testeOk === true && t(`Tested ${data(atual.testadaEm)}: works`, `Testada em ${data(atual.testadaEm)}: funciona`)}
                        {atual.testeOk === false && t(`Tested ${data(atual.testadaEm)}: failed`, `Testada em ${data(atual.testadaEm)}: falhou`)}
                        {atual.testeOk === null && t("Not tested yet", "Ainda não testada")}
                      </p>
                    )}
                  </div>

                  {atual ? (
                    <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                      <div><dt className={DT}>{t("Model", "Modelo")}</dt><dd className="font-bold text-platform-text">{rotuloDoAtual}</dd></div>
                      <div><dt className={DT}>{t("Key", "Chave")}</dt><dd data-chave-final className="font-bold tabular-nums text-platform-text">{t("ends in", "termina em")} ••••{atual.chaveFinal}</dd></div>
                    </dl>
                  ) : (
                    <p className="mt-3 text-sm text-platform-text-muted">{t("Not set up.", "Não configurada.")}</p>
                  )}

                  {aviso?.encaixe === encaixe && (
                    <p data-resultado-do-teste role="status" className={`mt-3 text-sm ${aviso.ok ? "text-platform-text" : "font-bold text-platform-text"}`}>{aviso.texto}</p>
                  )}

                  {aberto === encaixe ? (
                    <form className="mt-4 grid max-w-[34rem] gap-3" onSubmit={(e) => { e.preventDefault(); void salvar(encaixe); }} autoComplete="off">
                      <div>
                        <label className={ROTULO} htmlFor={`provedor-${encaixe}`}>{t("Provider", "Provedor")}</label>
                        <select id={`provedor-${encaixe}`} className={`${CAMPO} w-full`} value={provedor} onChange={(e) => { setProvedor(e.target.value); setModelo(""); }} required>
                          <option value="">{t("Choose…", "Escolha…")}</option>
                          {dados.provedores.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={ROTULO} htmlFor={`modelo-${encaixe}`}>{t("Model", "Modelo")}</label>
                        <select id={`modelo-${encaixe}`} className={`${CAMPO} w-full`} value={modelo} onChange={(e) => setModelo(e.target.value)} required disabled={!provedor}>
                          <option value="">{t("Choose…", "Escolha…")}</option>
                          {modelos.map((m) => <option key={m.model} value={m.model}>{m.label}{m.gratuito ? ` (${t("free", "gratuito")})` : ""}</option>)}
                        </select>
                      </div>
                      {modeloEscolhido?.gratuito && (
                        <p data-aviso-modelo-gratuito role="note" className="border-l-2 border-platform-text pl-3 text-sm text-platform-text">
                          {t("This is a free model: the content sent to it may be used for training.", "Este é um modelo gratuito: o conteúdo enviado a ele pode ser usado para treinamento.")}
                        </p>
                      )}
                      <div>
                        <label className={ROTULO} htmlFor={`chave-${encaixe}`}>{t("API key", "Chave de API")}</label>
                        {/* Só colar: sem preenchimento do navegador, e sem mostrar depois. */}
                        <input id={`chave-${encaixe}`} type="password" className={`${CAMPO} w-full`} value={chave} onChange={(e) => setChave(e.target.value)}
                          autoComplete="new-password" spellCheck={false} required />
                        <p className="mt-1 text-xs text-platform-text-muted">{t("It is stored encrypted and never shown again.", "Fica guardada cifrada e não aparece de novo.")}</p>
                      </div>
                      {/* O erro aparece AQUI, perto do botão: no fim da página ele ficava fora da tela. */}
                      {erro && <p data-erro-do-formulario role="alert" className="border-l-2 border-platform-text pl-3 text-sm font-bold text-platform-text">{erro}</p>}
                      <div className="flex gap-2">
                        <button type="submit" data-salvar-chave disabled={ocupado !== null || !provedor || !modelo || chave.length === 0} className={BOTAO}>
                          {ocupado === `salvar-${encaixe}` ? t("Saving…", "Salvando…") : t("Save and test", "Salvar e testar")}
                        </button>
                        <button type="button" className={BOTAO_QUIETO} onClick={() => { setAberto(null); setChave(""); }}>{t("Cancel", "Cancelar")}</button>
                      </div>
                    </form>
                  ) : (
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <button type="button" data-cadastrar={encaixe} className={BOTAO} disabled={ocupado !== null} onClick={() => abrirFormulario(encaixe)}>
                        {atual ? t("Replace key", "Substituir chave") : t("Set up", "Cadastrar")}
                      </button>
                      {atual && (
                        <button type="button" data-testar={encaixe} className={BOTAO_QUIETO} disabled={ocupado !== null} onClick={() => testar(encaixe)}>
                          {ocupado === `testar-${encaixe}` ? t("Testing…", "Testando…") : t("Test connection", "Testar conexão")}
                        </button>
                      )}
                      {atual && removendo !== encaixe && (
                        <button type="button" className={BOTAO_QUIETO} disabled={ocupado !== null} onClick={() => setRemovendo(encaixe)}>{t("Remove", "Remover")}</button>
                      )}
                      {atual && removendo === encaixe && (
                        <span className="flex items-center gap-2 text-sm text-platform-text">
                          {t("Remove this key? Vini stops using this slot.", "Remover esta chave? O Vini deixa de usar este encaixe.")}
                          <button type="button" data-confirmar-remocao className={BOTAO} disabled={ocupado !== null} onClick={() => remover(encaixe)}>{t("Remove", "Remover")}</button>
                          <button type="button" className={BOTAO_QUIETO} onClick={() => setRemovendo(null)}>{t("Cancel", "Cancelar")}</button>
                        </span>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {erro && aberto === null && <p role="alert" className="text-sm text-platform-text">{erro}</p>}
    </div>
  );
}
