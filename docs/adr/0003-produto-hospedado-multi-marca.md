# ADR-0003 — Produto hospedado, multi-marca, com silo como plano superior

- **Status:** proposto, aguardando aprovação
- **Data:** 28/08/2026
- **Substitui:** ADR-0001 (Studio como control plane sobre instalações isoladas)
- **Relaciona-se com:** ADR-0002 (dois modos de produto), briefing de evolução §6 e §16
- **Decisão irreversível?** Parcialmente. Ver §8.

---

## 1. Por que reabrir

O ADR-0001 recomendou uma instalação isolada por marca: projeto, domínio, banco e chaves
próprios. Foi aprovado e continua descrito em `docs/BRANDVILLE_MATRIX.md`.

Desde então a definição do produto mudou. Não é mais "entregar um brand book digital excelente
para um cliente". É uma startup vendendo a agências que gerenciam carteiras de marcas, com o lado
do cliente consultando (ADR-0002).

Isso não invalida o raciocínio do ADR-0001 para o momento em que foi tomado. Invalida-o **como
destino**.

## 2. A pergunta que decide

> Uma agência consegue subir uma marca nova sem intervenção do time que construiu o produto?

Se sim, é produto. Se não, é serviço com software junto, e não escala além da capacidade pessoal
de quem opera. Hoje a resposta é não, e a arquitetura atual garante que continue sendo não.

## 3. O obstáculo real, e ele não é o banco

O conteúdo da marca **é código**. `src/brandville/instances/hairline.ts` tem 43 KB de TypeScript
versionado no repositório. `getResolvedBrandDocs` percorre esse registro e procura sobreposições no
banco — ou seja, `brand_documents` é camada de override, não fonte.

Adicionar um cliente exige escrever manifesto, rodar gerador, commitar e publicar. O próprio
gerador encerra dizendo: *configure `NEXT_PUBLIC_BRANDVILLE_INSTANCE` no projeto exclusivo do
cliente.*

**Isso é independente da topologia.** Mesmo com banco compartilhado, não daria para cadastrar um
cliente sem publicar código.

## 4. Correção a um argumento do ADR-0001

O ADR-0001 sustentou o silo com três razões. Duas continuam válidas: não exigia migração naquele
momento, e preservava o isolamento descrito na documentação.

A terceira estava errada. Ela dizia:

> separado → junto é uma migração trabalhosa, mas possível; junto → separado é muito mais caro

Reexaminando: extrair **um** cliente de um banco compartilhado é um dump filtrado por identificador
— operação conhecida. Fundir **N** bancos separados exige reconciliar identificadores entre N
fontes, o que é mais difícil, não menos.

**A reversibilidade pesava a favor do compartilhado, e o ADR apresentou o contrário.**

## 5. Decisão

### 5.1 Topologia

**Produto hospedado, um aplicativo, um banco, clientes por linha, isolamento por RLS.** A pessoa
acessa um endereço, autentica e está dentro. Cadastrar uma marca é uma inserção, não um deploy.

**O silo por cliente permanece disponível como plano superior**, para quem exigir isolamento
físico ou residência de dados específica — e pagar o custo operacional que ele gera. Deixa de ser
o padrão distribuído a todos.

### 5.2 Três migrações, nesta ordem

| # | Migração | Por que nesta posição |
| --- | --- | --- |
| 1 | **Conteúdo da marca: de código para dado** | Enquanto o manual for arquivo `.ts`, nada mais importa. Destrava autoatendimento, importador e carteira ao mesmo tempo. |
| 2 | **Instância: de build-time para runtime** | `brandvilleInstance` é constante de módulo importada por 45 arquivos em 136 lugares. Enquanto for assim, um deploy serve uma marca. Necessária inclusive para a carteira. |
| 3 | **Banco: silo → compartilhado** | Depois de 1 e 2, fica pequena. |

