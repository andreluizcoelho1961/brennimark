# Prévia visual do site Brennimark

Ensaio navegável da direção “manual vivo”, feito para avaliação do André em 03/10/2026. Mantém os 13 capítulos e o conteúdo do site na base `441a236a7614bd28e3009e2108878e4d857699a0`, acrescentando o capítulo “Num só lugar”.

A página é estática e independente da aplicação. Não acessa banco, autenticação ou IA. O botão de demonstração abre um diálogo explícito de prévia, com acesso ao site publicado. Links de páginas internas apontam para o site publicado. Depoimentos continuam identificados como fictícios; valores comerciais continuam em definição.

## Abrir

Na raiz do repositório:

```sh
python3 -m http.server 4178 --bind 127.0.0.1 --directory preview/site-vanguarda
```

Abra `http://127.0.0.1:4178`. No desktop, use roda do mouse, setas de capítulos ou links. No celular, a leitura é vertical.

## Regenerar

Com as dependências do projeto instaladas:

```sh
node preview/site-vanguarda/gerar.cjs
```

O gerador renderiza os componentes versionados da home como HTML estático. Os adaptadores de Image e Link servem apenas para essa exportação. `base.css` é uma cópia do CSS do site; as mudanças ficam em `previa.css` e `previa.js`, sem tocar na implementação publicada. A foto 37 e as páginas p1, p6 e p9 vêm do protótipo próprio do Brennimark; os demais assets vêm do código versionado. Nenhum material de marca de terceiro foi utilizado.

## Revisão realizada

- Desktop em 1440 × 900: abertura, frase tipográfica, plataforma, Vini, planos e menu.
- Mobile em 390 × 844: mensagem e botões antes da foto; sem transbordamento horizontal da página.
- Navegação por âncoras, avanço, retorno, menu e diálogo de demonstração.
- Redução de movimento prevista em CSS e JavaScript; sem envio de dados.
- Sintaxe do gerador e do JavaScript validada com `node --check`.

As telas do produto reutilizam os estudos de interface existentes da home, identificados como estudos. Esta é uma prévia de direção de arte, não uma validação funcional das capacidades exibidas. Não é aceite de Safari, Firefox ou aparelhos físicos. A fonte usa Inter quando disponível, com fallback para Helvetica/Arial local.

## Seção “Num só lugar”

As páginas do manual ocupam o fundo inteiro, com máscara em Noite Polar e troca por dissolução. Todos os títulos do ciclo usam a mesma escala tipográfica, inclusive “Num só lugar”. No celular, a frase pode quebrar em linhas sem reduzir a letra. As abas escolhem a página e suspendem temporariamente o ciclo; Pausar/Retomar controla a troca automática. A troca só acontece com a seção visível e respeita redução de movimento.
