import Link from "next/link";
import { EMPRESA } from "@/lib/site/empresa";
import { Losango } from "../Losango";
import { PedirConviteDoFonts } from "../PedirConviteDoFonts";
import { Titulo } from "../Titulo";

/**
 * Brennimark Fonts — `/fonts`. Página do beta (16/10/2026).
 *
 * Regra desta página: só afirma o que o aplicativo faz HOJE. O que está no
 * roteiro aparece como "em desenvolvimento", em bloco separado. A comparação
 * usa só o que se sabe do concorrente pelo site dele (análise de 14/10/2026,
 * o aplicativo dele não foi testado) e diz isso na própria tabela.
 *
 * O pedido de acesso (17/10/2026) é o cadastro gratuito do site, em modo
 * convite (`PedirConviteDoFonts`): cai na lista, marcado como pedido do Fonts.
 * O instalador é enviado por link privado a cada testador, à mão. O aviso de
 * lançamento continua sendo um e-mail pré-preenchido para `EMPRESA.email`.
 */

const AVISAR_LANCAMENTO = `mailto:${EMPRESA.email}?subject=${encodeURIComponent("Avisem-me do lançamento do Brennimark Fonts")}`;

const RECURSOS = [
  { t: "Biblioteca local, sem nuvem", d: "Catálogo no seu computador. Funciona sem internet e sem conta; recursos de rede, quando chegarem, vêm desligados." },
  { t: "Importa sem tocar nos originais", d: "Aponte uma pasta e o Fonts cataloga TTF, OTF e coleções TTC/OTC. Não copia, não instala e não apaga nada." },
  { t: "Cada fonte tem identidade", d: "Cada arquivo é reconhecido por impressão digital (SHA-256). Duplicata exata é achada mesmo com nome diferente." },
  { t: "Font Vault", d: "Quando quiser, guarda uma cópia gerenciada da fonte. A remoção vai para uma área recuperável; não há exclusão permanente." },
  { t: "Ativa e desativa de verdade", d: "Ativação temporária no macOS e no Windows, com controle de conflito de nomes e recuperação se o app fechar no meio." },
  { t: "Famílias, não arquivos soltos", d: "Os estilos de uma família ficam juntos, com busca por família, peso, estilo e eixos de fonte variável." },
  { t: "Prévia tipográfica", d: "Glifos por bloco Unicode, recursos OpenType (ligaturas, versaletes, alternativas), eixos variáveis e um Playground com CSS." },
  { t: "Coleções, marcas e kits", d: "Organize por projeto e por cliente. Um kit reúne as fontes de uma marca para ativar de uma vez." },
  { t: "Pastas vigiadas", d: "O Fonts acompanha pastas e percebe o que entrou, mudou ou sumiu. Pasta offline não vira fonte perdida." },
  { t: "Tags e coleções inteligentes", d: "Etiquetas livres e coleções que se montam sozinhas por regras (por exemplo, sans com peso Bold e itálico)." },
  { t: "Fontes parecidas", d: "Compara as formas medidas no próprio arquivo e mostra alternativas semelhantes dentro da sua biblioteca." },
  { t: "Diagnóstico que não vaza", d: "A tela Sobre gera um resumo para suporte com versão e sistema. Nunca inclui caminhos, nomes de fontes ou clientes." },
] as const;

const EM_DESENVOLVIMENTO = [
  "Ativação automática ao abrir um documento (lendo InDesign, Photoshop e Illustrator)",
  "Google Fonts, opcional e desligado por padrão",
  "Sincronização entre computadores pela conta Brennimark",
  "Conta e licença do Brennimark dentro do app, e atualização automática",
  "Linux",
  "Idiomas e temas",
] as const;

type Linha = { item: string; fonts: string; outro: string; nota?: "fonts" | "outro" };

const COMPARACAO: readonly Linha[] = [
  { item: "Sistemas hoje", fonts: "macOS e Windows (beta). Linux em preparação.", outro: "macOS, Windows e Linux.", nota: "outro" },
  { item: "Preço", fonts: "Incluso na assinatura Brennimark; avulso anual (valor a anunciar).", outro: "Grátis; plano pago a partir de US$ 29 por ano.", nota: "outro" },
  { item: "Biblioteca local e offline", fonts: "Sim, e a rede é opcional.", outro: "Sim." },
  { item: "Ativação de fontes", fonts: "Controle de conflito de nomes e recuperação se o app fechar no meio.", outro: "Manual por fonte; some ao fechar o app, segundo o site deles." },
  { item: "Fonte por marca ou cliente", fonts: "Marcas e kits, feitos para ligar ao manual da marca.", outro: "Coleções.", nota: "fonts" },
  { item: "Prévia, glifos e OpenType", fonts: "Sim.", outro: "Sim, com Playground." },
  { item: "Busca por semelhança", fonts: "Sim, medida no arquivo.", outro: "Sim, no plano pago." },
  { item: "Ativação automática no Adobe", fonts: "Em desenvolvimento.", outro: "Sim, no plano pago.", nota: "outro" },
  { item: "Google Fonts e novidades de foundries", fonts: "Google Fonts em desenvolvimento.", outro: "Sim.", nota: "outro" },
  { item: "Sincronização entre máquinas", fonts: "Em desenvolvimento.", outro: "Sim (Dropbox e Drive).", nota: "outro" },
  { item: "Times e licenças por fonte", fonts: "Entrega com prazo e evidência de licença pela plataforma Brennimark.", outro: "Contador de assentos por fonte.", nota: "fonts" },
  { item: "Maturidade", fonts: "Beta, limitado aos 50 primeiros.", outro: "Produto estabelecido.", nota: "outro" },
];

