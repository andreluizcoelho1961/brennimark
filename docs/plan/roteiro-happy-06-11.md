# Roteiro da demonstração na Happy — 06/11/2026

Rascunho de 30/10/2026, atualizado no mesmo dia após as correções. ~20 minutos de demonstração + conversa. Público: diretor de criação, TI,
planejamento, desenvolvimento de produto. Eles sabem que o projeto está em desenvolvimento.

## Ordem sugerida (e por quê)

1. **A dor, em 1 minuto (sem tela).** "Uma marca passa por muitas mãos. A ideia tem que passar por
   todas." Perguntar como a Happy entrega manual de marca hoje (PDF por e-mail? pasta? Drive?).
2. **O manual (3 min).** Abrir o manual da demonstração: índice, busca, ver como o PDF continua
   sendo a referência. Mostrar o status `pronto / rascunho / pendente` — é o que um diretor de arte
   valoriza: a plataforma não finge que o rascunho é regra.
3. **Vini (4 min).** Perguntar algo cuja resposta está no manual e algo que NÃO está ("qual o tom
   para o público infantil?"). O segundo mostra a honestidade: "não há diretriz documentada".
4. **Materiais e entrega por link (3 min).** Logos, cores, tipografia, banco de imagens; criar um
   link de entrega com prazo e abrir o que o destinatário vê. Falar de segurança: link com prazo,
   só o hash no banco, nada de URL pública de fonte.
5. **Ferramentas (2 min).** Kit (logo → todos os tamanhos), Cores (que cor é essa?), Grids.
6. **Fonts (4 min).** O app no computador: ativação de fontes, busca, glifos e recursos OpenType, Playground.
   É o gancho para TI. (Conferir com você o que mostrar; não testei o app.)
7. **Para TI (2 min).** Isolamento por marca (RLS), IA da plataforma (ninguém traz chave),
   hospedagem de fonte com termo assinado, exportação e exclusão de dados.
8. **Perguntas de preço (o resto).** Usar o roteiro em
   `docs/plan/precificacao-roteiro-e-numeros-rascunho.md`.

## Sobre o tour guiado

O tour é para quem entra sozinho pelo site. Na reunião, **você conduz ao vivo**, então use uma
sessão logada como assinante na conta "Brennimark": nela aparecem Prompts, Revisão de peça, Pessoas,
Registros e Links, que o tour de visitante não mostra. O tour fica como o que você manda de
leitura depois ("fiquem à vontade para percorrer").

## Checklist da manhã de 06/11 (30 min antes)

- [ ] Abrir `www.brennimark.com` e conferir que carrega (hoje: 0,2–0,7 s).
- [ ] Logar na conta e abrir o manual, o Vini e o banco de imagens **uma vez cada** (aquece o cache).
- [ ] Fazer 2 perguntas ao Vini e conferir que respondeu e citou fonte e página.
- [ ] Criar o link de entrega de teste e abri-lo em janela anônima.
- [ ] Abrir o Fonts e conferir que ativa uma fonte.
- [ ] Console: saldo e limite diário de IA com folga.
- [ ] Notebook carregado, segundo cabo ou hotspot do celular, navegador sem extensões que mudem a página.

## Plano B (se a internet ou a IA falhar)

- Gravar em tela, antes, os blocos 2 a 5 (cerca de 8 min) e levar no notebook.
- Se só o Vini falhar: dizer que ele depende de IA, mostrar a gravação do bloco 3 e seguir.
- Se tudo falhar: o site público e o manual em PDF abrem do celular; a conversa de preço não
  depende de tela.

## O que NÃO foi testado no ensaio de 30/10

- A entrada no tour de visitante, porque o captcha (Turnstile) só se passa à mão.
- O app Fonts (desktop).
- Revisão de peça (pede subir imagem) e os downloads em si (Kit, Grids, Materiais).
- Respostas do Vini a perguntas que a Happy fizer; só testei duas.

## Achados do ensaio de 30/10 (conta logada, marca Brennimark PT)

**Corrigido (conferido em produção em 30/10):**
- O botão EN/PT do cabeçalho dava 404 (PR #217).
- A etiqueta de citação do Vini somava "p. N" a uma seção sem nome ("Páginas 9–16 · p. 9"); agora mostra só o intervalo (PR #218).
- Abrir o Kit ou os Grids aparecia no Registros como "baixou"; agora a linha é "prévia" e diz "Carregado na ferramenta para medir e desenhar — não foi baixado para guardar" (PRs #219 e #220, coluna `finalidade`). As 11 linhas antigas dos testes de 30/10 seguem como "download" (o Registros não se apaga).

**Funcionou:** as 15 páginas públicas (pt e en); manual com 42 páginas; as 12 telas da conta
(Materiais, Complementos, Pessoas, Links, Registros, Configurações, Kit, Cores, Grids, Admin,
Histórico) abrem em menos de 1 s, sem imagem quebrada; Vini respondeu certo à regra de área de
proteção e admitiu "não há diretriz documentada" para o tom infantil; o copiloto de prompts mostra
as regras aprovadas que entram e gera um prompt com as cores da marca.

**Atenção antes de 6/11:**

1. **O primeiro pedido ao Vini leva ~25 s** (os seguintes, ~8 s). Aquecer antes da reunião.
2. ~~A citação do Vini discorda do próprio texto.~~ **Resolvido em parte (#218):** a etiqueta de
   seção sem nome não soma mais "p. N". Continua verdade que a etiqueta de uma seção aponta onde
   ela COMEÇA, não a página exata da frase; a página exata pede um índice por página (fatia
   própria, depois da reunião). Se a Happy notar: "o Vini cita a seção e a página onde ela começa".
3. ~~Abrir o Kit grava "downloads" no Registros.~~ **Resolvido (#219/#220).** Abrir o Kit ou os
   Grids grava "prévia". Atenção: toda abertura do Kit na conta ainda acrescenta linhas de prévia
   (3 por abertura); elas não confundem mais, mas aparecem. Evite abrir o Kit à toa antes da reunião.
4. **A lista de Links de entrega mostra 4 links de teste de 29/10** (todos encerrados, "Antonio
   Silva"). Aparecem se você abrir a tela na frente da Happy.
5. **Pessoas: "Nenhum e-mail é enviado."** Para entrar na equipe, a plataforma mostra uma senha
   provisória uma vez e você a entrega à pessoa. Se perguntarem "e o convite por e-mail?", a
   resposta é: ainda não.
6. **A interface da conta estava em inglês.** Troquei para português durante o ensaio (preferência
   da conta); confira se é isso que você quer na reunião.
7. O prompt gerado vem em inglês (para modelos de imagem) mesmo com a interface em português.
