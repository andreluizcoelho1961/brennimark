"use client";

import { useCallback, useEffect, useState } from "react";
import { useIsEnglish } from "@/platform/locale-client";
import { comAlvo, useAlvo } from "@/platform/alvo-client";
import {
  alcanceDaPessoa, conferirConcessao, ordenarPessoas, textoDoResultado,
  type Papel, type Pessoa,
} from "@/lib/acesso/pessoas";

type Marca = { id: string; nome: string };

/**
 * Pessoas e acesso — a tela do administrador da conta.
 *
 * ⚖️ Esta lista é informação comercial do assinante: quem trabalha nas marcas
 * dele, e em quais. Só quem administra a conta a vê, e a decisão disso está no
 * banco (`public.pessoas_da_conta` recusa quem não administra).
 *
 * O desenho aqui é funcional e sóbrio de propósito: o layout definitivo vem com
 * as diretrizes do key visual. O que esta versão precisa acertar é o
 * COMPORTAMENTO — conceder, revogar, e dizer a verdade sobre o que aconteceu.
 */
export function PessoasEAcesso() {
  const alvo = useAlvo();
  const isEnglish = useIsEnglish();
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [papel, setPapel] = useState<Papel>("consulta");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  // A senha provisória fica só na memória desta tela, e só até sair dela ou
  // fechar o aviso. Nunca vai para armazenamento do navegador.
  const [senhaNova, setSenhaNova] = useState<{ email: string; senha: string; validaAte: string } | null>(null);
  const [escolhidas, setEscolhidas] = useState<string[]>([]);

  const carregar = useCallback(async () => {
    const resposta = await fetch(comAlvo("/api/admin/pessoas", alvo), { cache: "no-store" });
    const dados = await resposta.json().catch(() => ({}));
    setCarregando(false);
    if (resposta.ok) {
      setPessoas(dados.pessoas ?? []);
      setMarcas(dados.marcas ?? []);
    } else {
      setMensagem(dados.message ?? (isEnglish ? "Couldn't load access." : "Não foi possível carregar o acesso."));
    }
  }, [alvo, isEnglish]);

  /*
   * A primeira carga repete a busca em vez de chamar `carregar`.
   *
   * Não é duplicação à toa: a regra do projeto (`react-hooks/set-state-in-effect`)
   * recusa efeito que chama função que muda estado, e a versão de dentro do
   * efeito ainda cancela a escrita se a tela sair antes da resposta. A mesma
   * forma está em `AssetLibrary`.
   */
  useEffect(() => {
    let cancelado = false;
    async function primeiraCarga() {
      const resposta = await fetch(comAlvo("/api/admin/pessoas", alvo), { cache: "no-store" });
      const dados = await resposta.json().catch(() => ({}));
      if (cancelado) return;
      setCarregando(false);
      if (resposta.ok) {
        setPessoas(dados.pessoas ?? []);
        setMarcas(dados.marcas ?? []);
      } else {
        setMensagem(dados.message ?? (isEnglish ? "Couldn't load access." : "Não foi possível carregar o acesso."));
      }
    }
    void primeiraCarga();
    return () => { cancelado = true; };
  }, [alvo, isEnglish]);

  async function conceder(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setMensagem("");

    // A mesma forma que o banco exige, conferida antes de sair — a pessoa lê o
    // que corrigir, em vez de um erro de banco.
    const conferido = conferirConcessao({ nome, email, papel, marcas: escolhidas });
    if (!conferido.ok) {
      setMensagem(
        conferido.motivo === "nome" ? (isEnglish ? "Write the person's name." : "Escreva o nome da pessoa.")
        : conferido.motivo === "email" ? (isEnglish ? "Check the email address." : "Confira o e-mail.")
        : conferido.motivo === "consulta-sem-marca" ? (isEnglish ? "Choose at least one brand." : "Escolha ao menos uma marca.")
        : conferido.motivo === "administrador-com-marca"
          ? (isEnglish ? "An administrator reaches every brand." : "Quem administra alcança todas as marcas.")
          : (isEnglish ? "Choose the access level." : "Escolha o nível de acesso."),
      );
      return;
    }

    setEnviando(true);
    const resposta = await fetch(comAlvo("/api/admin/pessoas", alvo), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(conferido.concessao),
    });
    const dados = await resposta.json().catch(() => ({}));
    setEnviando(false);
    setMensagem(resposta.ok
      ? textoDoResultado(String(dados.resultado ?? ""), isEnglish)
      : (dados.message ?? (isEnglish ? "Couldn't grant access." : "Não foi possível conceder o acesso.")));
    if (resposta.ok && typeof dados.senha === "string") {
      setSenhaNova({ email: conferido.concessao.email, senha: dados.senha, validaAte: String(dados.validaAte ?? "") });
    }
    if (resposta.ok) { setNome(""); setEmail(""); setEscolhidas([]); await carregar(); }
  }

  async function gerarNovaSenha(pessoa: Pessoa) {
    const aviso = isEnglish
      ? `Generate a new temporary password for ${pessoa.email}? The current one stops working.`
      : `Gerar nova senha provisória para ${pessoa.email}? A atual deixa de valer.`;
    if (!window.confirm(aviso)) return;
    setMensagem("");
    const resposta = await fetch(comAlvo("/api/admin/pessoas", alvo), {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: pessoa.email }),
    });
    const dados = await resposta.json().catch(() => ({}));
    setMensagem(resposta.ok
      ? textoDoResultado(String(dados.resultado ?? ""), isEnglish)
      : (dados.message ?? (isEnglish ? "Couldn't generate a new password." : "Não foi possível gerar outra senha.")));
    if (resposta.ok && typeof dados.senha === "string") {
      setSenhaNova({ email: pessoa.email, senha: dados.senha, validaAte: String(dados.validaAte ?? "") });
      await carregar();
    }
  }

  function quando(iso: string) {
    return new Date(iso).toLocaleString(isEnglish ? "en-GB" : "pt-BR", {
      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
    });
  }

  async function revogar(pessoa: Pessoa, marca?: Marca) {
    const aviso = marca
      ? (isEnglish
          ? `Remove "${marca.nome}" from ${pessoa.email}?`
          : `Tirar “${marca.nome}” do acesso de ${pessoa.email}?`)
      : (isEnglish
          ? `Remove every access of ${pessoa.email} from this account?`
          : `Remover todo o acesso de ${pessoa.email} nesta conta?`);
    if (!window.confirm(aviso)) return;

    const resposta = await fetch(comAlvo("/api/admin/pessoas", alvo), {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: pessoa.email, marca: marca?.id ?? null }),
    });
    const dados = await resposta.json().catch(() => ({}));
    setMensagem(resposta.ok
      ? textoDoResultado(String(dados.resultado ?? ""), isEnglish)
      : (dados.message ?? (isEnglish ? "Couldn't remove access." : "Não foi possível remover o acesso.")));
    if (resposta.ok) await carregar();
  }

  const campo = "w-full border border-platform-border bg-platform-bg px-4 py-3 text-platform-text focus:border-platform-signal focus:outline-none";
  const rotulo = "mb-2 block text-xs font-bold uppercase text-platform-text-muted";
  const botaoSecundario = "border border-platform-border px-3 py-1.5 font-display text-[10px] font-bold uppercase text-platform-text-muted";

  return (
    <div>
      <form onSubmit={conceder} data-form-conceder className="grid gap-4 border border-platform-border bg-platform-panel p-5 md:grid-cols-2">
        <h2 className="font-display text-xs font-black uppercase tracking-widest text-platform-text-muted md:col-span-2">
          {isEnglish ? "Grant access" : "Conceder acesso"}
        </h2>

        <label><span className={rotulo}>{isEnglish ? "Name" : "Nome"}</span>
          <input name="nome" type="text" required maxLength={120} value={nome} autoComplete="off"
            onChange={(e) => setNome(e.target.value)} className={campo} />
        </label>

        <label><span className={rotulo}>{isEnglish ? "Email" : "E-mail"}</span>
          <input name="email" type="email" required value={email} autoCapitalize="none" autoCorrect="off"
            onChange={(e) => setEmail(e.target.value)} className={campo} />
        </label>

        <label><span className={rotulo}>{isEnglish ? "Level" : "Nível"}</span>
          <select name="papel" value={papel} onChange={(e) => setPapel(e.target.value as Papel)} className={campo}>
            <option value="consulta">{isEnglish ? "Consults — reads and downloads" : "Consulta — lê e baixa"}</option>
            <option value="administrador">{isEnglish ? "Administers the account" : "Administra a conta"}</option>
          </select>
        </label>

        {/*
          Administrador não escolhe marcas: ele alcança todas as da conta,
          inclusive as que nascerem depois. Mostrar a lista aqui sugeriria uma
          escolha que não existe — e o banco recusaria.
        */}
        {papel === "administrador" ? (
          <p data-aviso-administrador className="md:col-span-2 text-sm leading-relaxed text-platform-text-muted">
            {isEnglish
              ? "An administrator reaches every brand in the account, including brands created later, and can grant access to other people."
              : "Quem administra alcança todas as marcas da conta, inclusive as criadas depois, e pode conceder acesso a outras pessoas."}
          </p>
        ) : (
          <fieldset className="md:col-span-2">
            <legend className={rotulo}>{isEnglish ? "Brands" : "Marcas"}</legend>
            {marcas.length === 0
              ? <p className="text-sm text-platform-text-muted">{isEnglish ? "This account has no brands yet." : "Esta conta ainda não tem marcas."}</p>
              : <div className="flex flex-wrap gap-3">
                  {marcas.map((marca) => (
                    <label key={marca.id} className="flex items-center gap-2 border border-platform-border px-3 py-2 text-sm text-platform-text">
                      <input type="checkbox" name="marcas" value={marca.id}
                        checked={escolhidas.includes(marca.id)}
                        onChange={(e) => setEscolhidas((atual) =>
                          e.target.checked ? [...atual, marca.id] : atual.filter((id) => id !== marca.id))} />
                      {marca.nome}
                    </label>
                  ))}
                </div>}
          </fieldset>
        )}

        <div className="md:col-span-2">
          <button disabled={enviando} className="bg-platform-signal px-5 py-3 font-display text-xs font-black uppercase text-platform-bg disabled:opacity-50">
            {enviando ? (isEnglish ? "Granting…" : "Concedendo…") : (isEnglish ? "Grant access" : "Conceder acesso")}
          </button>
          {/* Dito desde já: ninguém recebe mensagem nossa. Quem entrega a
              senha é o administrador, pelo canal dele. */}
          <p className="mt-3 text-[12px] leading-relaxed text-platform-text-muted">
            {isEnglish
              ? "No email is sent. A temporary password appears here once — hand it to the person yourself. They choose their own at first sign-in, and only then does access start."
              : "Nenhum e-mail é enviado. Uma senha provisória aparece aqui uma vez — entregue-a você à pessoa. Ela escolhe a própria senha no primeiro acesso, e só então o acesso começa."}
          </p>
        </div>
      </form>

      {mensagem && <p role="status" className="mt-4 text-sm text-platform-text-muted">{mensagem}</p>}

      {senhaNova && (
        <div data-senha-provisoria role="region" aria-label={isEnglish ? "Temporary password" : "Senha provisória"}
          className="mt-4 border border-platform-signal bg-platform-panel p-5">
          <p className="text-xs font-bold uppercase text-platform-text-muted">
            {isEnglish ? "Temporary password for" : "Senha provisória de"} {senhaNova.email}
          </p>
          <p data-senha className="mt-3 select-all font-mono text-2xl tracking-wider text-platform-text">{senhaNova.senha}</p>
          <p className="mt-3 text-[12px] leading-relaxed text-platform-text-muted">
            {isEnglish
              ? `Shown only now — it isn't stored anywhere readable. Valid until ${quando(senhaNova.validaAte)}.`
              : `Mostrada só agora — não fica guardada em lugar legível. Vale até ${quando(senhaNova.validaAte)}.`}
          </p>
          <div className="mt-4 flex gap-3">
            <button type="button" className={botaoSecundario}
              onClick={() => { void navigator.clipboard?.writeText(senhaNova.senha); }}>
              {isEnglish ? "Copy" : "Copiar"}
            </button>
            <button type="button" className={botaoSecundario} onClick={() => setSenhaNova(null)}>
              {isEnglish ? "I've handed it over" : "Já entreguei"}
            </button>
          </div>
        </div>
      )}

      {carregando
        ? <p className="mt-8 text-sm text-platform-text-muted">{isEnglish ? "Loading…" : "Carregando…"}</p>
        : <div className="mt-8 overflow-x-auto">
            <table data-tabela-pessoas className="w-full min-w-[40rem] text-left text-sm">
              <thead>
                <tr className="border-b border-platform-border text-[11px] uppercase tracking-wider text-platform-text-muted">
                  <th className="py-2 pr-4 font-medium">{isEnglish ? "Person" : "Pessoa"}</th>
                  <th className="py-2 pr-4 font-medium">{isEnglish ? "Level" : "Nível"}</th>
                  <th className="py-2 pr-4 font-medium">{isEnglish ? "Reaches" : "Alcança"}</th>
                  <th className="py-2 font-medium"><span className="sr-only">{isEnglish ? "Actions" : "Ações"}</span></th>
                </tr>
              </thead>
              <tbody>
                {ordenarPessoas(pessoas).map((pessoa) => (
                  <tr key={pessoa.email} data-pessoa={pessoa.email}
                    className="border-b border-platform-border/60 align-top">
                    <td className="py-3 pr-4 text-platform-text">
                      {pessoa.nome && <span className="block">{pessoa.nome}</span>}
                      <span className={pessoa.nome ? "block text-[12px] text-platform-text-muted" : undefined}>{pessoa.email}</span>
                      {/* "Esperando" e não "convidado": nenhuma mensagem saiu. */}
                      {pessoa.pendente && (
                        <span data-pendente className="mt-1 inline-block border border-platform-border px-2 py-0.5 text-[10px] uppercase tracking-wider text-platform-text-muted">
                          {!pessoa.senhaProvisoriaAte
                            ? (isEnglish ? "Waiting for first sign-in" : "Esperando o primeiro acesso")
                            : new Date(pessoa.senhaProvisoriaAte) <= new Date()
                              ? (isEnglish ? "Temporary password expired" : "Senha provisória vencida")
                              : (isEnglish ? `Temporary password until ${quando(pessoa.senhaProvisoriaAte)}` : `Senha provisória até ${quando(pessoa.senhaProvisoriaAte)}`)}
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-platform-text">
                      {pessoa.papel === "administrador"
                        ? (isEnglish ? "Administers" : "Administra")
                        : (isEnglish ? "Consults" : "Consulta")}
                    </td>
                    <td className="py-3 pr-4 text-platform-text-muted">
                      {alcanceDaPessoa(pessoa, marcas.length, isEnglish)}
                      {pessoa.papel === "consulta" && pessoa.marcas.length > 0 && (
                        <span className="mt-2 flex flex-wrap gap-2">
                          {pessoa.marcas.map((marca) => (
                            <button key={marca.id} type="button" onClick={() => revogar(pessoa, marca)}
                              className="border border-platform-border px-2 py-1 text-[11px] text-platform-text-muted">
                              {isEnglish ? `Remove ${marca.nome}` : `Tirar ${marca.nome}`}
                            </button>
                          ))}
                        </span>
                      )}
                    </td>
                    <td className="flex flex-wrap gap-2 py-3">
                      {pessoa.pendente && pessoa.senhaProvisoriaAte && (
                        <button type="button" onClick={() => gerarNovaSenha(pessoa)} className={botaoSecundario}>
                          {isEnglish ? "New password" : "Gerar nova senha"}
                        </button>
                      )}
                      <button type="button" onClick={() => revogar(pessoa)} className={botaoSecundario}>
                        {isEnglish ? "Remove access" : "Remover acesso"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>}
    </div>
  );
}
