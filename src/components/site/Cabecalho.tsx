import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { paginasDoGrupo, type GrupoDoMenu } from "@/lib/site/paginas";
import { caminhoDoSite, type IdiomaDoSite } from "@/lib/site/idiomas";
import { idiomaDoSiteAtual } from "@/lib/site/idioma-atual";
import { EntrarOuAbrir } from "./EntrarOuAbrir";
import { SeletorDeIdiomaDoSite } from "./SeletorDeIdiomaDoSite";

/**
 * O cabeçalho do site e o menu do celular.
 *
 * Abrir e fechar os menus é com `ComportamentoDoSite`; aqui só a marcação.
 * "Planos" e o logo apontam para a home (`/#planos`, `/`): na própria home,
 * `data-go` faz o trilho deslizar até o capítulo em vez de recarregar.
 *
 * Os textos vêm do catálogo (`site.chrome`, `site.paginas`) e os endereços
 * saem de `caminhoDoSite`: no inglês, `/agencias` vira `/en/agencies`.
 */
type Tradutor = Awaited<ReturnType<typeof getTranslations>>;

const MENUS: { id: string; chave: "plataforma" | "paraQuem" | "recursos"; grupo: GrupoDoMenu; largo?: boolean; titulo?: "aPlataforma" }[] = [
  { id: "m-plat", chave: "plataforma", grupo: "plataforma", largo: true, titulo: "aPlataforma" },
  { id: "m-para", chave: "paraQuem", grupo: "para-quem" },
  { id: "m-rec", chave: "recursos", grupo: "recursos" },
];

function ItemDoMenu({ item, idioma, t, paginas }: { item: (typeof MENUS)[number]; idioma: IdiomaDoSite; t: Tradutor; paginas: Tradutor }) {
  const itens = paginasDoGrupo(item.grupo).map((p) => (
    <Link key={p.slug} href={caminhoDoSite(idioma, `/${p.slug}`)}>
      <b>{paginas(`${p.slug}.titulo`)}</b>
      <span>{paginas(`${p.slug}.resumo`)}</span>
    </Link>
  ));
  return (
    <div className="nav-item">
      <button className="nav-btn" type="button" aria-expanded="false" aria-controls={item.id}>
        {t(item.chave)} <span aria-hidden="true">▾</span>
      </button>
      <div className={item.largo ? "menu menu--wide" : "menu"} id={item.id}>
        {item.titulo ? <p className="menu-k">{t(item.titulo)}</p> : null}
        {item.largo ? <div className="menu-grid">{itens}</div> : itens}
      </div>
    </div>
  );
}

export async function Cabecalho() {
  const idioma = await idiomaDoSiteAtual();
  const t = await getTranslations("site.chrome");
  const paginas = await getTranslations("site.paginas");
  const rota = (caminhoPt: string) => caminhoDoSite(idioma, caminhoPt);
  return (
    <>
      <header className="site-head">
        <Link className="lockup" href={rota("/")} data-go="inicio" aria-label={t("inicio")}>
          <svg viewBox="0 0 750 170" role="img" aria-label="Brennimark">
            <use href="#bm-logo" />
          </svg>
        </Link>
        <nav className="site-nav" aria-label={t("navPrincipal")}>
          <ItemDoMenu item={MENUS[0]} idioma={idioma} t={t} paginas={paginas} />
          <ItemDoMenu item={MENUS[1]} idioma={idioma} t={t} paginas={paginas} />
          {/* O Fonts tem botão próprio (23/10/2026): é o app mais importante do pacote, e ficava só no fim da home. */}
          <Link className="nav-link nav-fonts" href={rota("/fonts")}>
            {t("fonts")} <span className="nav-tag">{t("beta")}</span>
          </Link>
          <Link className="nav-link" href={rota("/#ferramentas")} data-go="ferramentas">
            {t("ferramentas")}
          </Link>
          <Link className="nav-link" href={rota("/#planos")} data-go="planos">
            {t("planos")}
          </Link>
          <ItemDoMenu item={MENUS[2]} idioma={idioma} t={t} paginas={paginas} />
        </nav>
        <div className="head-actions">
          <SeletorDeIdiomaDoSite atual={idioma} />
          <EntrarOuAbrir className="signin" />
          <button className="menu-toggle" type="button" aria-expanded="false" aria-controls="mnav">
            <span className="mt-lines" aria-hidden="true">
              <i />
              <i />
            </span>
            {t("menu")}
          </button>
          <button className="btn btn--small" type="button" data-open="dlg-demo">
            {t("agendar")} <span className="arrow" aria-hidden="true">↗</span>
          </button>
        </div>
      </header>
      <MenuDoCelular idioma={idioma} t={t} paginas={paginas} />
    </>
  );
}

function MenuDoCelular({ idioma, t, paginas }: { idioma: IdiomaDoSite; t: Tradutor; paginas: Tradutor }) {
  const rota = (caminhoPt: string) => caminhoDoSite(idioma, caminhoPt);
  const lista = (grupo: GrupoDoMenu) => (
    <ul>
      {paginasDoGrupo(grupo).map((p) => (
        <li key={p.slug}>
          <Link href={rota(`/${p.slug}`)}>{paginas(`${p.slug}.titulo`)}</Link>
        </li>
      ))}
    </ul>
  );
  return (
    <div className="mnav" id="mnav" hidden>
      <p className="mnav-k">{t("plataforma")}</p>
      {lista("plataforma")}
      <p className="mnav-k">{t("paraQuem")}</p>
      {lista("para-quem")}
      <p className="mnav-k">{t("recursos")}</p>
      {lista("recursos")}
      <ul>
        <li>
          <Link href={rota("/fonts")}>
            {t("fontsBeta")}
          </Link>
        </li>
        <li>
          <Link href={rota("/#ferramentas")} data-go="ferramentas">
            {t("ferramentasGratuitas")}
          </Link>
        </li>
        <li>
          <Link href={rota("/#planos")} data-go="planos">
            {t("planos")}
          </Link>
        </li>
      </ul>
      <div className="mnav-actions">
        <button className="btn" type="button" data-open="dlg-demo">
          {t("agendarUma")} <span className="arrow" aria-hidden="true">↗</span>
        </button>
        <Link className="btn btn--ghost" href="/demonstracao" prefetch={false} data-tour-botao="menu">{t("tour")}</Link>
        <EntrarOuAbrir className="btn btn--ghost" />
      </div>
    </div>
  );
}
