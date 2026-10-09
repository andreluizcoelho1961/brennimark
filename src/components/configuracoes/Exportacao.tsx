"use client";

import { useEffect, useRef, useState } from "react";
import { useIsEnglish } from "@/platform/locale-client";
import { comAlvo, useAlvo } from "@/platform/alvo-client";
import type { PedidoDeExportacao } from "@/lib/cobranca/exportacao";
import { nomeDoZip, pacoteDaMarca, type Manifesto } from "@/lib/cobranca/pacote-da-exportacao";
import { montarZipDaMarca } from "@/lib/cobranca/exportar-no-navegador";
import { salvarArquivo } from "@/lib/assets/zip-no-navegador";

const TITULO = "font-display text-sm font-black uppercase tracking-wider text-platform-text";
const BOTAO = "border border-platform-signal px-5 py-2.5 font-display text-xs font-bold uppercase tracking-wide text-platform-text transition-colors duration-150 hover:bg-platform-text hover:text-platform-bg disabled:opacity-50";
const LINK = "underline underline-offset-2 hover:text-platform-text disabled:opacity-50";

type UltimaExportacao = { iniciadaEm: string; concluidaEm: string | null } | null;
type Andamento =
  | { fase: "parada" }
  | { fase: "preparando" }
  | { fase: "baixando"; marca: string; indice: number; marcas: number; prontos: number; total: number }
  | { fase: "pronta"; zips: number; faltaram: number };

/**
 * Configurações › Plano › Exportação — Termos, seção 13: "os arquivos
 * originais e um índice do conteúdo".
 *
 * Via principal (08/10/2026, decisão do André): a dona clica em Exportar, e o
 * navegador dela busca os originais e salva um ZIP por marca. Se fechar a aba
 * no meio, recomeça. Via de reserva: o pedido, que a equipe entrega à mão em
 * até 15 dias — para quem não conseguir pelo navegador.
 */
