"use client";

import { useEffect, useRef, useState } from "react";
import { comAlvo, useAlvo } from "@/platform/alvo-client";
import { useIsEnglish } from "@/platform/locale-client";
import { CABECALHO_DE_PAGINAS, decodificarMapa, type MapaDePaginas } from "@/lib/ai/paginas-citadas";
import { avisoDeInterrupcao, separarFim } from "@/lib/ai/fim-da-resposta";

/**
 * A conversa com o Vini — pedir, receber em fluxo, interromper, tentar de novo.
 *
 * Nasceu da tela `/docs/chat`, que fazia tudo isso dentro da página. Agora
 * mora aqui para a janela do Vini usar o mesmo comportamento, já provado no
 * ensaio: fases de progresso, aviso de demora, interrupção sem perder a
 * pergunta, e erro dito como o servidor o escreveu.
 *
 * ⚖️ A conversa vive na MEMÓRIA desta janela: recarregar a página a apaga.
 * Guardar de verdade é a fatia 4d, com a regra de que ninguém lê a conversa
 * de outra pessoa — nem o administrador (spec do Assistente, decisão 71).
 * Nada aqui vai para o armazenamento do navegador, que seria guardar sem essa
 * regra.
 */
export type MensagemDoVini = {
  role: "user" | "assistant";
  content: string;
  /** Só nas respostas: as páginas dos trechos que o servidor entregou. */
  paginas?: MapaDePaginas;
  /** O provedor parou antes de terminar — o texto acima pode estar incompleto. */
  incompleta?: boolean;
};

export type FaseDaConversa = "idle" | "connecting" | "thinking" | "answering";

export function useConversaDaMarca() {
  const alvo = useAlvo();
  const isEnglish = useIsEnglish();
  const [mensagens, setMensagens] = useState<MensagemDoVini[]>([]);
  const [fase, setFase] = useState<FaseDaConversa>("idle");
  const [segundos, setSegundos] = useState(0);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [paraRepetir, setParaRepetir] = useState<MensagemDoVini[] | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const ocupado = fase !== "idle";

  useEffect(() => {
    if (!ocupado) return;
    const inicio = Date.now();
    const relogio = window.setInterval(() => setSegundos(Math.floor((Date.now() - inicio) / 1000)), 1000);
    return () => window.clearInterval(relogio);
  }, [ocupado]);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function pedir(proximas: MensagemDoVini[]) {
    if (ocupado) return;
    const controle = new AbortController();
    abortRef.current = controle;
    setMensagens(proximas);
    setErro("");
    setAviso("");
    setParaRepetir(null);
    setSegundos(0);
    setFase("connecting");

    try {
      const resposta = await fetch(comAlvo("/api/ai/chat", alvo), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Só papel e texto vão ao servidor: as páginas são da tela.
        body: JSON.stringify({ messages: proximas.map(({ role, content }) => ({ role, content })) }),
        signal: controle.signal,
      });

      if (!resposta.ok || !resposta.body) {
        const dados = await resposta.json().catch(() => null);
        throw new Error(dados?.message ?? (isEnglish ? "Couldn't reach the assistant." : "Não foi possível consultar o assistente."));
      }

      const paginas = decodificarMapa(resposta.headers.get(CABECALHO_DE_PAGINAS));
      setFase("thinking");

      const leitor = resposta.body.getReader();
      const decodificador = new TextDecoder();
      let texto = "";
      while (true) {
        const { done, value } = await leitor.read();
        if (done) break;
        texto += decodificador.decode(value, { stream: true });
        setFase("answering");
        // Pedaço da marca de fim não pisca na tela enquanto o resto não chega.
        setMensagens([...proximas, { role: "assistant", content: separarFim(texto).texto, paginas }]);
      }
      texto += decodificador.decode();
      const fim = separarFim(texto);
      if (!fim.texto.trim()) {
        throw new Error(isEnglish ? "The assistant ended without producing an answer." : "O assistente encerrou sem produzir uma resposta.");
      }
      setMensagens([...proximas, { role: "assistant", content: fim.texto, paginas, incompleta: fim.interrompida !== null }]);
      if (fim.interrompida !== null) {
        // O pedaço fica à vista — pode ser útil —, mas dito como pedaço, e
        // com o caminho de tentar de novo.
        setAviso(avisoDeInterrupcao(fim.interrompida, isEnglish));
        setParaRepetir(proximas);
      }
    } catch (caught) {
      setParaRepetir(proximas);
      if (controle.signal.aborted) {
        setAviso(isEnglish ? "Response interrupted. You can try again whenever you like." : "Resposta interrompida. Você pode tentar de novo quando quiser.");
      } else {
        setErro(caught instanceof Error ? caught.message : (isEnglish ? "Network failure while talking to the AI." : "Falha de rede ao conversar com a IA."));
      }
    } finally {
      abortRef.current = null;
      setFase("idle");
    }
  }

  return {
    mensagens,
    fase,
    ocupado,
    segundos,
    erro,
    aviso,
    podeRepetir: paraRepetir !== null,
    perguntar(texto: string) {
      const limpo = texto.trim();
      if (!limpo || ocupado) return false;
      void pedir([...mensagens, { role: "user", content: limpo }]);
      return true;
    },
    interromper() {
      abortRef.current?.abort();
    },
    repetir() {
      if (paraRepetir) void pedir(paraRepetir);
    },
  };
}
