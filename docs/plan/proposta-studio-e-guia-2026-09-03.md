# Proposta — Studio, Guia da Marca e Assistente unificado

Fase B do briefing de direção de produto. **Proposta para revisão, não
implementação.** Nada aqui foi construído.

Caso de desenho: a marca **GE**, importada de verdade — 743 páginas, 122 seções,
todas em rascunho, um único grupo chamado "Manual", página de entrada
`what-s-new`, e títulos como `Páginas 9–16`.

---

## 1. O problema, dito com o caso na mão

Hoje a coluna da GE mostra, nesta ordem: Manual › Visão geral, as 122 páginas em
lotes de 12, e depois Consultar, Acervo e Conta. Antes de ontem os oito destinos
de produto vinham primeiro; agora o manual vem, e apareceu o efeito colateral:
**as ferramentas ficaram abaixo de doze itens de conteúdo mais um "ver mais".**

Isso não se resolve reordenando de novo. As duas coisas disputam a mesma coluna
porque o produto tem um único eixo de navegação para duas atividades diferentes:
governar a marca e consultar a marca.

A separação Studio / Guia é a resposta certa, e o que segue é como ela cai nas
rotas e nos componentes que já existem.

---

## 2. Mapa de informação

### Guia da Marca — quem consulta

```
/g                          marcas disponíveis (cards)
/g/<marca>                  o manual: entrada
/g/<marca>/<pagina>         uma página
/g/<marca>/assets           acervo autorizado
                            (busca: ⌘K, em qualquer lugar)
                            (assistente: botão fixo, canto inferior direito)
```

Quatro destinos. Nenhum instrumento de Studio aparece aqui — nem desabilitado,
nem escondido atrás de permissão: **ausente**.

### Studio — quem governa

```
/studio                     portfólio de marcas (cards, com estado editorial)
/studio/importar            importar manual
/studio/<marca>             a marca no Studio: visão editorial
/studio/<marca>/curadoria   a fila de rascunhos e a estrutura
/studio/<marca>/assets      gestão de assets
/studio/pessoas             pessoas e permissões
/studio/ia                  conexões, perfis e consumo
/studio/configuracoes       conta
```

### A regra que evita a segunda cópia do manual

O briefing pede: "ao entrar numa marca pelo Studio, o mesmo manual pode ganhar
ações contextuais de edição, sem criar uma segunda cópia visual".

Proposta: **uma rota só para o manual**, `/g/<marca>/<pagina>`, e o Studio
**empresta** as ações. Quem tem `editar` vê uma barra de ações contextual sobre
a mesma página — não uma tela diferente. Concretamente: `DocPage` continua
sendo o único renderizador; o que muda é um adorno acima dele.

O contrário — `/studio/<marca>/<pagina>` renderizando o manual de novo — cria
duas telas que precisam concordar para sempre, e elas divergem no terceiro mês.

---

## 3. Wireframes de baixa fidelidade

### Guia — desktop

```
┌──────────────────────────────────────────────────────────────┐
│ Brennimark   GE ▾                        ⌘K Buscar    pessoa │  barra
├────────────────┬─────────────────────────────────────────────┤
│ MANUAL         │                                             │
│  Fundamentos   │   ┌───────────────────────────────────────┐ │
│   Princípio    │   │                                       │ │
│   Missão       │   │   canvas da marca                     │ │
│  Marca         │   │   (tipografia e cor da GE)            │ │
│   Símbolo      │   │                                       │ │
│   Assinatura   │   │                                       │ │
│  Cor           │   └───────────────────────────────────────┘ │
│   Paleta       │                                             │
│  ...           │                    ┌───────────────────┐    │
│                │                    │ ✦ Assistente      │    │  botão
│ ─────────────  │                    └───────────────────┘    │  fixo
│ Assets         │                                             │
└────────────────┴─────────────────────────────────────────────┘
```

A coluna é **só o manual**, com os grupos que a curadoria produzir. "Assets"
fica abaixo de um filete, separado — é acervo, não capítulo.

Note o que sumiu: importar, administração, provedores de IA, histórico, análise.
Nada disso é do Guia.

### Guia — mobile

```
┌─────────────────────┐
│ ☰  GE ▾        ⌘   │
├─────────────────────┤
│                     │
│   canvas            │
│                     │
│                     │
│              ┌────┐ │
│              │ ✦  │ │   botão do assistente
│              └────┘ │
└─────────────────────┘
```

