# ADR-0005 — A curadoria editorial é do produto, não do estúdio

- **Status:** aceito
- **Data:** 03/09/2026
- **Relaciona-se com:** ADR-0004 (o produto age na criação), I1 (importação), Q1 (navegação)
- **Decisão irreversível?** Não na direção. Sim no que ela obriga a construir — ver §5.

---

## 1. O que se decidiu

Entre **extrair** e **publicar** existe uma etapa: alguém revisa o que a máquina propôs,
corrige, aprova e só então aquilo vira manual. Essa etapa é **do produto**.

Uma consultoria pode executá-la para um cliente. O Brennimark precisa fornecer o fluxo.

## 2. Por que isto não é detalhe de interface

O primeiro ciclo autenticado importou um manual real de 743 páginas. O resultado:

- 122 seções, todas em rascunho;
- a página de entrada ficou sendo `what-s-new`, porque era a primeira do PDF;
- há seções chamadas `Páginas 9–16`, nome do bloco de reserva quando o agrupamento
  não encontrou estrutura.

Nada disso é defeito do importador. O importador fez o que se pede a ele: propor uma
estrutura a partir de evidência tipográfica, sem inventar categoria. `Páginas 9–16` é a
recusa correta de nomear o que não tem nome no arquivo.

O que falta não é uma heurística melhor. É a etapa em que uma pessoa olha e decide.

**Sem ela, o produto é um leitor de PDF sofisticado — não um sistema de gestão de marca.**

## 3. O que isso torna obrigatório

Uma superfície de curadoria pós-publicação, com:

1. a fila do que está em rascunho;
2. renomear, unir, dividir e reordenar seções;
3. revisar conteúdo e conferir procedência (a faixa de páginas do PDF de origem);
4. promover para pronto;
5. definir a página de entrada.

As operações 2 e 3 **já existem** — na prévia da importação (`ListaDeSecoes`), com
validação de invariantes que impede perder página. O que não existe é o mesmo poder
DEPOIS de publicar.

## 4. Por que "depois de publicar" não é o mesmo problema

Antes de publicar, as seções são objetos em memória: unir duas é recombinar um array.
Depois, cada seção é uma linha em `brand_documents`, com:

- **slug**, que é URL — e URL compartilhada é promessa;
- **versões**, em `brand_document_versions`, com histórico e restauração;
- **trechos**, em `brand_chunks`, reconstruídos por gatilho;
- **citações** já emitidas pelo assistente, que apontam para caminho e status.

Unir duas seções publicadas significa decidir o que acontece com dois slugs, dois
históricos e as citações que já existem. Não é a mesma operação com outro nome.

## 5. As decisões que precisam ser tomadas antes de construir

Registradas aqui porque construir sem decidi-las é escolher por omissão:

**Slug ao renomear.** Renomear a seção muda a URL? Se muda, todo link salvo quebra. Se
não muda, o endereço deixa de corresponder ao título — como `ge-id000` fazia na barra.
A terceira via é slug estável com redirecionamento, que é mais trabalho e não mente.

**União e divisão publicadas.** Unir A e B produz uma linha nova ou mantém A e absorve
B? A resposta decide o que acontece com o histórico de B — e apagá-lo é perda de
procedência, que o produto trata como grave em todo lugar.

**Reordenar.** `sort_order` já existe. Reordenar é barato, e é a única das quatro que
não tem consequência fora da própria linha.

**Promoção em massa.** 122 seções uma a uma é trabalho que ninguém faz. Promover em
lote é conveniente e é exatamente como um manual inteiro vira "pronto" sem ninguém ter
lido — o oposto do que a etapa existe para garantir.

**Quem cura.** Hoje `editar` e `aprovar` são capacidades distintas que o papel `owner`
recebe juntas, porque `workspace_members.role` só aceita owner e member. Uma agência
que revisa sem aprovar precisa dos dois papéis separados.

## 6. O que NÃO muda

O importador continua publicando tudo em rascunho. A decisão reforça isso: se existe
etapa de revisão, publicar como rascunho é o começo dela, não uma cautela.

E o assistente continua respondendo sobre rascunho, rotulado como provisório — ver a
decisão editorial do Q1. Esconder o não-revisado faria o produto entregar uma conta
vazia no dia seguinte à importação.
