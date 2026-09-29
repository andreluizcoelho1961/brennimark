import Link from "next/link";
import { paginasDoGrupo, type GrupoDoMenu } from "@/lib/site/paginas";
import { EntrarOuAbrir } from "./EntrarOuAbrir";

/**
 * O cabeçalho do site e o menu do celular.
 *
 * Abrir e fechar os menus é com `ComportamentoDoSite`; aqui só a marcação.
 * "Planos" e o logo apontam para a home (`/#planos`, `/`): na própria home,
 * `data-go` faz o trilho deslizar até o capítulo em vez de recarregar.
 */
const MENUS: { id: string; rotulo: string; grupo: GrupoDoMenu; largo?: boolean; titulo?: string }[] = [
  { id: "m-plat", rotulo: "Plataforma", grupo: "plataforma", largo: true, titulo: "A plataforma" },
  { id: "m-para", rotulo: "Para quem", grupo: "para-quem" },
  { id: "m-rec", rotulo: "Recursos", grupo: "recursos" },
];

function ItemDoMenu({ id, rotulo, grupo, largo, titulo }: (typeof MENUS)[number]) {
  const itens = paginasDoGrupo(grupo).map((p) => (
    <Link key={p.slug} href={`/${p.slug}`}>
      <b>{p.titulo}</b>
      <span>{p.resumo}</span>
    </Link>
  ));
  return (
    <div className="nav-item">
      <button className="nav-btn" type="button" aria-expanded="false" aria-controls={id}>
        {rotulo} <span aria-hidden="true">▾</span>
      </button>
      <div className={largo ? "menu menu--wide" : "menu"} id={id}>
        {titulo ? <p className="menu-k">{titulo}</p> : null}
        {largo ? <div className="menu-grid">{itens}</div> : itens}
      </div>
    </div>
  );
}

export function Cabecalho() {
  return (
    <>
      <header className="site-head">
        <Link className="lockup" href="/" data-go="inicio" aria-label="Brennimark, início">
          <svg viewBox="0 0 750 170" role="img" aria-label="Brennimark">
            <use href="#bm-logo" />
          </svg>
        </Link>
        <nav className="site-nav" aria-label="Navegação principal">
          <ItemDoMenu {...MENUS[0]} />
          <ItemDoMenu {...MENUS[1]} />
          <Link className="nav-link" href="/#planos" data-go="planos">
            Planos
          </Link>
          <ItemDoMenu {...MENUS[2]} />
        </nav>
        <div className="head-actions">
          <EntrarOuAbrir className="signin" />
          <button className="menu-toggle" type="button" aria-expanded="false" aria-controls="mnav">
            <span className="mt-lines" aria-hidden="true">
              <i />
              <i />
            </span>
            Menu
          </button>
          <button className="btn btn--small" type="button" data-open="dlg-demo">
            Agendar demonstração <span className="arrow" aria-hidden="true">↗</span>
          </button>
        </div>
      </header>
      <MenuDoCelular />
    </>
  );
}

function MenuDoCelular() {
  const lista = (grupo: GrupoDoMenu) => (
    <ul>
      {paginasDoGrupo(grupo).map((p) => (
        <li key={p.slug}>
          <Link href={`/${p.slug}`}>{p.titulo}</Link>
        </li>
      ))}
    </ul>
  );
  return (
    <div className="mnav" id="mnav" hidden>
      <p className="mnav-k">Plataforma</p>
      {lista("plataforma")}
      <p className="mnav-k">Para quem</p>
      {lista("para-quem")}
      <p className="mnav-k">Recursos</p>
      {lista("recursos")}
      <ul>
        <li>
          <Link href="/#planos" data-go="planos">
            Planos
          </Link>
        </li>
      </ul>
      <div className="mnav-actions">
        <button className="btn" type="button" data-open="dlg-demo">
          Agendar uma demonstração <span className="arrow" aria-hidden="true">↗</span>
        </button>
        <EntrarOuAbrir className="btn btn--ghost" />
      </div>
    </div>
  );
}
