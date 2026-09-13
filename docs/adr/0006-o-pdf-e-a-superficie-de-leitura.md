# ADR-0006 — O PDF é a superfície de leitura do manual

- **Status:** **aceito**
- **Data:** 12/09/2026
- **Decidido por:** André, na conversa registrada em
  `docs/brainstorm/2026-09-11-o-pdf-como-manual.md` (§7, §12 resposta 1, e a resposta de 12/09
  sobre as imagens de página)
- **Relaciona-se com:** ADR-0002 (modos e capacidades), ADR-0005 (curadoria editorial) e o
  Marco B (`docs/plan/marco-b-estado-2026-09-10.md`), que pôs o visualizador por intervalos e o
  manifesto por página em produção

## 1. Contexto

Até aqui o produto exibia o **mesmo manual em duas versões**: o PDF que o assinante enviou, no
destino "Manual original", e as páginas que a máquina remontava a partir da extração, que eram a
porta de entrada de `/docs`.

A remontagem é uma **interpretação**. No manual de 743 páginas ela produziu 122 seções e nomes
como `Páginas 9–16` — que é a recusa correta de nomear o que não tem nome no arquivo, e ainda
assim é uma lista que compete com o sumário que o documento já tem. A plataforma também não
hospeda a fonte licenciada da marca (ver CLAUDE.md), então a página remontada sai com fonte
substituta, o que um diretor de arte percebe na hora.

O manual é o oráculo da marca: ele não pode mostrar algo que não é válido. Exibir a interpretação
no lugar do documento aprovado é o risco maior que o produto pode correr.

## 2. Decisão

**O PDF enviado pelo assinante é a superfície de leitura do manual.**

1. `/docs` passa a levar ao PDF (`/docs/original`), e não à primeira seção remontada.
2. A área "Manual" da navegação fica com **um** destino, rotulado "Manual". "Manual original" e
   "Visão geral" viravam dois nomes para a mesma coisa depois do redirecionamento.
3. As seções extraídas **saem da navegação** — da coluna do desktop e da gaveta do mobile.
4. **A importação deixa de renderizar as páginas visuais como imagem.**

## 3. O que NÃO muda

- **A extração continua existindo.** Ela alimenta a busca, o assistente e os prompts, e as URLs
  das seções continuam válidas: link compartilhado é promessa. Ela deixou de ser a porta, não
  deixou de existir.
- **A curadoria e o rascunho continuam como o ADR-0005 definiu.** A conversa de 11–12/09 propõe
  substituir o estado editorial por etapa do documento ("em revisão" e "publicado"), e isso
  **contraria** o ADR-0005 §6, `src/content/visibilidade.ts` e o status `ready | draft | pending`
  do CLAUDE.md. **Não é objeto deste ADR** e exige um ADR próprio.
- `NavegacaoDeDocumentos`, `documentos.ts` e `defaultDocSlug` permanecem no repositório, com
  testes, para a superfície de curadoria do Studio.

## 4. Consequências

**Ganhos.** Fidelidade à diagramação que o estúdio aprovou; fim da duplicação; e a economia
medida em 12/09/2026, no manual de 47 páginas com 25 visuais: **45 s** de conversão do canvas em
PNG, **23 s** de envio e **33,9 MiB** por importação — oito vezes o tamanho do próprio PDF, num
plano cujo Storage inteiro é 1 GB.

**Perdas, ditas por inteiro.**

- Numa importação nova, a página de uma seção visual-dominante fica **sem imagem**. Ela continua
  roteável e na busca, mas quem abrir aquele endereço vê o pouco texto que a página tinha. As
  marcas importadas antes disto mantêm as imagens que já subiram.
- Leitura em celular em pé depende de zoom. O André registrou que celular **não é requisito
  principal** e que o modo "ler como texto" fica como possibilidade, não como frente de largada.
- Manual que é só imagem, sem texto extraível, continua deixando o assistente sem base. É raro, e
  não vira caso principal.

## 5. Reversibilidade

**Barata, e por isso a decisão pôde ser tomada agora.** É mudança de frontend: nenhum dado é
apagado, a extração continua sendo feita e as seções continuam no banco. Se o PDF-principal
decepcionar, a remontada volta a ser a porta sem perda de dado.

A geração de imagens é o único ponto com efeito no que se grava, e ela também fica guardada:
`renderizarPaginasComoImagem` continua em `src/lib/import/pdf.ts`, com teste. Se voltar, a
medição de 12/09 já diz por onde — **WebP em vez de PNG** (11,2 s e 7,6 MiB no mesmo manual, com
diferença de cor média abaixo de 1/255) e envio em paralelo, que atacaria os ~16 s de custo fixo
dos pedidos sequenciais.

## 6. Como fica a leitura, na prática

O índice lateral usa os **marcadores** que o estúdio exportou do InDesign (`getOutline()` do
PDF.js) quando eles prestam, e as seções extraídas quando não.

**Correção de 13/09/2026 — a ordem aqui estava invertida.** Este parágrafo dizia que os marcadores
seriam a fonte primária e as seções o plano B. O censo de **30 manuais de marca reais** mostrou o
contrário: **só 7 trazem marcadores**, então em 3 de cada 4 o índice vem da extração. E ter marcador
não é ter índice bom — um dos manuais tem quatro, chamados "SECTION 1" a "SECTION 4", para 37
páginas; outro tem 592 marcadores em 7 níveis, com 5 destinos que não resolvem.

O que foi construído (entrega 1b) descarta título genérico, destino que não resolve e o terceiro
nível em diante, exige três itens úteis para preferir os marcadores, e **diz na tela de onde o
índice veio**. O texto acima descrevia o plano; este parágrafo descreve o que existe.

## 7. Verificação

- `npm run verify` completo em cada entrega.
- O redirecionamento `/docs` → `/docs/original` exige marca resolvida e **não é coberto pela
  suíte**, que roda sem banco: precisa de conferência na bancada com banco local e depois em
  produção.
- `e2e/navegacao-do-manual.spec.ts` tranca as três garantias desta decisão: o destino do manual
  aponta para o PDF, a lista de seções não volta por acidente, e uma seção fora da barra continua
  alcançável pela busca.
- `e2e/importador-aba-oculta.spec.ts` perdeu metade do assunto e ficou com a outra metade. Ele
  nasceu do congelamento medido em 10/09 (~23 min de publicação com a aba oculta, porque o
  desenho da página esperava quadro de animação). Sem renderização, não há o que congelar: o caso
  deixou de exigir imagens enviadas — asserção sobre zero imagens seria teatro — e continua
  exigindo o que ainda é garantia do produto, **publicar não depende de a aba estar à vista**. Se
  a renderização voltar, a asserção volta com ela; a nota no próprio arquivo diz isso.
