import type { FormatoDaPaleta } from "./download-da-paleta";

type Buscar = (endereco: string, init: RequestInit) => Promise<Pick<Response, "ok" | "json">>;

/**
 * Pede à rota que grave o clique em "baixar a paleta" (03/11/2026). Devolve ""
 * quando a linha nasceu, ou o motivo a mostrar — e então o arquivo não sai: a
 * ordem é registrar, depois entregar, como nos outros downloads.
 */
export async function registrarDownloadDaPaleta(
  { endereco, formato, cores, padrao, buscar }: { endereco: string; formato: FormatoDaPaleta; cores: number; padrao: string; buscar?: Buscar },
): Promise<string> {
  const pedir = buscar ?? ((e, i) => fetch(e, i));
  let resposta: Awaited<ReturnType<Buscar>> | null = null;
  try {
    resposta = await pedir(endereco, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ formato, cores }),
    });
  } catch { /* cai na mensagem padrão */ }
  if (resposta?.ok) return "";
  const corpo = resposta ? await resposta.json().catch(() => ({})) : {};
  return typeof corpo?.message === "string" && corpo.message ? corpo.message : padrao;
}
