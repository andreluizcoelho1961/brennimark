"use client";

import { useEffect, useRef, useState } from "react";
import { comAlvo, useAlvo } from "@/platform/alvo-client";
import { useIsEnglish } from "@/platform/locale-client";
import type { StructuredAnalysis } from "@/lib/ai/analysis-result";
import { decodificarMapa, codificarMapa, type MapaDePaginas } from "@/lib/ai/paginas-citadas";
import { conferirPeca, textoDaRecusa } from "@/lib/ai/peca";

/**
 * A análise de uma peça, dentro do Vini — fatia 4b.
 *
 * O mesmo pedido da tela antiga de análise (`/api/ai/analyze`, resposta em
 * NDJSON: eventos de progresso e um de conclusão), agora dirigido pela janela.
 * A regra de peça aceita vem de `lib/ai/peca.ts` — a mesma que o servidor
 * aplica —, e a recusa diz qual limite barrou.
 *
 * ⚖️ A peça é material sensível (campanha antes do ar). Ela sai daqui só
 * para a rota da análise, que já aplica acesso por marca e grava o histórico;
 * nada vai para o armazenamento do navegador.
 */
export type EtapaDaAnalise = "preparing" | "consulting" | "fallback" | "verifying";

export type Peca = { nome: string; dataUrl: string; tipo: string; tamanho: number };

export type ResultadoDaAnalise = {
  analise: StructuredAnalysis;
  paginas: MapaDePaginas;
  demonstracao: boolean;
  salvaNoHistorico: boolean;
};

type Evento =
  | { type: "progress"; stage: EtapaDaAnalise; message: string }
  | { type: "complete"; analysis: StructuredAnalysis; isDemo: boolean; historySaved: boolean; paginas?: MapaDePaginas }
  | { type: "error"; message: string };

function lerComoDataUrl(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(leitor.result as string);
    leitor.onerror = () => reject(leitor.error);
    leitor.readAsDataURL(arquivo);
  });
}

export function useAnaliseDaPeca() {
  const alvo = useAlvo();
  const isEnglish = useIsEnglish();
  const [peca, setPeca] = useState<Peca | null>(null);
  const [etapa, setEtapa] = useState<EtapaDaAnalise | null>(null);
  const [mensagem, setMensagem] = useState("");
  const [resultado, setResultado] = useState<ResultadoDaAnalise | null>(null);
  const [erro, setErro] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  /** Escolher a peça confere o arquivo; não analisa ainda — a pessoa pode
   *  escrever uma pergunta antes. Devolve se a peça foi aceita. */
  async function escolher(arquivo: File): Promise<boolean> {
    setErro("");
    const recusa = conferirPeca(arquivo);
    if (recusa) {
      setErro(textoDaRecusa(recusa, arquivo, isEnglish));
      return false;
    }
    const dataUrl = await lerComoDataUrl(arquivo);
    abortRef.current?.abort();
    setPeca({ nome: arquivo.name, dataUrl, tipo: arquivo.type, tamanho: arquivo.size });
    setResultado(null);
    setEtapa(null);
    return true;
  }

  async function analisar(pergunta: string) {
    if (!peca || etapa) return;
    const controle = new AbortController();
    abortRef.current = controle;
    setErro("");
    setResultado(null);
    setEtapa("preparing");
    setMensagem(isEnglish ? "Preparing the image and brand guidelines…" : "Preparando a imagem e as diretrizes da marca…");

    try {
      const resposta = await fetch(comAlvo("/api/ai/analyze", alvo), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: peca.dataUrl, fileName: peca.nome, question: pergunta.trim() || undefined }),
        signal: controle.signal,
      });
      const tipo = resposta.headers.get("content-type") ?? "";
      if (!resposta.ok || !tipo.includes("application/x-ndjson") || !resposta.body) {
        const dados = await resposta.json().catch(() => ({}));
        throw new Error(dados.message ?? (isEnglish ? "Couldn't analyze the piece." : "Não foi possível analisar a peça."));
      }

      const leitor = resposta.body.getReader();
      const decodificador = new TextDecoder();
      let resto = "";
      const tratar = (linha: string) => {
        if (!linha.trim()) return;
        const evento = JSON.parse(linha) as Evento;
        if (evento.type === "progress") {
          setEtapa(evento.stage);
          setMensagem(evento.message);
        } else if (evento.type === "error") {
          throw new Error(evento.message);
        } else {
          setResultado({
            analise: evento.analysis,
            // Passa pelo mesmo filtro do cabeçalho do chat: página inválida some.
            paginas: decodificarMapa(codificarMapa(evento.paginas ?? {})),
            demonstracao: Boolean(evento.isDemo),
            salvaNoHistorico: Boolean(evento.historySaved),
          });
        }
      };
      while (true) {
        const { value, done } = await leitor.read();
        resto += decodificador.decode(value, { stream: !done });
        const linhas = resto.split("\n");
        resto = linhas.pop() ?? "";
        linhas.forEach(tratar);
        if (done) break;
      }
      tratar(resto);
    } catch (caught) {
      if (!controle.signal.aborted) {
        setErro(caught instanceof Error ? caught.message : (isEnglish ? "Network failure while analyzing the piece." : "Falha de rede ao analisar a peça."));
      }
    } finally {
      abortRef.current = null;
      setEtapa(null);
    }
  }

  return {
    peca,
    etapa,
    mensagem,
    resultado,
    erro,
    analisando: etapa !== null,
    escolher,
    analisar,
    descartar() {
      abortRef.current?.abort();
      setPeca(null);
      setResultado(null);
      setErro("");
      setEtapa(null);
    },
  };
}