const PERGUNTAS = [
  {
    p: "Por que o aviso do sistema ao instalar?",
    r: "O aviso aparece porque este beta ainda não tem assinatura digital de distribuição (a Apple e a Microsoft cobram certificados, que contratamos antes do lançamento oficial). Ele não indica problema no arquivo: o macOS e o Windows só avisam que não conhecem o autor. O instalador chega direto de nós, com a soma de verificação para você conferir que o arquivo é o mesmo.",
  },
  {
    p: "Como abro no Mac?",
    r: "Ao abrir pela primeira vez, o macOS avisa que não pode verificar o app. Vá em Ajustes do Sistema, Privacidade e Segurança, role até a mensagem sobre o Brennimark Fonts e escolha Abrir mesmo assim. O beta é para Macs com chip Apple; Intel ainda não foi testado.",
  },
  {
    p: "Como abro no Windows?",
    r: "O SmartScreen mostra O Windows protegeu o computador. Clique em Mais informações e depois em Executar assim mesmo. O instalador é por usuário e não pede permissão de administrador. Testado no Windows 11.",
  },
  {
    p: "Minhas fontes vão para algum servidor?",
    r: "Não. O catálogo, as cópias do Vault, as coleções e os kits ficam no seu computador. O resumo de suporte nunca leva nome de fonte, caminho ou cliente.",
  },
  {
    p: "Posso confiar minha biblioteca de trabalho a um beta?",
    r: "O Fonts não apaga nem altera os originais. Ainda assim, é beta: comece por uma pasta de teste e mantenha seu backup de sempre.",
  },
  {
    p: "O beta é pago? Por quanto tempo vale?",
    r: "Não é pago, e é por convite, limitado aos 50 primeiros pedidos aprovados. Pedido o acesso, avaliamos e enviamos o instalador; o teste vale 90 dias. Depois disso, é preciso migrar para a versão paga, que estará pronta até lá.",
  },
  {
    p: "E se as 50 vagas acabarem?",
    r: "O beta não abre vagas além das 50. Quem ficar de fora pode pedir o aviso de lançamento, no topo da página, e usa o Fonts incluso na assinatura do Brennimark ou na versão avulsa, quando sair.",
  },
  {
    p: "Quando é o lançamento oficial?",
    r: "Em breve, sem data fechada. A versão paga é uma licença de um ano, com atualizações e novas versões durante a validade; depois, renova-se. Quem assina o Brennimark já recebe o Fonts. Quem testa o beta tem condição de lançamento, que anunciaremos antes de qualquer cobrança.",
  },
] as const;