A gaveta abre o mesmo manual. O assistente ocupa a tela inteira quando aberto no
mobile — painel lateral em telefone é uma coluna de 40% que não serve para ler
resposta com citação.

### Studio — portfólio

```
┌──────────────────────────────────────────────────────────────┐
│ Brennimark · Studio            Importar marca        pessoa  │
├──────────────────────────────────────────────────────────────┤
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐  │
│  │ GE             │  │ Padaria        │  │ + Importar     │  │
│  │ 122 seções     │  │ 18 seções      │  │                │  │
│  │ ⬤ 122 rascunho │  │ ⬤ 2 rascunho   │  │                │  │
│  │ en · 743 pág   │  │ pt-BR          │  │                │  │
│  └────────────────┘  └────────────────┘  └────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

O card carrega o **estado editorial**, que é a informação que o Studio existe
para dar: quantas seções, quantas em rascunho, idioma, tamanho da origem. Um
card que só mostra o nome não vale a tela.

### Studio — curadoria

```
┌──────────────────────────────────────────────────────────────┐
│ GE › Curadoria            122 seções · 122 em rascunho       │
├──────────────────────────────────────────────────────────────┤
│ [ Todas ] [ Rascunho 122 ] [ Sem título real 37 ] [ Prontas ]│
├──────────────────────────────────────────────────────────────┤
│ ⠿  What's new?                    págs 1–8    RASCUNHO  ⋯   │
│ ⠿  Páginas 9–16                   págs 9–16   RASCUNHO  ⋯   │
│ ⠿  Brand architecture             págs 17–24  RASCUNHO  ⋯   │
│ ...                                                          │
├──────────────────────────────────────────────────────────────┤
│ 3 selecionadas   [Unir] [Mover para grupo…] [Promover]       │
└──────────────────────────────────────────────────────────────┘
```

O filtro **"Sem título real"** é a peça que a GE pede: 37 seções chamadas
`Páginas N–M` são exatamente a fila de trabalho, e listá-las é mais útil que
listar 122.

---

## 4. O Assistente unificado

Um botão, um painel, quatro modos internos — não quatro destinos.

```
┌───────────────────────────────┐
│ ✦ Assistente · GE         ✕  │
├───────────────────────────────┤
│                               │
│  ‹ conversa ›                 │
│                               │
│  A cor institucional é o      │
│  vermelho #E1251B.            │
│  ┌─────────────────────────┐  │
│  │ Cor · RASCUNHO          │  │   citação: documento,
│  │ págs 12–18              │  │   status e páginas
│  └─────────────────────────┘  │
│                               │
├───────────────────────────────┤
│ [📎] Pergunte sobre a marca   │
│      ou anexe uma peça     ➤ │
└───────────────────────────────┘
```

**Os modos não são abas.** Anexar imagem muda o que o assistente faz; pedir
prompt é uma frase. Abas fariam a pessoa escolher a ferramenta antes de saber o
que quer. O histórico é a própria conversa, rolando para cima.

O painel é **contextual à marca** e some ao trocar de marca — junto com o
histórico daquela conversa, que continua acessível no Studio.

O que ele preserva, sem exceção: marca ativa, fontes recuperadas, status
editorial inclusive rascunho, faixa de páginas, aviso honesto quando não há
evidência, e mensagem de produto quando a IA não está configurada.

---

## 5. Estados por papel

| | Guia | Studio | Assistente | Configurar IA |
|---|---|---|---|---|
| owner | vê | vê | usa | configura |
| editor *(não existe hoje)* | vê | vê, sem conta/IA | usa | não |
| member | vê | **não existe** | usa, se a marca permitir | não |
| sem papel | login | — | — | — |

**O papel `editor` não existe no banco.** `workspace_members.role` aceita
`owner` e `member`. Esta proposta depende dele, e criá-lo é decisão de esquema —
listada em §7.

Para `member`, o Studio não é uma área bloqueada: é uma área **inexistente**. A
rota responde 404, como as utilidades não contratadas.

---

## 6. Plano de migração das rotas

Nada é apagado de uma vez. Ordem proposta, cada passo mergeável:

| passo | de | para |
|---|---|---|
| 1 | — | `/studio` (portfólio) e `/g` (marcas), novas |
| 2 | `/w/<c>/b/<m>/docs/*` | `/g/<marca>/*`, com redirecionamento permanente |
| 3 | `/w/<c>/importar` | `/studio/importar` |
| 4 | `.../docs/admin` | `/studio/<marca>/curadoria` |
| 5 | `.../docs/configuracoes/ia` | `/studio/ia` |
| 6 | `.../docs/chat`, `/analise`, `/historico` | painel; rotas viram redirecionamento |

O passo 2 é o caro: `/w/<conta>/b/<marca>/` carrega conta E marca, e `/g/<marca>`
carrega só a marca. **Isso é uma decisão, não um detalhe** — ver §7.

Componentes que sobrevivem sem mudança: `DocPage` e os blocos, `BrandCanvas`,
`ListaDeSecoes` (vira a base da curadoria), `AppShellV2` (vira a moldura do
Guia), toda a camada de recuperação, `podeUsar` e as portas de página.

---

## 7. Decisões que precisam ser tomadas antes de implementar

Registradas porque implementar sem decidi-las é escolher por omissão.

**A conta sai da URL?** `/g/<marca>` é mais curto e é o que o briefing desenha.
Mas o slug da marca é único **por workspace**, não globalmente — duas agências
podem ter uma marca `padaria`. Ou o slug da marca vira global, ou a conta
continua na URL. É decisão de esquema com efeito em toda URL já compartilhada.

**O papel `editor`.** Sem ele, metade da tabela de §5 não é expressável.
Acrescentar um valor a `workspace_members.role` é barato; decidir o que ele pode
não é.

**Curadoria destrutiva.** Unir duas seções publicadas decide o destino de dois
slugs, dois históricos de versão e das citações já emitidas. Está detalhado no
ADR-0005 §5 e continua aberto.

**Promoção em massa.** 122 seções uma a uma ninguém faz; um botão "promover
todas" é como um manual inteiro vira "pronto" sem ninguém ler. Proposta:
promoção em lote **apenas sobre seleção explícita**, nunca "todas", e nunca para
seções ainda chamadas `Páginas N–M`.

**Assets no Guia.** "Acessar assets autorizados" implica que alguns não são. Não
existe hoje autorização por asset — `brand_assets` tem `status`, não visibilidade.

---

## 8. Critérios de aceite

**Funcionais**

1. Um `member` recebe 404 em qualquer rota `/studio/*`.
2. Nenhum instrumento de Studio aparece na navegação do Guia — verificado por
   ausência de destino, não por atributo desabilitado.
3. O manual é o primeiro conteúdo da coluna do Guia, medido por posição vertical.
4. O assistente preserva marca, citação, status e faixa de páginas em todos os
   modos, incluindo depois de anexar imagem.
5. Trocar de marca fecha o assistente e não carrega conversa da anterior — teste
   A → B → A, como o do A1.
6. Rotas antigas redirecionam preservando o caminho; nenhuma responde 404.
7. Sem IA configurada, o assistente mostra mensagem de produto e não aciona
   provedor nenhum.

**Visuais**

8. As quatro marcas opostas mantêm a moldura idêntica — o teste de pixel
   existente continua valendo, agora sobre a moldura do Guia.
9. A coluna do Guia não passa de dois níveis de hierarquia visual.
10. Em 390px, o assistente ocupa a tela inteira; em 1440px, é painel lateral que
    não cobre o canvas.
11. Evidência desktop e mobile de cada superfície nova, com a GE.

**De não-regressão** — o que a nova interface não pode desfazer: isolamento por
`brand_id`, RLS e papéis, citação com status e páginas, recusa honesta sem
evidência, limites de contexto, logs sem detalhe técnico, e recusa de rotas não
contratadas.

---

## 9. O que eu faria diferente do briefing

Uma coisa, e digo qual: o briefing coloca a curadoria na fatia 5 da Fase C,
depois do Studio. **Eu a faria antes do Assistente unificado.**

O motivo é a GE. Com 122 seções em rascunho e 37 chamadas `Páginas N–M`, o
assistente responde citando `Páginas 9–16` como fonte. A citação fica tecnicamente
correta e editorialmente inútil — e é a primeira coisa que um cliente vê. A
curadoria é o que torna o assistente apresentável, não um enfeite posterior.
