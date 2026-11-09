# Lista de conferência de lançamento

Escrita em 29/10/2026, atualizada em 30/10/2026. Marque `[x]` quando conferir. Cada item diz **quem faz** (A = André,
C = Claude) e **como se sabe que está pronto**. Itens de dinheiro, contrato e conta de terceiros
são sempre do André.

Estado hoje: pronto para **lançamento fechado** (convidados e pilotos). Os blocos 1 a 3 precisam
estar fechados antes de **anunciar aberto**.

## 1. Antes de mandar o link a qualquer pessoa

- [ ] **A — Percorrer os 12 passos do tour em produção**, em português e em inglês, e anotar o
      que ajustar (texto, ordem, posição do balão). Pronto: nenhum passo cobre o que ele aponta.
- [x] **A — Confirmar que o e-mail de confirmação chega.** Conferido em 29/10 em português e em
      inglês: e-mail recebido, link abre a página `/confirmar/<código>` e a confirmação acontece no
      botão (de propósito: antivírus abrem links sozinhos). O texto da página agora diz que são dois
      passos.
- [ ] **A — Perguntar ao Vini, no tour, algo que um complemento responde** (ex.: "como uso o
      logotipo sobre uma foto?"), em português e em inglês. Pronto: a resposta cita o complemento.
      Nunca foi testado com IA real.
- [ ] **A — Conferir o orçamento da conta Demonstração no Console** (hoje US$ 3/dia, US$ 30/mês) e
      o saldo dos provedores de IA. Pronto: Console mostra o limite e há saldo.
- [ ] **A — Saber desligar o tour.** Hoje não há tela no Console: peça a mim e eu rodo
      `update private.demonstracao_config set ativo = false`. Pronto: você sabe a quem pedir.

## 2. Antes de anunciar aberto (público estrangeiro)

- [ ] **A — Revisão do advogado dos textos legais em inglês** (termos, privacidade, licença de
      fontes). Sem isso, não abrir o site em inglês para fora do Brasil.
- [ ] **A — Stripe em inglês**: nome do produto, recibo, e-mails e Portal do cliente para cobrança
      em dólar. Pronto: uma cobrança de teste em USD chega toda em inglês.
- [ ] **A — Modelos de e-mail do Supabase em inglês** (confirmar conta, recuperar senha, convite).
      Hoje saem em português para todo mundo. Pronto: recuperar senha em conta de idioma inglês
      chega em inglês.
- [ ] **A — Decidir os preços.** Estão provisórios (R$ 490 / 990 / 1.990, plano de fundadores). O que
      está no site é o que será cobrado.
- [x] **C — Recapturar as telas do site em inglês** (bloco 5). Feito em 29/10 (#214): 15 capturas
      em 2880×1800 e testes que impedem voltar ao português.

## 3. Infraestrutura e segurança

- [ ] **A — Turnstile**: confirmar que o widget "Brennimark Tour" na Cloudflare aceita o domínio
      `www.brennimark.com` (e que o segredo da Vercel é o rotacionado). Pronto: entrada pelo tour
      funciona em produção.
- [ ] **A — Limite por visitante (IP)**: hoje só captcha + teto de 200 entradas/dia. Para divulgação
      grande, decidir entre assinar a Vercel Pro (regra de limite no firewall) ou eu fazer o limite no
      código. Para convidados, dispensável.
- [ ] **A — Domínio e e-mail**: `www.brennimark.com` no ar, DNS correto, `contato@` recebendo e
      respondendo. Pronto: e-mail de teste enviado e respondido.
- [ ] **C — CI verde na `main`** e deploy da Vercel verde. Pronto: último commit com os dois verdes.
- [x] **C — Limpeza diária do tour rodando** (cron das 07:29 UTC). Em 29/10 descobri que faltava
      `CRON_SECRET` na Vercel e os quatro crons devolviam 401 em silêncio; o segredo foi
      adicionado. Provado em 30/10: o visitante vencido foi apagado e `demonstracao_vencidos()`
      voltou vazio. O plano Hobby não guarda log, então a prova é o banco, não a Vercel.
- [ ] **A — Backup do banco**: conferir no Supabase que há backup diário ativo (plano atual) e quem
      restaura. Pronto: você sabe onde clicar.

## 4. Conteúdo do tour (conta Demonstração)

- [x] Manual nas duas línguas (`brennimark-pt` e `brennimark-miv-v0-3-en`), seções prontas.
- [x] Paleta (6) e tipografia (8) aprovadas nas duas marcas.
- [x] 7 logos e 4 álbuns de fotos nas duas marcas; nomes em inglês na marca em inglês.
- [x] 5 complementos publicados nas duas marcas (tradução em inglês).
- [x] **A — Ler a tradução dos 5 complementos**: aprovada em 29/10.
- [x] Conta Demonstração renomeada para "Brennimark" (29/10). Botão "Voltar ao site" na faixa e no
      último passo do tour (#215).
- [ ] **A — Ler o texto dos 12 passos** (já coberto no bloco 1).

## 5. Telas do site em inglês (inventário, 29/10/2026 — **concluído**)

O texto abaixo é o inventário que orientou o trabalho, mantido como registro.

O site em inglês hoje usa as **mesmas 17 capturas em português** (interface, manual e Vini em
português). Cada captura tem destaques e câmera ajustados à imagem, e a `Lupa` redesenhada da home
repete textos em português. Não é só trocar arquivos.

| Captura | Onde aparece | Dá para fazer na conta Demonstração (visitante, só consulta)? |
|---|---|---|
| manual, manual-busca, manual-indice | home, Manual | sim |
| materiais, item-logotipo, banco-de-imagens | home, Materiais | sim |
| complementos, vini-complemento | home | sim (o Vini gasta 1 das 2 perguntas) |
| assistente, prompt, prompt-resultado, revisao | home, Vini | **não**: prompts e revisão de peça são de assinante |
| pessoas, registros, links-criado, receber | home, Entrega, Segurança, Empresas | **não**: exigem conta de assinante com dados |
| complemento-editor | Complementos | **não**: editar é de assinante |

As capturas `envio` e `kit` existem na pasta, mas nenhuma página as usa hoje.

Para as que não dá no tour é preciso uma sessão logada como assinante numa marca em inglês (a
conta Demonstração, com você como dono), no Chrome. Eu não passo pelo login nem pelo captcha.
Plano quando você estiver à mesa: você abre a marca em inglês logado, eu capturo as 17 telas
(janela 1440×900, e-mails ocultos), ajusto destaques e `Lupa`, e as páginas passam a escolher a
imagem pelo idioma.

## 6. Depois de lançar (primeira semana)

- [ ] **A — Olhar o Console diariamente**: entradas do tour por dia, perguntas gastas, custo de IA.
- [ ] **A — Primeira rodada do convite do Fonts** (25 por clique, motivo no registro). Os e-mails
      saem agora no idioma de cada pessoa, com o rodapé legal correspondente.
- [ ] **A — Entrevistas de precificação** com agências (roteiro em `precificacao-roteiro-e-numeros-rascunho.md`).
- [ ] **C — Ajustar o tour** com o que você e os convidados apontarem.
