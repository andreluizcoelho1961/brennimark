import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { tokenDeSaidaValido } from "@/lib/cadastro/saida";
import { SaidaDoCadastro } from "@/components/cadastro/SaidaDoCadastro";

/**
 * A página do link de saída de todo e-mail de marketing (17/10/2026).
 *
 * Sem sessão: o `proxy` deixa passar `/sair/`. A página não lê nada do banco e
 * não diz de quem é o cadastro: só mostra as duas opções, e quem decide é o
 * clique (POST em `/api/cadastro/saida`).
 *
 * `no-referrer`: o endereço carrega o token. Sem a política, qualquer link ou
 * imagem aqui o mandaria no cabeçalho `Referer`.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("cadastroPublico.sair");
  return { title: t("metaTitulo"), robots: { index: false, follow: false }, referrer: "no-referrer" };
}

export default async function PaginaDeSaida({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = await getTranslations("cadastroPublico.invalido");
  return (
    <main className="grid min-h-dvh place-items-center bg-platform-bg px-6 py-12 text-platform-text">
      <div className="w-full max-w-[34rem]">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-platform-text-muted">Brennimark</p>
        {tokenDeSaidaValido(token) ? (
          <SaidaDoCadastro token={token} />
        ) : (
          <div data-saida-invalida>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">{t("titulo")}</h1>
            <p className="mt-3 text-sm leading-relaxed text-platform-text-muted">{t("texto")}</p>
          </div>
        )}
      </div>
    </main>
  );
}