As migrações 1 e 2 valem **mesmo que a topologia permanecesse em silo**. Podem começar sem que a 3
esteja decidida em definitivo.

### 5.3 A exportação sobe na fila

O aplicativo importa manual em PDF e **não exporta nada**. Numa relação com data para acabar — que
é o caso de toda agência com contrato — isso é passivo comercial, não lacuna de recurso.

O WP8 deixa de ser o último pacote e passa a ser pré-requisito do primeiro contrato de agência.

## 6. O que o produto é, afinal

Reformulação que decorre da mesma análise e orienta o que construir primeiro.

**Não é hospedar brand book.** Isso é commodity; o Frontify existe e uma agência não troca de
ferramenta por mais um visualizador.

**É transformar o manual morto do cliente num sistema que responde e prova.** O manual de marca
hoje é um PDF que ninguém lê e onde ninguém acha nada — a pergunta do designer continua indo por
mensagem para o diretor de arte.

Três coisas que já existem no repositório e sustentam essa oferta:

- `brandville:import` converte PDF em rascunho estruturado e curável — é a porta de entrada, e vem
  sendo tratado como script de bastidor;
- status governado (`ready | draft | pending`) atravessa modelo, contexto de IA e citações;
- a IA cita fonte, status e caminho, e é instruída a não afirmar o que não está documentado.

**O laço mínimo do produto:**

```
sobe o PDF → curadoria → publica → pergunta e recebe resposta com fonte → valida uma peça
```

Demonstrável numa reunião, e é o que uma agência paga para ter.

## 7. Consequências

**Positivas:** cadastro de cliente deixa de exigir engenharia; uma migração em vez de N; um deploy
em vez de N; custo cresce com uso e não com contagem de clientes; a pausa por ociosidade do plano
gratuito deixa de se multiplicar; autoatendimento passa a ser possível; e o isolamento físico vira
receita em vez de custo.

**Negativas, assumidas:** o isolamento entre clientes passa a ser lógico. Uma policy RLS mal
escrita vaza dado entre marcas, e não existe mais a barreira física que tornava isso impossível.
**Correção de RLS passa a ser existencial**, não higiene — ver §9.

**Trabalho real:** as três migrações são grandes, especialmente a primeira. Isso não é acabamento.

**Não muda:** a camada de IA, o sistema de blocos, a moldura V2, as capacidades do ADR-0002 e a
honestidade editorial. Tudo isso é ortogonal à topologia e continua valendo.

## 8. O que esta decisão trava

**Trava:** o modelo de tenancy no esquema. Depois que as tabelas carregarem a coluna de tenant e as
policies dependerem dela, mudar a chave de isolamento exige migrar dados.

**Não trava:** a oferta comercial, o preço, nem quem é titular da conta. E não trava o silo — ele
continua construível para o cliente que exigir, porque o produto passa a ter exportação de verdade.

## 9. Condições que esta decisão impõe

Não são recomendações; são o que torna a decisão defensável:

1. **Nenhuma consulta confia em identificador de tenant vindo do cliente.** A resolução acontece no
   servidor, a partir da sessão.
2. **Toda tabela nova nasce com RLS e teste de autorização negativo** — provar que o tenant A não
   lê o do B, não só que o A lê o seu.
3. **Exportação completa por marca existe antes do primeiro contrato de agência.**
4. **O teste de isolamento entra no CI.** Sem ele, a barreira lógica não tem quem a defenda.

## 10. Fora desta decisão

Nome comercial, preço, quem é titular da conta quando a agência compra, residência de dados
exigida e política de retenção. O briefing de evolução §24 lista essas como decisões humanas, e
nada aqui as presume.

## 11. Revisão

Reavaliar se: um cliente exigir residência de dados que o provedor compartilhado não atenda; um
incidente de isolamento ocorrer; ou o custo do banco compartilhado ultrapassar o de silos
equivalentes — o que indicaria dimensionamento errado, não erro de modelo.
