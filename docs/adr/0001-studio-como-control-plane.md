# ADR-0001 — Studio como control plane sobre instalações isoladas

- **Status:** proposto, aguardando aprovação
- **Data:** 27/08/2026
- **Contexto:** briefing §6, auditoria `docs/audit/2026-08-27-estado-do-repositorio.md`
- **Decisão irreversível?** Parcialmente. Ver §7.

---

## 1. O problema, em uma frase

Uma agência precisa acompanhar uma carteira de marcas, mas cada marca hoje é uma instalação
completamente separada — e não existe nada acima delas que enxergue o conjunto.

## 2. Tradução da decisão

**O que é:** decidir se cada marca continua num banco próprio, se todas passam a dividir um banco só,
ou algo no meio — e, se continuarem separadas, o que exatamente a camada da agência pode ver.

**Em que camada vive:** banco de dados e infraestrutura. É a decisão mais estrutural do produto.

**Tradeoff:** manter separado protege o cliente e é o que já está vendido, mas cada marca nova custa
um projeto Supabase, um deploy e um domínio. Juntar tudo num banco só baratearia a operação e
simplificaria a visão de carteira, ao preço de que um erro de permissão vaze dados entre clientes.

**Reversibilidade:** separado → junto é uma migração de dados trabalhosa, mas possível e incremental.
Junto → separado é muito mais caro, porque exige desmembrar dados já misturados. **A opção separada
preserva mais caminhos futuros**, e é por isso que ela vence mesmo sendo a mais cara por marca.

---

## 3. Alternativas avaliadas

### Opção 1 — Instalações independentes + control plane (recomendada)

Cada marca mantém seu Supabase, storage, usuários, chaves e domínio. O Studio é uma aplicação
separada que guarda apenas metadados operacionais e métricas agregadas, recebidos das instalações.

### Opção 2 — Um Supabase multi-tenant

Todas as marcas num banco só, isoladas por RLS sobre `workspace_id`/`instance_key`.

### Opção 3 — Híbrido por agência

Um banco por agência, com as marcas daquela agência dentro dele.

---

## 4. Comparação

| Critério | 1. Isoladas + control plane | 2. Multi-tenant único | 3. Híbrido por agência |
| --- | --- | --- | --- |
| Isolamento entre clientes | Físico, o mais forte | Lógico; um bug de RLS vaza | Físico entre agências, lógico dentro |
| Coerência com a arquitetura documentada | Total | **Diverge do que `BRANDVILLE_MATRIX.md` descreve** | Parcial |
| Custo por marca | Alto (1 projeto + 1 deploy) | Baixo | Médio |
| Complexidade operacional | Alta: N ambientes | Baixa: 1 ambiente | Média |
| Esforço de migração a partir de hoje | **Nenhum** | Alto e big-bang | Médio |
| Visão de carteira | Exige sincronização | Nativa | Quase nativa |
| Billing e planos | Por instalação, agregado no Studio | Nativo | Por agência |
| Domínio próprio por marca | Natural | Exige roteamento por host | Natural |
| Portabilidade / offboarding | Mais simples: o recorte já está separado | Exige extração seletiva | Média |
| Backup e restore | Por marca, granular | Tudo ou nada | Por agência |
| Raio de explosão de um incidente | Uma marca | **Todas as marcas** | Uma agência |
| Adequação ao estágio (3 pilotos) | Boa | Prematura | Prematura |

---

## 5. Decisão

**Adotar a Opção 1.**

Três razões, em ordem de peso:

1. **É a única que não exige migração agora.** O produto está a caminho de três pilotos pagos. Uma
   reescrita multi-tenant antes de haver evidência de canal consumiria o orçamento de engenharia
   que deveria ir para medir a tese.
2. **Preserva a arquitetura documentada.** `docs/BRANDVILLE_MATRIX.md` e a implementação atual
   descrevem isolamento por projeto separado. Trocá-lo por isolamento lógico seria uma mudança de
   garantia técnica feita antes de existir cliente pagante para justificá-la — e sem contrato
   assinado que a exija. Nada aqui presume compromisso comercial já firmado.
