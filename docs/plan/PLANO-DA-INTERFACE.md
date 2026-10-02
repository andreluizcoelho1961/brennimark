# Plano da interface do Brennimark

**Status: VIGENTE desde 18/09/2026.** Este é o documento único do que se constrói, em que ordem, e
como se sabe que está pronto. Os dois chats (brainstorm e código) leem daqui. **Ele só muda com
decisão do André registrada na §6** — ideia nova não entra no meio de uma fatia; vai para o
estacionamento (§5) e é revista quando a fatia termina.

O detalhe de cada tela continua nas especificações (memória do projeto: `spec-menus`,
`spec-tela-manual`, `spec-materiais-da-marca`, `spec-assistente`, `spec-studio`, `spec-site`) e nos
ADRs. Onde divergirem deste plano, **vale este plano** até ser revisto.

---

## 1. O que o produto é — fechado

- **Assinatura por agência.** A conta nasce da compra (hoje: `private.abrir_conta_de_assinatura`).
  Não existe cadastro público — fechado no código e no painel do Supabase, conferido em 18/09.
- **Dois níveis de acesso.** Quem **administra** a conta alcança todas as marcas dela, inclusive as
  futuras, e concede acesso. Quem **consulta** alcança só as marcas concedidas, uma a uma.
- **Várias marcas por conta**, e uma pessoa pode estar em mais de uma conta.
- **O manual é o PDF** (ADR-0006). **Materiais da marca** é o acervo (ADR-0007). **Vini** é o
  assistente. **Complementos** são textos do assinante para o que o manual não cobre.
- **Studio e Book são as mesmas telas.** O que muda é o que aparece, e isso é decidido pela
  capacidade **na marca aberta**, não pelo login.

## 2. A moldura — fechada

Entrar é cair **dentro** da plataforma, como abrir o Illustrator: menus e ferramentas estão lá desde
o primeiro segundo, e o trabalho acontece no centro. **Não existem telas soltas** fora da moldura
(a única porta de fora é `/login`).

```
┌──────────┬──────────────────────────────────────────────────────────────┬──┐
│ ◇ LOGO   │ Manual │ Materiais │ Complementos    Índice  Buscar  Zoom •••│  │ ← barra do CONTEÚDO
├──────────┼──┬───────────────────────────────────────────────────────────┤ A│    da marca
│ ▦ Marcas │▸ │                                                           │ B│    (apagada sem marca)
│ ☰ Pessoas│m │                       CENTRO                              │ A│
│ ⧉ Regist.│i │   sem marca aberta → cartões das marcas (ou convite)      │  │ ← aba de capítulo
│ ⚙ Config.│n │   marca aberta     → o PDF, os Materiais, os Complementos │  │
│          │i │                                        ┌──────────────┐   │  │
│ coluna da│  │                                        │  Vini (chat) │   │  │
│PLATAFORMA│  │                                        └──────────────┘   │  │
│  (ícones,├──┴───────────────────────────────────────────────────────────┤  │
│  expande)│ 12 / 47 · ajustado · manual_v3.pdf                          │  │ ← fólio
└──────────┴──────────────────────────────────────────────────────────────┴──┘
```

| Zona | O que é | Regra técnica que decide se funciona |
|---|---|---|
| **Coluna da esquerda** | a plataforma: Marcas; e para quem administra, Pessoas e acesso, Links de entrega, Registros, Configurações | faixa de ícones que **expande ao passar o mouse, SOBREPONDO** o conteúdo — se empurrasse, o PDF seria redesenhado a cada passada; atraso de intenção; abre pelo teclado; rótulo acessível em todo ícone |
| **Barra de cima** | o conteúdo da marca: `Manual │ Materiais │ Complementos` e as ações da tela aberta; o resto no **•••** | **apagada** quando não há marca aberta |
| **Centro** | o canvas: Marcas, PDF, Materiais, Complementos, telas de gestão | gestão abre **painel pela direita**, com a lista visível atrás |
| **Tira de miniaturas** | à esquerda do PDF, recolhível | virtualizada, como hoje |
| **Fólio** | no pé: página, zoom, arquivo e versão | a página é o campo onde se digita |
| **Aba de capítulo** | borda direita, gerada pelo índice | nunca número inventado |
| **Vini** | janela flutuante no canto: recolhida, conversa, análise. **Todo contato com a marca por IA é aqui** — perguntar, analisar peça, gerar prompt; nada disso fica na coluna | não é modal; a citação `[P. 12]` leva o PDF à página |

