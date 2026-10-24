import { AvisoDeIdioma } from "./AvisoDeIdioma";
import { Cabecalho } from "./Cabecalho";
import { ComportamentoDoSite } from "./ComportamentoDoSite";
import { fonteDoSite } from "./fonte";
import { DialogoDeDemonstracao } from "./MolduraDoSite";
import { SimbolosDoSite } from "./Simbolos";

/**
 * O cabeçalho do site no topo das ferramentas gratuitas (21/10/2026), pedido do
 * André: quem abre o Kit, o Cores ou o Grids por um link direto não pode perder
 * o menu do site — Plataforma, Para quem, Ferramentas, Planos, Recursos, Entrar
 * e Agendar demonstração ficam à vista o tempo todo.
 *
 * Só o TOPO leva a moldura do site. O estilo do site (`.bm-site`) devolve
 * margem, preenchimento e tamanho a botões, campos e listas, e dentro dele a
 * tela da ferramenta perderia o espaçamento que o Tailwind lhe dá — foi o que
 * espremeu a janela do cadastro no `/fonts`. Por isso este bloco não envolve o
 * conteúdo: ele só desenha o cabeçalho (fixo) e o diálogo de contato do botão.
 *
 * `on-page` deixa a página rolar (sem ele o site prende a rolagem do corpo, que
 * é o comportamento do trilho da home), e `on-tool` mantém o cabeçalho fixo
 * também no celular, onde o site o deixaria colado só dentro do próprio bloco.
 */
export function TopoDoSiteNasFerramentas() {
  return (
    <div className={`bm-site on-page on-tool ${fonteDoSite.variable}`} data-topo-do-site>
      <SimbolosDoSite />
      <Cabecalho />
      {/* Quem chega de `/en/tools/...` cai aqui em português; sem o aviso, não saberia por quê. */}
      <AvisoDeIdioma />
      <DialogoDeDemonstracao />
      <ComportamentoDoSite />
    </div>
  );
}