3. **Mantém a porta aberta.** Com telemetria por instalação (WP2), a decisão de compartilhar
   infraestrutura para o segmento mais barato pode ser tomada depois, com números de custo real em
   vez de estimativa.

O custo aceito é explícito: **a operação de N ambientes fica cara antes de ficar barata.** É um
custo que só se paga se o canal de agências se confirmar — e é exatamente isso que os pilotos vão
determinar.

---

## 6. Restrições que a decisão impõe

Estas restrições são a decisão. Sem elas, a Opção 1 degenera na Opção 2 sem ninguém perceber:

0. **O Studio é uma trust boundary separada das instalações.** Autenticação, autorização e dados
   próprios; nenhuma sessão de instalação vale nele, e vice-versa. Esta é a restrição estrutural —
   **e ela não decide, por si, a topologia de repositório ou de deploy.** Se o Studio nasce como
   aplicação separada, como rota isolada da mesma base ou como projeto próprio é decisão posterior,
   a ser tomada no WP4 com evidência operacional. O que este ADR fixa é a fronteira de confiança,
   não o empacotamento.
1. **O Studio nunca recebe conteúdo, assets ou chaves de IA das instalações.** Apenas metadados
   operacionais: estágio de onboarding, plano, saúde, responsável, datas, contadores agregados.
2. **O acesso profundo acontece na instalação**, com a autenticação da própria instalação. O Studio
   pode levar a pessoa até lá; não pode ler por ela.
3. **A comunicação instalação → Studio é unidirecional por padrão**, assinada, com timestamp e
   chave de idempotência (briefing §20). O Studio não escreve no banco de uma instalação.
4. **Nenhuma credencial de instalação fica no Studio.** Provisionar um ambiente novo é uma operação
   humana com runbook, não uma automação com poder de admin sobre N projetos.
5. **Métricas chegam agregadas.** O Studio guarda "42 análises em agosto", não as análises.
6. **Toda tabela do Studio tem `installation_id`**, e nenhuma tem conteúdo de marca.

## 7. O que esta decisão trava e o que não trava

**Trava (caro de reverter):** o formato do contrato de eventos entre instalação e Studio, e o
esquema das tabelas do control plane. Mudá-los depois exige versionamento de contrato e migração.

**Não trava:** a escolha de infraestrutura por marca. Se uma agência de dez marcas pequenas provar
que dez projetos Supabase são caros demais, a Opção 3 pode ser adotada **para aquela agência** sem
tocar nas instalações existentes — porque o control plane fala com instalações por contrato, não por
acesso direto ao banco.

## 8. Consequências

**Positivas:** isolamento preservado; o Studio vira um produto vendável por si; a segunda marca por
agência passa a ser mensurável; nenhuma reescrita antes da validação; offboarding mais simples,
porque o recorte de dados de um cliente já nasce separado — ainda assim exige processo próprio
(exportação, transferência de propriedade, encerramento), que é escopo do WP8.

**Negativas, assumidas:** provisionar marca continua sendo trabalho humano até o WP3; a visão de
carteira depende de sincronização, que pode atrasar ou falhar; o custo de infraestrutura cresce
linearmente; operar N ambientes exige o runbook do WP0 — hoje inexistente.

**Pré-requisito não negociável:** o Studio não pode começar antes do WP0. Um control plane sobre
instalações que ninguém sabe recriar (auditoria §2.1) multiplica um problema em vez de resolvê-lo.

## 9. Revisão

Os gatilhos abaixo são **provisórios**: foram escolhidos como ponto de partida para haver algum
critério objetivo, não derivam de dados de operação — que ainda não existem. Devem ser recalibrados
assim que o WP2 produzir custo real por instalação.

Reavaliar quando qualquer um ocorrer: mais de ~15 instalações ativas; custo de infraestrutura por
marca acima de ~15% da receita da marca; uma agência com mais de ~8 marcas; ou evidência de que o
tempo de provisionamento é o gargalo da ativação.

O quarto gatilho é o único que não depende de número arbitrário e provavelmente é o mais confiável.