**Referências de usabilidade** (princípios, não aparência): Adobe (o aplicativo com a mesa em volta
do canvas), Apple (deferência, uma ação principal por tela, lugar × ação, teclado), Supabase (coluna
que expande, gestão em painel lateral, tabelas limpas).

**Direção visual** (autoria do André): livro de design de marca dos anos 70 — Vignelli, Aicher,
design suíço —, com calor orgânico, para a pessoa se sentir acolhida e não num ambiente só técnico.
**Entra por tokens de desenho** (`--platform-*`), então aplicar o visual depois **não refaz** a
estrutura.

## 3. A ordem de construção

Cada fatia termina com o André **vendo a tela em produção**. Ajuste daquela mesma tela se faz na
hora; escopo novo vai para o estacionamento.

| # | Fatia | Pronto quando | Fora dela |
|---|---|---|---|
| **1** | **Moldura persistente** | entrar cai dentro da moldura; coluna de ícones que expande, com Marcas e (para quem administra) Pessoas e acesso, Links / Registros / Configurações marcados "em breve" quando não existem; barra de cima com o segmentado, apagada sem marca; centro mostra cartões, convite ou PDF; importar e Pessoas abrem **dentro** da moldura; "Biblioteca" vira "Materiais" | ações do PDF na barra, miniaturas, fólio, aba, Vini, submenus |
| **2** | **Pessoas: cadastro com senha provisória** | o administrador cadastra nome, e-mail, nível e marcas; o sistema gera a senha (rota de servidor, nunca no navegador), com troca obrigatória no primeiro acesso; a concessão guarda **nome** e **situação** (pendente, ativa, revogada) em vez de apagar | convite por e-mail (precisa de serviço de e-mail e domínio) |
| **3** | **O manual completo** | ações do PDF na barra de cima (Índice suspenso, Buscar, Zoom, •••); tira de miniaturas; fólio no pé; aba de capítulo; Baixar PDF com registro | Vini |
| **4** | **Vini** | janela flutuante em três estados; perguntar, analisar peça e gerar prompt no mesmo lugar; citação leva à página | geração de imagem |
| **5** | **Materiais da marca** | tela do acervo e página do item (Logotipo) no desenho novo; kit em ZIP no navegador; regra colada ao download | links de entrega, fontes (esperam o termo assinado) |
| **6** | **Visual** | as diretrizes do André aplicadas pelos tokens em todas as telas acima | — |
| **7** | **Ensaio** | dois usuários, cinco manuais, Studio e Book percorridos; sai uma lista de ajustes com evidência | — |

Depois do ensaio, na ordem: **Registros**, **Configurações** (o consumo já é medido), **Links de
entrega**, **Complementos**, **Site público**. A **cobrança** (assinatura paga) entrou em 01/10 e
tem mapa próprio: [`cobranca.md`](./cobranca.md).

## 4. Regras que valem em toda fatia

- Banco e autorização: prova negativa como **usuário comum** (não superusuário), `revoke all`
  explícito em tabela nova, migration aplicada em produção só com autorização nominal.
- `npm run verify` inteiro antes de todo push.
- Interface decide o que **aparece**; o banco decide o que é **permitido**.
- A página do manual nunca é alterada nem invertida pelo produto.
- Marcas de demonstração são fictícias ou de manuais públicos; nada de material de terceiro no
  repositório.

## 5. Estacionamento

Ideias boas que chegam no meio de uma fatia. Revistas ao fim de cada uma, com o André.

