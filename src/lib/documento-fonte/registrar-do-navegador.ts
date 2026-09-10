/**
 * A chamada do navegador para a segunda transação.
 *
 * Duas cordas atravessam a rede: a chave da marca e o id da importação. Todo o
 * manifesto é derivado no servidor, do relatório que a transação A gravou —
 * ver `registrar.ts`. É por isso que este módulo pode ser tão pequeno, e é o
 * que torna a nova tentativa idêntica à primeira sem guardar nada.
 *
 * `buscar` é injetado para a regra ser testável sem navegador: o que importa
 * aqui é a classificação da resposta, não o `fetch`.
 */

export interface PedidoDoNavegador {
  marca: string;
  importId: string;
}

export type RespostaDoRegistro =
  | { ok: true; paginas: number; paginasSemSecao: number; jaEstava: boolean }
  | { ok: false; codigo: string; repetivel: boolean };

export async function registrarImportacao(
  { marca, importId }: PedidoDoNavegador,
  buscar: typeof fetch = fetch,
): Promise<RespostaDoRegistro> {
  let resposta: Response;
  try {
    resposta = await buscar("/api/documento-fonte/registrar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ marca, import_id: importId }),
    });
  } catch {
    /*
     * A rede caiu antes de haver resposta. Este é o caso em que NÃO se sabe se
     * a transação aconteceu — e é exatamente por isso que a repetição precisa
     * ser idempotente. Temporário e repetível.
     */
    return { ok: false, codigo: "falha_temporaria", repetivel: true };
  }

  let corpo: Record<string, unknown> = {};
  try {
    corpo = (await resposta.json()) as Record<string, unknown>;
  } catch {
    // Corpo ilegível com resposta boa não é sucesso: a interface não pode
    // declarar conclusão sem o servidor ter dito qual documento concluiu.
    return { ok: false, codigo: "falha_temporaria", repetivel: true };
  }

  if (!resposta.ok) {
    return {
      ok: false,
      codigo: typeof corpo.codigo === "string" ? corpo.codigo : "falha_temporaria",
      // O servidor decide se vale repetir; na ausência da declaração, repetir
      // é o erro seguro, porque a operação é idempotente.
      repetivel: corpo.repetivel !== false,
    };
  }

  /*
   * `documentoId` é a prova de que a segunda transação concluiu. Um 200 sem
   * ele seria uma resposta que a interface não pode interpretar como sucesso —
   * e declarar sucesso sem manifesto registrado é a coisa que este passo
   * inteiro existe para impedir.
   */
  if (typeof corpo.documentoId !== "string" || corpo.documentoId.length === 0) {
    return { ok: false, codigo: "falha_temporaria", repetivel: true };
  }

  return {
    ok: true,
    paginas: typeof corpo.paginas === "number" ? corpo.paginas : 0,
    paginasSemSecao: typeof corpo.paginasSemSecao === "number" ? corpo.paginasSemSecao : 0,
    jaEstava: corpo.jaEstava === true,
  };
}