export function Exportacao() {
  const alvo = useAlvo();
  const isEnglish = useIsEnglish();
  const t = (en: string, pt: string) => (isEnglish ? en : pt);
  const [pedido, setPedido] = useState<PedidoDeExportacao | undefined>(undefined);
  const [ultima, setUltima] = useState<UltimaExportacao>(null);
  const [enviando, setEnviando] = useState(false);
  const [andamento, setAndamento] = useState<Andamento>({ fase: "parada" });
  const [erro, setErro] = useState("");
  const cancelar = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const r = await fetch(comAlvo("/api/configuracoes/exportacao", alvo), { cache: "no-store" }).catch(() => null);
      const corpo = r ? await r.json().catch(() => ({})) : {};
      if (cancelado) return;
      setPedido(r?.ok ? (corpo.pedido ?? null) : null);
      setUltima(r?.ok ? (corpo.ultimaExportacao ?? null) : null);
    })();
    return () => { cancelado = true; };
  }, [alvo]);

  // Sair da tela interrompe as buscas em andamento.
  useEffect(() => () => cancelar.current?.abort(), []);

  async function exportar() {
    setErro("");
    setAndamento({ fase: "preparando" });
    const controle = new AbortController();
    cancelar.current = controle;
    try {
      const r = await fetch(comAlvo("/api/configuracoes/exportacao/iniciar", alvo), { method: "POST", signal: controle.signal });
      const corpo = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(corpo.message ?? t("Couldn't start the export.", "Não foi possível começar a exportação."));
      const manifesto = corpo.manifesto as Manifesto;
      setUltima({ iniciadaEm: manifesto.iniciada_em, concluidaEm: null });
      if (manifesto.marcas.length === 0) throw new Error(t("This account has no brands to export.", "Esta conta não tem marcas para exportar."));

      const pedirEnderecos = async (chaves: string[]) => {
        const resposta = await fetch(comAlvo("/api/configuracoes/exportacao/enderecos", alvo), {
          method: "POST", signal: controle.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ exportacao: manifesto.id, chaves }),
        });
        const dados = await resposta.json().catch(() => ({}));
        if (!resposta.ok) throw new Error(dados.message ?? t("Couldn't prepare the files.", "Não foi possível preparar os arquivos."));
        return (dados.enderecos ?? {}) as Record<string, string>;
      };

      let faltaram = 0;
      for (const [i, marca] of manifesto.marcas.entries()) {
        const entradas = pacoteDaMarca(marca, manifesto.conta, manifesto.iniciada_em);
        setAndamento({ fase: "baixando", marca: marca.nome, indice: i + 1, marcas: manifesto.marcas.length, prontos: 0, total: marca.arquivos.length });
        const resultado = await montarZipDaMarca(entradas, pedirEnderecos, (prontos, total) =>
          setAndamento({ fase: "baixando", marca: marca.nome, indice: i + 1, marcas: manifesto.marcas.length, prontos, total }),
        controle.signal);
        salvarArquivo(resultado.blob, nomeDoZip(marca, manifesto.iniciada_em));
        faltaram += resultado.faltaram.length;
      }

      // Só a exportação completa é anotada como concluída.
      if (faltaram === 0) {
        await fetch(comAlvo("/api/configuracoes/exportacao/concluir", alvo), {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ exportacao: manifesto.id }),
        }).catch(() => null);
        setUltima({ iniciadaEm: manifesto.iniciada_em, concluidaEm: new Date().toISOString() });
      }
      setAndamento({ fase: "pronta", zips: manifesto.marcas.length, faltaram });
    } catch (e) {
      if (controle.signal.aborted) return;
      setAndamento({ fase: "parada" });
      setErro(e instanceof Error ? e.message : t("The export stopped. Try again.", "A exportação parou. Tente de novo."));
    }
  }

  async function pedir() {
    setEnviando(true);
    setErro("");
    const r = await fetch(comAlvo("/api/configuracoes/exportacao", alvo), { method: "POST" }).catch(() => null);
    const corpo = r ? await r.json().catch(() => ({})) : {};
    setEnviando(false);
    if (r?.ok) setPedido(corpo.pedido ?? null);
    else setErro(corpo.message ?? t("Couldn't send the request.", "Não foi possível enviar o pedido."));
  }

  const data = (iso: string) => new Intl.DateTimeFormat(isEnglish ? "en-US" : "pt-BR", { dateStyle: "long" }).format(new Date(iso));
  const aberto = pedido && !pedido.entregueEm;
  const ocupado = andamento.fase === "preparando" || andamento.fase === "baixando";

  return (
    <section aria-labelledby="titulo-da-exportacao" data-exportacao>
      <h2 id="titulo-da-exportacao" className={TITULO}>{t("Export", "Exportação")}</h2>
      <p className="mt-2 max-w-[40rem] text-sm text-platform-text-muted">
        {t("A copy of everything that is yours: the original files of each brand and an index of the content. Your browser saves one .zip file per brand; keep this tab open until it finishes.",
           "Uma cópia de tudo o que é seu: os arquivos originais de cada marca e um índice do conteúdo. O navegador salva um arquivo .zip por marca; deixe esta aba aberta até terminar.")}
      </p>

      <button type="button" data-exportar onClick={exportar} disabled={ocupado} className={`${BOTAO} mt-4`}>
        {ocupado ? t("Exporting…", "Exportando…") : t("Export everything", "Exportar tudo")}
      </button>

      <div aria-live="polite" className="mt-3 text-sm">
        {andamento.fase === "preparando" && (
          <p data-exportacao-andamento className="text-platform-text-muted">{t("Preparing the list of files…", "Preparando a lista de arquivos…")}</p>
        )}
        {andamento.fase === "baixando" && (
          <p data-exportacao-andamento className="text-platform-text-muted">
            {andamento.marcas > 1 ? t(`Brand ${andamento.indice} of ${andamento.marcas}, `, `Marca ${andamento.indice} de ${andamento.marcas}, `) : ""}
            {andamento.marca}: {t(`${andamento.prontos} of ${andamento.total} files`, `${andamento.prontos} de ${andamento.total} arquivos`)}
          </p>
        )}
        {andamento.fase === "pronta" && (
          <p data-exportacao-pronta role="status" className="border-l-2 border-platform-text pl-3 font-bold text-platform-text">
            {andamento.faltaram === 0
              ? t(`Done: ${andamento.zips} .zip file(s) saved to your computer.`, `Pronto: ${andamento.zips} arquivo(s) .zip salvo(s) no seu computador.`)
              : t(`Saved, but ${andamento.faltaram} file(s) could not be downloaded — they are listed in FALTARAM.txt inside the .zip. Try exporting again.`,
                  `Salvo, mas ${andamento.faltaram} arquivo(s) não puderam ser baixados — a lista está em FALTARAM.txt, dentro do .zip. Tente exportar de novo.`)}
          </p>
        )}
        {andamento.fase !== "pronta" && ultima && (
          <p data-exportacao-ultima className="text-platform-text-muted">
            {ultima.concluidaEm
              ? t(`Last export: ${data(ultima.concluidaEm)}.`, `Última exportação: ${data(ultima.concluidaEm)}.`)
              : t(`Last export started on ${data(ultima.iniciadaEm)}.`, `Última exportação iniciada em ${data(ultima.iniciadaEm)}.`)}
          </p>
        )}
      </div>

      {erro && <p role="alert" className="mt-3 text-sm text-platform-text">{erro}</p>}

      {/* A via de reserva: entregue à mão em até 15 dias. */}
      <div className="mt-5 text-sm text-platform-text-muted">
        {aberto ? (
          <p data-exportacao-pedida role="status">
            {t(`Export requested on ${data(pedido.pedidoEm)}. We will deliver by ${data(pedido.prazo)}.`,
               `Exportação pedida em ${data(pedido.pedidoEm)}. Entregamos até ${data(pedido.prazo)}.`)}
          </p>
        ) : (
          <p>
            {pedido?.entregueEm && (
              <span data-exportacao-entregue className="block">
                {t(`The last requested export was delivered on ${data(pedido.entregueEm)}.`, `A última exportação pedida foi entregue em ${data(pedido.entregueEm)}.`)}
              </span>
            )}
            {t("Couldn't export? ", "Não conseguiu exportar? ")}
            <button type="button" data-pedir-exportacao onClick={pedir} disabled={enviando || pedido === undefined} className={LINK}>
              {enviando ? t("Sending…", "Enviando…") : t("Request the export", "Peça a exportação")}
            </button>
            {t(" and we will deliver it within 15 days.", " e entregamos em até 15 dias.")}
          </p>
        )}
      </div>
    </section>
  );
}