export function ConteudoFonts() {
  return (
    <>
      <section className="pg-sec pg-sec--topo"><Losango classe="l1" velocidade={-0.22} />
      <div className="pg-wrap pg-hero pg-hero--compacto">
      <div>
      <p className="crumb"><a href="#" data-open-menu="m-plat">Plataforma</a> · Brennimark Fonts</p>
      <Titulo como="h1" className="pg-h1" partes={["O gerenciador de fontes feito para quem trabalha com marcas."]} />
      <p className="pg-lead">Biblioteca local, ativação confiável e fontes organizadas por marca e por cliente. A meta é ser o melhor gerenciador de fontes para diretores de arte, agências e estúdios.</p>
      <p className="fx-beta"><b>Beta fechado, gratuito, por convite</b> · só os 50 primeiros · 90 dias · macOS e Windows · Linux em preparação</p>
      <div className="pg-actions"><PedirConviteDoFonts rotulo="Pedir acesso ao beta" /><a className="btn btn--ghost" href={AVISAR_LANCAMENTO}>Avisar-me do lançamento <span className="arrow" aria-hidden="true">→</span></a></div>
      </div>
      <div className="frame"><div className="mk" role="img" aria-label="Janela do Brennimark Fonts: famílias de uma marca, com um kit pronto para ativar e um conflito de nomes avisado"><div className="mk-bar"><b>Brennimark Fonts</b><span className="a-direita mono" style={{ fontSize: "10px", color: "var(--app-muted)" }}>Beta</span></div><div className="mk-body fx-demo">
      <div><b>Kit · Marca Exemplo</b><span>3 famílias · 11 estilos</span><em>Ativar kit</em></div>
      <div><b>Serifada Display</b><span>5 estilos · ativa</span><em>Desativar</em></div>
      <div><b>Sans Texto</b><span>6 estilos · inativa</span><em>Ativar</em></div>
      <div className="fx-aviso"><b>Conflito de nome</b><span>Outra Sans Texto já está ativa</span><em>Ver diferença</em></div></div></div></div>
      </div>
      </section>

      <section className="pg-sec" style={{ paddingTop: "0", borderTop: "0" }}>
      <div className="pg-wrap points"><div><i>01</i><b>Local primeiro</b><span>Funciona sem internet e sem conta.</span></div><div><i>02</i><b>Originais intactos</b><span>Importar não copia, não instala, não apaga.</span></div><div><i>03</i><b>Por marca</b><span>Kits e coleções por cliente.</span></div><div><i>04</i><b>Só o que existe</b><span>O que ainda não está pronto, dizemos.</span></div></div>
      </section>

      <section className="pg-sec">
      <div className="pg-wrap">
      <div className="sec-head"><p className="eyebrow">O que o beta faz hoje</p><Titulo className="h2" partes={["Doze recursos que já funcionam."]} /></div>
      <ul className="fx-grid">
        {RECURSOS.map((r) => (<li key={r.t}><b>{r.t}</b><span>{r.d}</span></li>))}
      </ul>
      </div>
      </section>

      <section className="pg-sec">
      <div className="pg-wrap">
      <div className="feat-row">
      <div>
      <p className="eyebrow">Em desenvolvimento</p>
      <Titulo className="h2" partes={["O que vem a seguir."]} />
      <p className="body">Nada desta lista está no beta. Está no roteiro, nesta ordem de prioridade, e só entra no site como pronto depois de testado.</p>
      </div>
      <ul className="fx-next">
        {EM_DESENVOLVIMENTO.map((e) => (<li key={e}>{e}</li>))}
      </ul>
      </div>
      </div>
      </section>

      <section className="pg-sec">
      <div className="pg-wrap">
      <div className="sec-head"><p className="eyebrow">Comparação honesta</p><Titulo className="h2" partes={["Frente ao FontBase, o concorrente mais forte."]} /></div>
      <div className="fx-tab" role="table" aria-label="Brennimark Fonts comparado ao FontBase">
        <div className="fx-tr fx-th" role="row"><span role="columnheader">&nbsp;</span><span role="columnheader">Brennimark Fonts (beta)</span><span role="columnheader">FontBase</span></div>
        {COMPARACAO.map((l) => (
          <div className="fx-tr" role="row" key={l.item}>
            <span className="fx-item" role="rowheader">{l.item}</span>
            <span role="cell" data-melhor={l.nota === "fonts" ? "" : undefined}>{l.fonts}</span>
            <span role="cell" data-melhor={l.nota === "outro" ? "" : undefined}>{l.outro}</span>
          </div>
        ))}
      </div>
      <p className="fx-fonte">Destacado = quem leva a vantagem na linha. Dados do FontBase vêm do site público dele em 14/10/2026 e podem ter mudado; não testamos o aplicativo dele a fundo. Hoje o FontBase tem mais recursos prontos e roda no Linux. Nossa aposta é a fonte ligada à marca: kit por cliente, ativação com controle de conflito e o manual da marca no mesmo lugar.</p>
      </div>
      </section>

      <section className="pg-sec">
      <div className="pg-wrap">
      <div className="sec-head"><p className="eyebrow">Beta e instalação</p><Titulo className="h2" partes={["O que esperar ao instalar."]} /></div>
      <div className="steps"><div className="stp"><b>Beta gratuito, por convite</b><p>Só os 50 primeiros pedidos aprovados, em macOS e Windows. Cada convite vale 90 dias. Pode ter falhas e mudar. Linux vem depois.</p><small>90 dias</small></div><div className="stp"><b>Aviso do sistema</b><p>O instalador ainda não é assinado. O macOS e o Windows vão avisar que a origem não é verificada; a seção de perguntas mostra o passo a passo.</p><small>Esperado</small></div><div className="stp"><b>Lançamento oficial</b><p>Vem em breve, com instalador assinado e licença anual. Terminados os 90 dias, quem testou passa para a versão paga em condição de lançamento, a anunciar.</p><small>Em breve</small></div></div>
      </div>
      </section>

      <section className="pg-sec">
      <div className="pg-wrap faq">
      <div><p className="eyebrow">Perguntas</p><Titulo className="h2" partes={["Sobre o beta."]} /></div>
      <div>{PERGUNTAS.map((q, i) => (<details key={q.p} open={i === 0}><summary>{q.p}</summary><p>{q.r}</p></details>))}</div>
      </div>
      </section>

      <section className="pg-sec">
      <div className="pg-wrap">
      <p className="eyebrow">Veja também</p>
      <div className="related"><Link className="rel" href="/materiais"><small>Plataforma</small><b>Materiais da marca</b><span>O kit inteiro num clique, com a regra junto.</span><em>→</em></Link><Link className="rel" href="/licenca-de-fontes"><small>Institucional</small><b>Licença de fontes</b><span>A fonte da marca e a licença dela.</span><em>→</em></Link><Link className="rel" href="/agencias"><small>Para quem</small><b>Agências e estúdios</b><span>A marca entregue pronta para usar.</span><em>→</em></Link></div>
      </div>
      </section>
    </>
  );
}
