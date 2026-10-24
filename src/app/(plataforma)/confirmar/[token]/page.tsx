import type { Metadata } from "next";
import { tokenDeSaidaValido } from "@/lib/cadastro/saida";
import { ConfirmacaoDoCadastro } from "@/components/cadastro/ConfirmacaoDoCadastro";

/**
 * A página do botão do e-mail de confirmação da lista (18/10/2026).
 *
 * Sem sessão: o `proxy` deixa passar `/confirmar/`. A página não lê nada do
 * banco e não diz de quem é o cadastro: só mostra o botão, e quem decide é o
 * clique (POST em `/api/cadastro/confirmar`).
 *
 * `no-referrer`: o endereço carrega o token.
 */
export const metadata: Metadata = {
  title: "Confirmar o e-mail",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function PaginaDeConfirmacao({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <main className="grid min-h-dvh place-items-center bg-platform-bg px-6 py-12 text-platform-text">
      <div className="w-full max-w-[34rem]">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-platform-text-muted">Brennimark</p>
        {tokenDeSaidaValido(token) ? (
          <ConfirmacaoDoCadastro token={token} />
        ) : (
          <div data-confirmacao-invalida>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Este link não é válido.</h1>
            <p className="mt-3 text-sm leading-relaxed text-platform-text-muted">Confira se o endereço chegou inteiro. Se precisar de ajuda, escreva para o contato que aparece no rodapé do e-mail.</p>
          </div>
        )}
      </div>
    </main>
  );
}