| Data | Ideia | Origem |
|---|---|---|
| 18/09 | Prazo de sessão: hoje uma sessão aberta vale indefinidamente enquanto for usada | ensaio |
| 18/09 | A importação sugeriu Português para manual em inglês — detectar o idioma do PDF. **25/09:** manual em português (Heineken) veio `pt-BR`, certo; o caso do inglês ainda não foi reconferido | ensaio |
| 18/09 | "Só quem administra a conta pode importar" aparece para quem administra | ensaio |
| 18/09 | ~~Tema claro e escuro da moldura (a página do manual nunca inverte)~~ — **feito na fatia 6** (#37) | spec-menus §8.9 |
| 18/09 | ~~O chat mostra Markdown cru (`###`, `**`)~~ — **resolvido**: a janela do Vini formata (fatia 4) e o último caso, negrito dentro de itálico, saiu no #39 (25/09) | ensaio |
| 18/09 | Login criado por uma conta não recebe acesso de outra até existir confirmação de e-mail (convite): um fornecedor de duas agências precisa esperar o convite | fatia 2 |
| 18/09 | ~~O aviso "N páginas ficaram sem seção… a curadoria atribui depois" aparece para quem só consulta; é informação de quem edita~~ — **resolvido na fatia 3**: os três avisos de registro e curadoria só aparecem para quem tem `editar` | ensaio (fatia 2) |
| 18/09 | ~~Faixa branca na borda direita da página do PDF no visualizador~~ — **resolvido em duas partes**: (1) havia defeito real, corrigido na fatia 3 — a moldura esticava à coluna com o recuo (961 px) e o desenho tinha a largura sem ele (937 px), 24 px de branco à direita; teste de navegador tranca. (2) O filete fino que continuou na capa da Sony Vaio **é do próprio PDF**: o Pré-Visualização do Mac mostra o mesmo (André, 24/09). A página do cliente não se altera | ensaio (fatia 2) |
| 23/09 | ~~**Apagar o login de quem já recebeu acesso falha**~~ — **resolvido em 24/09** (migration `conta_removida`): eram 11 chaves sem regra de exclusão e o registro de acesso gravando uma linha para o login que sumia. Ver a decisão de 24/09 na §6 | prova da 4d |
| 18/09 | Busca por significado ("primary color" achar "cluster colours" sem palavra em comum). Exige escolher provedor de *embeddings* — decisão de provedor e de custo, do André | ensaio |
| 24/09 | ~~**Envio de material acima de ~4,5 MB falha em produção**~~ — **resolvido em 24/09**: o arquivo vai do navegador direto ao Storage, por endereço assinado para um caminho só; a rota prepara (escolhe o caminho, assina a autorização) e conclui (confere bytes e tamanho reais, registra). Testado contra o Storage real com 6 MB. ~~**Fica:** envio abandonado no meio (aba fechada entre enviar e concluir) deixa arquivo órfão na pasta da marca — sem registro, sem download, ocupa espaço até uma limpeza periódica existir~~ — **limpeza escrita em 24/09, PR #36** (migration `limpeza_de_material_orfao`, rota `/api/manutencao/materiais-orfaos`, Vercel Cron diário). ~~**Não está no ar**~~ — **no ar desde 25/09**: migration aplicada e `CRON_SECRET` criada pelo André | fatia 5 |
| 24/09 | **Previews da Vercel sem banco**: as variáveis do Supabase só existem em Production. Decisão do André: por ora conferir em produção após o merge; **fase comercial: banco separado só para previews** | fatia 3 |
| 26/09 | ~~**Texto repetido em toda página** (o menu lateral do manual) entra na busca e casa com qualquer pergunta: "logotipo" trazia "Estilo fotográfico" no topo~~ — **resolvido em 02/10**: a importação tira o texto que se repete **no mesmo lugar** em 60% das páginas, antes de montar as linhas (o menu fica na mesma altura do corpo). No Bradesco, o menu era ~30% do texto; linhas com "estilo fotográfico" caíram de 49 para 8; oito outros manuais perderam só cabeçalho, rodapé e número de página. **Vale para importações novas**: manual já importado precisa ser importado de novo | ensaio (fatia 7) |
| 26/09 | ~~**Títulos de seção da importação**: duas manchetes da mesma página viram um título ("Logo horizontal Logo vertical"), e texto de exemplo esquecido no manual vira seção ("XXxxxxxx")~~ — **resolvido em 02/10**: a linha guarda onde há vão de coluna, e o título mostra as manchetes separadas ("Logo horizontal · Logo vertical"); "XXxxxxxx" e "lorem ipsum" não viram título. Conferido no Bradesco (o manual do ensaio) e em mais quatro. **Vale para importações novas.** Observado junto: o Bradesco tem um título por página ("Grid" dez vezes seguidas, cada uma uma seção) — juntar seções vizinhas de mesmo título fica para decidir | ensaio (fatia 7) |
| 26/09 | ~~Quem consulta **uma marca só** passa por "Escolha uma marca" com um cartão~~ — **resolvido em 02/10**: quem não administra conta nenhuma e tem uma marca só cai direto no manual; quem administra continua com a tela inicial (decisão de 12/09). Mostrar as outras marcas apagadas foi considerado e recusado: revelaria ao cliente os outros clientes da agência (ADR-0002) | ensaio (fatia 7) |
| 26/09 | ~~**Passada visual do ensaio**: tema escuro e celular em todas as telas~~ — **feita em 26/09**: campos de 16 px no toque, fólio sem quebra (#44) e o manual nítido no celular (#45) | ensaio (fatia 7) |
| 26/09 | **Pessoas em cartões no celular** (hoje a tabela rola dentro do próprio quadro) | passada visual |
| 27/09 | **Gerar as imagens de leitura já na importação**, em vez do botão "Preparar o manual para o Vini" | #50 |
| 27/09 | ~~**A IA sugerir a ficha da paleta** a partir da imagem da página, sempre como rascunho para uma pessoa conferir~~ — **feito em 27–28/09** (#54–#58): sugestão pela IA, conferência contra o texto do manual e "Aprovar as conferidas" | #51 |
| 27/09 | **Aprovar sem administrar**: tela para quem só consulta e aprova (o dono da marca). O banco já aceita, pela função de aprovação | #51 |
| 27/09 | **Cache de prompt** na fase paga: o manual inteiro se repete a cada pergunta | #47 |
| 28/09 | **Razão de custos × imagens**: uma sugestão com 4 imagens registrou 283 tokens de entrada (as outras, ~4.700). Conferir a contagem antes da fase paga | ensaio (fatia 7) |
| 24/09 | Materiais — fica para depois: fotos e ilustrações em **álbum com pastas**; **fontes** (esperam o termo); **links de entrega**; **geração automática de paleta** (pergunta 66 — a ficha da paleta, #51, é a base dela) | fatia 5 |

## 6. Registro de mudanças deste plano

| Data | Mudança | Decidido por |
|---|---|---|
| 18/09/2026 | Criação, consolidando as decisões de 17 e 18/09 e o esboço da moldura | André |
| 18/09/2026 | Chat, análise e histórico **saem da coluna já na fatia 1**. O botão do Vini entra no canto inferior direito como **lançador** (lista que leva às telas existentes); a janela de três estados continua sendo a fatia 4 | André |
| 18/09/2026 | Correção fora da ordem: a busca de trechos passa a aceitar grafia americana/britânica e, sem trecho com todas as palavras, qualquer uma delas. O chat afirmava "não documentado" sobre manual que documenta | André |
| 18/09/2026 | **O Vini vem antes do manual completo.** O lançador "cai numa outra janela" e ficou sem sentido. A fatia 4 se divide em 4a (janela e conversa, citação que abre o PDF na página), 4b (analisar peça na janela), 4c (gerar prompt) e 4d (histórico guardado, por autor — muda o banco) | André |
| 22/09/2026 | **4a confirmada em produção** (citação leva o PDF à página). **4b**: a peça entra pelo clipe ou solta na janela; a janela alarga (~600 px) e a análise aparece nela, com o veredito como única cor forte e a citação levando à página. A janela fica em Análise até a pessoa voltar à conversa — sair sozinha ao terminar esconderia o resultado. A tela antiga de análise continua só para "repetir" a partir do histórico, até a 4d | André |
| 22/09/2026 | **Baixar a análise como imagem (PNG)**: a peça intacta, o carimbo do veredito e as correções numeradas com fonte, página e status. Nada desenhado SOBRE a peça — a análise diz o que está errado, não onde; marca na peça só onde o sistema souber a posição (a cor, pelos pixels), em outra fatia | André |
| 23/09/2026 | **4c — o copiloto de criação** no Vini: a pessoa descreve a peça, vê as regras (aprovadas entram sozinhas; rascunhos só marcados), e o prompt sai com a lista do que usou e o aviso quando usa rascunho. O servidor decide o que o modelo recebe — rascunho não marcado nem chega a ele. Guardar os prompts gerados (ADR-0004 §3.5) vai com o histórico por autor, na 4d | André |
| 23/09/2026 | **IAs de reserva: em fila, principal + 2, de provedores diferentes**, construídas junto da "IA da plataforma" (chaves no servidor do Brennimark, sem tela por conta). Achado: o campo "IA de reserva" da tela atual não funciona — a execução usa só a principal, porque o orçamento é reservado a um preço só; trocar de IA pede reservar de novo ao preço da próxima. A tabela de política tem lugar para UMA reserva: mais exige migration | André |
| 23/09/2026 | **Fase de testes só com IAs gratuitas; pagas só na fase comercial.** Condição: plano gratuito do Google usa o conteúdo para treinar — só manual público (ex.: Sony Vaio) nos testes; **nenhum manual de cliente real antes da troca para plano pago**, item obrigatório da passagem à fase comercial. Opções pagas pesquisadas para depois: Gemini 3.6 Flash → gpt-5-mini → Claude Sonnet 5 | André |
| 23/09/2026 | **Fila dos testes: Gemini 3.6 Flash (principal) → Groq `qwen3.8-27b` (reserva).** O Groq não treina com os dados por contrato (§4.2), nem no gratuito; ~8 mil tokens/min basta para reserva ocasional, não para principal. Construída sem migration: a política já tinha a vaga de UMA reserva, e a execução passou a reservar de novo pelo preço de cada tentativa. A 2ª reserva fica para a fase comercial | André |
| 23/09/2026 | **Prompt de imagem sempre termina com "nenhum texto além do logotipo"**, salvo quando a descrição pede texto. Origem: a imagem do ensaio inventou "Good Ideas Brighter Days" numa caneca | André |
| 23/09/2026 | **4d — conversas por autor**: o Vini guarda cada troca (e cada prompt gerado, com as regras que usou) na conversa da pessoa, por marca. Ninguém mais lê — nem quem administra a conta, nem a equipe do Brennimark (pergunta 72). Apagar é de verdade, e continua possível depois de perder o acesso à marca (LGPD). O histórico de análises continua da marca | André |
| 23/09/2026 | **Download do manual registrado em tabela própria, `downloads_do_manual`** — mesmo desenho de `brand_asset_downloads` (o banco preenche pessoa, e-mail, marca e arquivo; só quem administra a marca lê; ninguém reescreve), separada porque aquela é presa a asset. Registra o download INICIADO pelo botão, não a leitura. Fatia 3 começa: ações do PDF na barra de cima (≥ 1024 px; abaixo, faixa sobre o PDF), fólio, aba de capítulo, busca que leva à página | André |
| 24/09/2026 | **Fatia 5 (Materiais) — duas mudanças de banco aprovadas:** o item guarda as **páginas do manual que o regem** (até 5; quem edita escolhe; a tela cita título, status e página); a variante guarda uma **miniatura PNG** gerada no navegador de quem envia — a prévia de um SVG seria o próprio arquivo, fora do registro de download. Kit em ZIP montado no navegador (biblioteca fflate), registrado arquivo por arquivo antes de sair | André |
| 24/09/2026 | **LGPD — o que fica de quem teve o login apagado:** (1) autoria e trilhas ficam e a autoria vira "conta removida" (material, item, manual importado, documento, consumo de IA, concessões dadas); (2) as cópias de e-mail nos registros viram **apelido anônimo e estável** (`conta-removida-7f3a2c@removida.invalid`, na tela "Conta removida · 7F3A2C"); (3) as **análises de peça ficam com a marca** (antes sumiam junto). Continua sumindo: perfil, participações, conversas. A concessão PARA a pessoa termina. Tela de "excluir minha conta" fica para depois; hoje a exclusão é pelo painel do Supabase. Não é parecer jurídico: confirmar com quem cuida da parte legal | André |
| 24/09/2026 | **Fatia 6 (Visual) — decisões do André sobre a folha de tokens:** tipografia **Inter Tight** (grotesca neutra, linhagem Helvetica) com **IBM Plex Mono** em números e códigos; tema **claro "papel" como padrão** e **escuro "estúdio" como opção** de quem usa (botão ◐ na barra de cima, escolha guardada no navegador, aplicada antes da primeira pintura); **cantos pequenos e delicados** (3 px controle, 4 px painel, 6 px cartão). Moldura acromática (ADR-0004): o calor vem da temperatura dos cinzas. Contraste AA (≥ 4,5 : 1) de todo texto nos dois temas vira teste. A página do manual nunca inverte | André |
| 25/09/2026 | **Ensaio (fatia 7), primeira rodada** — relatório em [`ensaio-2026-09-26.md`](./ensaio-2026-09-26.md). Nome da marca editável e **botão de apagar marca** (#38); o Vini **dá os valores técnicos** — recorte do trecho onde a pergunta está, e regra de nunca trocar o valor por "veja a página" (#39). **Heineken apagada**: o manual se declara confidencial, e com IA gratuita não entra | André |
| 26/09/2026 | **Sinônimos de manual de marca na busca** (#40, migration só da função): logotipo/logo, principal/preferencial, proteção/respiro, tipografia/fonte… em pt e en. A busca por significado continua estacionada. Também: copiar a senha provisória avisa (#41); item com um arquivo baixa direto, sem ZIP (#42) | André |
| 26/09/2026 | **O Vini lê o manual inteiro quando cabe** e raciocina sobre ele — conta, compara, junta páginas, conclui citando (#46–#48); sobrecarga do Gemini tenta de novo antes da reserva (#49). Motivo do André: a agência paga R$ 2.500/mês, e uma busca por palavras não passa por inteligência | André |
| 27/09/2026 | **A e C** — o Vini **vê as páginas** (#50: imagem de leitura, JPEG ~1.600 px gerado no navegador de quem edita; o ADR-0006 ganha adendo) e a **ficha da paleta** (#51: cor como dado, editar e aprovar separados pelo banco; para cores o Vini responde pela ficha). Motivo: com o texto, o Vini contou 6 cores onde o Bradesco tem 19 | André |
| 28/09/2026 | **Ficha da paleta de ponta a ponta** (#54–#59): a IA sugere as cores lendo as páginas; cada cor guarda a **origem** (pessoa ou IA) e a sugestão só acrescenta o que falta; cada código é **conferido contra o texto do manual**; opção A — a conferida continua rascunho e "Aprovar as conferidas" é um clique de uma pessoa. Bradesco: 19 cores sugeridas, 18 conferidas, o branco apontado na p. 22 | André |
| 30/09/2026 | **Configurações › Consumo** (a primeira parte da seção; Plano e Aceites aparecem "em breve"): o assinante vê o **uso** do Vini por marca (perguntas, análises, prompts), o **armazenamento** por marca e **quanto do teto da conta já foi usado**, no dia e no mês — **nunca dinheiro**. O custo é estimativa pelo preço de tabela, na fase de testes nada foi cobrado, e os planos ainda não têm valor. "IA" não entra na seção (ADR-0008). Só quem administra a conta vê; quem lê o quê é o banco (`scripts/prova-consumo-da-conta.sh`) | André |
| 30/09/2026 | **Links de entrega** (ADR-0007 §2.5) — desenho do banco aprovado pelo André: `links_de_entrega`, `arquivos_do_link` e `acessos_de_link`, com duas funções para quem administra (criar, revogar) e duas só da chave de serviço para o link público (abrir, registrar). Decisões: **prazo de 7 dias por padrão, 30 no máximo**; quem baixa se identifica com **nome e e-mail autodeclarados**; a regra vai junto como **imagem das páginas que regem cada item** (nunca o manual inteiro); arquivo substituído → o link entrega **a versão atual**. O banco guarda só o SHA-256 do código: o endereço aparece **uma vez**, na criação. Fonte nunca vai por link. Prova: `scripts/prova-links-de-entrega.sh` | André |
| 01/10/2026 | **Complementos** (direção §20) — desenho do banco aprovado pelo André: **tabelas próprias**, separadas das seções do manual (`complementos`, `rascunhos_de_complemento`, `versoes_de_complemento`, `trechos_de_complemento`), para reimportar o manual nunca tocar num complemento; **histórico só para consulta** (restaurar fica para depois). O terceiro segmento `Manual │ Materiais │ Complementos` sai do "em breve". Quem edita escreve em Markdown com prévia, salva rascunho e **publica — publicar é aprovar** (decisão 75); arquivar tira da leitura e do Vini sem apagar. O **Vini (chat)** lê os publicados como fonte própria e cita "Complemento: título"; o manual é o cânone, e se os dois tratam do mesmo assunto ele cita os dois. Fica para depois: a análise de peça e o gerador de prompt lerem complementos, e o relatório "perguntas que o manual não responde". Prova: `scripts/prova-complementos.sh` | André |
| 01/10/2026 | **Cobrança com Stripe**, para vender no mundo inteiro desde o início. Regra: pagou, entrou. Com atraso, 7 dias de tolerância e depois só leitura, sem apagar nada. Desenho do banco aprovado; mapa e fatias em [`cobranca.md`](./cobranca.md) | André |
| 02/10/2026 | **Quem só consulta uma marca entra direto no manual.** Exceção à tela inicial sempre (12/09), só para quem não administra conta. A ideia de mostrar todas as marcas da conta com as sem acesso apagadas foi recusada para o cliente: revelaria a carteira da agência | André |
