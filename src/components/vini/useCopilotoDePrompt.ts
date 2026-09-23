"use client";

import { useEffect, useRef, useState } from "react";
import { comAlvo, useAlvo } from "@/platform/alvo-client";
import { useIsEnglish } from "@/platform/locale-client";
import { CABECALHO_DE_REGRAS, lerCabecalhoDeRegras, type RegraResumida, type TipoDePrompt } from "@/lib/ai/copiloto";
import { CABECALHO_DE_PAGINAS, decodificarMapa, type MapaDePaginas } from "@/lib/ai/paginas-citadas";
import { avisoDeInterrupcao, separarFim } from "@/lib/ai/fim-da-resposta";

/**
 * O copiloto de criação dentro do Vini — fatia 4c.
 *
 * Duas etapas, e é de propósito (ADR-0004 §3.2): primeiro a pessoa VÊ as
 * regras que governam a peça — aprovadas entram sozinhas, rascunhos só se ela
 * marcar —, depois gera. Mudar a descrição ou o tipo apaga a lista: as regras
 * eram da pergunta anterior, e gerar com elas seria gerar sobre outra coisa.
 */
export type RegrasDoPrompt = { aprovadas: RegraResumida[]; rascunhos: RegraResumida[] };

export function useCopilotoDePrompt(obterConversa?: () => string) {
  const alvo = useAlvo();
  const isEnglish = useIsEnglish();
  const [descricao, setDescricaoCrua] = useState("");
  const [tipo, setTipoCru] = useState<TipoDePrompt>("imagem");
  const [regras, setRegras] = useState<RegrasDoPrompt | null>(null);
  const [marcados, setMarcados] = useState<string[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [usadas, setUsadas] = useState<RegraResumida[]>([]);
  const [paginas, setPaginas] = useState<MapaDePaginas>({});
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const reiniciar = () => {
    setRegras(null);
    setMarcados([]);
    setPrompt("");
    setUsadas([]);
    setErro("");
    setAviso("");
  };

  async function pedir(corpo: Record<string, unknown>, controle?: AbortController) {
    return fetch(comAlvo("/api/ai/prompt", alvo), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ descricao, tipo, conversaId: obterConversa?.(), ...corpo }),
      signal: controle?.signal,
    });
  }

  async function verRegras() {
    if (!descricao.trim() || buscando) return;
    setBuscando(true);
    reiniciar();
    try {
      const resposta = await pedir({ etapa: "regras" });
      const dados = await resposta.json().catch(() => ({}));
      if (!resposta.ok) throw new Error(dados.message);
      setRegras({ aprovadas: dados.aprovadas ?? [], rascunhos: dados.rascunhos ?? [] });
    } catch (caught) {
      setErro(caught instanceof Error && caught.message ? caught.message
        : isEnglish ? "Couldn't consult the manual." : "Não foi possível consultar o manual.");
    } finally {
      setBuscando(false);
    }
  }

  async function gerar() {
    if (!regras || gerando) return;
    const controle = new AbortController();
    abortRef.current = controle;
    setGerando(true);
    setPrompt("");
    setErro("");
    setAviso("");
    try {
      const resposta = await pedir({ etapa: "gerar", rascunhos: marcados }, controle);
      if (!resposta.ok || !resposta.body) {
        const dados = await resposta.json().catch(() => ({}));
        throw new Error(dados.message ?? (isEnglish ? "Couldn't generate the prompt." : "Não foi possível gerar o prompt."));
      }
      setUsadas(lerCabecalhoDeRegras(resposta.headers.get(CABECALHO_DE_REGRAS)));
      setPaginas(decodificarMapa(resposta.headers.get(CABECALHO_DE_PAGINAS)));
      const leitor = resposta.body.getReader();
      const decodificador = new TextDecoder();
      let texto = "";
      while (true) {
        const { done, value } = await leitor.read();
        if (done) break;
        texto += decodificador.decode(value, { stream: true });
        setPrompt(separarFim(texto).texto);
      }
      texto += decodificador.decode();
      const fim = separarFim(texto);
      setPrompt(fim.texto.trim());
      if (fim.interrompida !== null) setAviso(avisoDeInterrupcao(fim.interrompida, isEnglish));
    } catch (caught) {
      if (!controle.signal.aborted) {
        setErro(caught instanceof Error ? caught.message : (isEnglish ? "Couldn't generate the prompt." : "Não foi possível gerar o prompt."));
      }
    } finally {
      abortRef.current = null;
      setGerando(false);
    }
  }

  return {
    descricao, tipo, regras, marcados, buscando, gerando, prompt, usadas, paginas, erro, aviso,
    setDescricao(v: string) { setDescricaoCrua(v); if (regras) reiniciar(); },
    setTipo(v: TipoDePrompt) { setTipoCru(v); if (regras) reiniciar(); },
    alternar(slug: string) {
      setMarcados((atual) => atual.includes(slug) ? atual.filter((s) => s !== slug) : [...atual, slug]);
    },
    verRegras,
    gerar,
  };
}
