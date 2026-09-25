"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useIsEnglish } from "@/platform/locale-client";
import { comAlvo, useAlvo } from "@/platform/alvo-client";
import { NOME_MAXIMO, confirmacaoConfere, normalizarNomeDaMarca } from "@/lib/brennimark/nome-da-marca";

/**
 * O nome da marca, editável (ensaio de 25/09/2026).
 *
 * Até aqui só a importação escrevia o nome, e o que ela sugere é o nome do
 * arquivo: "AF_HEINEKEN_Guia-de-marca_2022" ficava sendo a marca para sempre.
 * O endereço não muda com o nome — um link guardado continua valendo.
 */
export function NomeDaMarca({ nome }: { nome: string }) {
  const alvo = useAlvo();
  const router = useRouter();
  const isEnglish = useIsEnglish();
  const [valor, setValor] = useState(nome);
  const [persistido, setPersistido] = useState(nome);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");

  const normalizado = normalizarNomeDaMarca(valor);
  const mudou = normalizado !== null && normalizado !== persistido;

  async function salvar() {
    if (!mudou) return;
    setSalvando(true);
    setMensagem("");
    const resposta = await fetch(comAlvo("/api/admin/brand", alvo), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: normalizado }),
    });
    const resultado = await resposta.json().catch(() => ({}));
    setSalvando(false);
    if (resposta.ok) {
      const salvo = typeof resultado.name === "string" ? resultado.name : normalizado;
      setPersistido(salvo);
      setValor(salvo);
      setMensagem(isEnglish ? "Name saved." : "Nome salvo.");
      // A barra de cima e a lista de marcas vêm do servidor.
      router.refresh();
    } else {
      setMensagem(resultado.message ?? (isEnglish ? "Couldn't save the name." : "Não foi possível salvar o nome."));
    }
  }

  return (
    <section aria-labelledby="nome-da-marca" className="mt-12 border border-platform-border p-5 md:p-8">
      <h2 id="nome-da-marca" className="font-display text-xs font-black uppercase tracking-[0.24em] text-platform-text">
        {isEnglish ? "Brand name" : "Nome da marca"}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-platform-text-muted">
        {isEnglish
          ? "How the brand appears to everyone who has access. The address does not change, so saved links keep working."
          : "Como a marca aparece para todo mundo que tem acesso. O endereço não muda, então links guardados continuam valendo."}
      </p>
      <form
        className="mt-5 flex flex-wrap items-end gap-3"
        onSubmit={(evento) => {
          evento.preventDefault();
          void salvar();
        }}
      >
        <label className="block min-w-0 flex-1 basis-64">
          <span className="sr-only">{isEnglish ? "Brand name" : "Nome da marca"}</span>
          <input
            value={valor}
            maxLength={NOME_MAXIMO}
            onChange={(evento) => {
              setValor(evento.target.value);
              setMensagem("");
            }}
            className="w-full border border-platform-border bg-platform-bg px-4 py-3 text-platform-text focus:border-platform-signal focus:outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={salvando || !mudou}
          className="bg-platform-signal px-5 py-3 font-display text-xs font-black uppercase text-platform-bg disabled:opacity-50"
        >
          {salvando ? (isEnglish ? "Saving…" : "Salvando…") : (isEnglish ? "Save name" : "Salvar nome")}
        </button>
      </form>
      {mensagem && <p role="status" className="mt-3 text-sm text-platform-text-muted">{mensagem}</p>}
    </section>
  );
}

/**
 * Apagar a marca inteira. Até 25/09/2026 a rota e a função do banco existiam,
 * provadas, mas nenhum botão as chamava.
 *
 * Irreversível: leva o manual, os materiais, as conversas e os arquivos. Por
 * isso a confirmação é digitar o nome — um clique distraído não basta.
 */
export function ApagarMarca({ id, nome }: { id: string; nome: string }) {
  const alvo = useAlvo();
  const router = useRouter();
  const isEnglish = useIsEnglish();
  const [aberto, setAberto] = useState(false);
  const [digitado, setDigitado] = useState("");
  const [apagando, setApagando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const confere = confirmacaoConfere(digitado, nome);

  async function apagar() {
    if (!confere) return;
    setApagando(true);
    setMensagem("");
    const resposta = await fetch(comAlvo("/api/admin/brand", alvo), {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandId: id }),
    });
    const resultado = await resposta.json().catch(() => ({}));
    if (resposta.ok) {
      router.push(alvo.workspaceSlug ? `/w/${encodeURIComponent(alvo.workspaceSlug)}` : "/");
      router.refresh();
      return;
    }
    setApagando(false);
    setMensagem(resultado.message ?? (isEnglish ? "Couldn't delete the brand." : "Não foi possível apagar a marca."));
  }

  return (
    <section aria-labelledby="apagar-marca" className="mt-16 border border-platform-danger/40 p-5 md:p-8">
      <h2 id="apagar-marca" className="font-display text-xs font-black uppercase tracking-[0.24em] text-platform-danger">
        {isEnglish ? "Delete brand" : "Apagar marca"}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-platform-text-muted">
        {isEnglish
          ? "Deletes the manual, the materials, the assistant conversations and every file of this brand, for everyone. It cannot be undone."
          : "Apaga o manual, os materiais, as conversas com o Vini e todos os arquivos desta marca, para todo mundo. Não tem volta."}
      </p>
      {!aberto ? (
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="mt-5 border border-platform-danger px-5 py-3 font-display text-xs font-bold uppercase text-platform-danger"
        >
          {isEnglish ? "Delete this brand…" : "Apagar esta marca…"}
        </button>
      ) : (
        <form
          className="mt-5 flex flex-wrap items-end gap-3"
          onSubmit={(evento) => {
            evento.preventDefault();
            void apagar();
          }}
        >
          <label className="block min-w-0 flex-1 basis-64">
            <span className="mb-2 block text-xs text-platform-text-muted">
              {isEnglish ? "To confirm, type the brand name: " : "Para confirmar, digite o nome da marca: "}
              <strong className="text-platform-text">{nome}</strong>
            </span>
            <input
              value={digitado}
              autoFocus
              autoComplete="off"
              spellCheck={false}
              onChange={(evento) => setDigitado(evento.target.value)}
              className="w-full border border-platform-border bg-platform-bg px-4 py-3 text-platform-text focus:border-platform-danger focus:outline-none"
            />
          </label>
          <button
            type="submit"
            disabled={!confere || apagando}
            className="bg-platform-danger px-5 py-3 font-display text-xs font-black uppercase text-platform-bg disabled:opacity-40"
          >
            {apagando ? (isEnglish ? "Deleting…" : "Apagando…") : (isEnglish ? "Delete for good" : "Apagar de vez")}
          </button>
          <button
            type="button"
            disabled={apagando}
            onClick={() => {
              setAberto(false);
              setDigitado("");
              setMensagem("");
            }}
            className="border border-platform-border px-5 py-3 font-display text-xs font-bold uppercase text-platform-text-muted"
          >
            {isEnglish ? "Cancel" : "Cancelar"}
          </button>
        </form>
      )}
      {mensagem && <p role="alert" className="mt-3 text-sm text-platform-danger">{mensagem}</p>}
    </section>
  );
}
