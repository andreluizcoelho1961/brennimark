# Migração 1 — o conteúdo da marca deixa de ser código

**Decorre de:** ADR-0003 §5.2 · **Precede:** migração 2 (instância em runtime) e 3 (banco compartilhado)
**Estado:** plano, nada implementado

---

## 1. O que muda, em uma frase

O manual de uma marca sai de `src/brennimark/instances/<key>.ts` e passa a viver em tabelas. O
banco deixa de ser camada de sobreposição e vira a fonte.

## 2. O que esta migração entrega — e o que não entrega

**Entrega:** criar e alterar uma marca inteira sem tocar em código; o importador de PDF passando a
produzir marca real em vez de rascunho de arquivo; e o esquema de que as migrações 2 e 3 dependem.

**Não entrega autoatendimento.** Enquanto a instância for escolhida por variável de ambiente em
build, cada marca ainda exige um deploy — e, sob a topologia atual, um projeto Supabase. O
autoatendimento só aparece com as três migrações juntas.

Registrar isso evita a decepção de concluir a maior das três e não ver o resultado comercial.

## 3. A métrica que justifica o trabalho

Não é linha de código nem elegância de esquema. É:

> **Tempo e custo para colocar uma marca no ar.**

Hoje: horas de engenharia, por marca, sempre. É o número que decide se o produto escala ou se ele
é a agenda de uma pessoa — e é o que um investidor vai perguntar antes de qualquer coisa sobre
tecnologia. O WP2 precisa instrumentá-lo desde a primeira marca criada pelo caminho novo.

## 4. Desenho de dados

### 4.1 A conta e as marcas dentro dela

`workspaces` já existe e vira **a conta**: uma agência, um estúdio ou uma marca que comprou direto.
As marcas passam a ser filhas dela.

```sql
create table public.brands (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  key           text not null,          -- slug estável; o antigo instance_key
  name          text not null,
  short_name    text not null,
  descriptor    text not null,
  language      text not null default 'pt-BR',
  metadata      jsonb not null default '{}'::jsonb,   -- title, description
  navigation    jsonb not null default '{}'::jsonb,   -- groups, codes, default, utilities
  theme         jsonb not null,
  ai            jsonb not null,
  legal         jsonb not null default '{}'::jsonb,
  status_labels jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (workspace_id, key)
);
```

Isso encaixa exatamente no eixo de **alcance** do ADR-0002: a conta de uma marca tem uma linha; a
carteira de uma agência tem várias. Nenhum conceito novo.

### 4.2 `brand_documents` deixa de ser sobreposição

Ganha `brand_id uuid references public.brands(id) on delete cascade`. O par
`workspace_id + instance_key` permanece durante a transição, para nada quebrar, e sai no fim.

Os blocos já são `jsonb` desde a migração de agosto — essa parte do trabalho está feita.

### 4.3 O que não vai para o banco

Componentes React específicos de uma instância continuam em código. Eles são apresentação, não
conteúdo. O caminho para reduzi-los é o sistema de blocos, não esta migração.

## 5. Estratégia: estrangulamento, não substituição

Trocar a fonte de uma vez quebraria as quatro instâncias existentes ao mesmo tempo, sem forma de
comparar o antes e o depois.

O caminho é **uma fonte por trás de uma interface única**, com o registro em código atuando como
semente e como reserva enquanto a marca não tiver sido migrada:

```
getResolvedBrandDocs
        │
        ├── marca existe no banco?  → banco é a fonte
        └── não existe?             → registro em código (comportamento atual)
```

Uma marca migra por vez, verificável isoladamente. O registro em código só é apagado quando nenhuma
marca depender dele.

## 6. Sequência de PRs

| PR | Escopo | Verificação |
| --- | --- | --- |
| 1 | Esquema: `brands`, `brand_id` em `brand_documents`, RLS, **teste de autorização negativo** | Migração numa stack limpa; A não lê o de B |
| 2 | Leitura: `getResolvedBrandDocs` e a configuração passam a consultar `brands` | **feito** — sem herança, não há reserva a manter |
| 3 | Importador de PDF passa a criar marca no banco, pela interface | Subir um PDF e ver a marca no ar sem tocar em arquivo |
| 4 | Administração cria e edita marca inteira, não só páginas | Criar uma marca do zero pela interface |

**O plano encolheu de sete PRs para quatro.** Os PRs 3, 4 e 7 originais — exportar código para
linhas, migrar o Hairline, e remover o registro — deixaram de existir quando toda a herança foi
removida em 28/08. Com isso o risco 1, perda silenciosa de conteúdo na conversão, também
desapareceu: não há o que converter.

Cada PR mantém o aplicativo funcional e termina com `npm run verify` verde.

## 7. Riscos

| # | Risco | Grav. | Mitigação |
| --- | --- | --- | --- |
| 1 | **Perda silenciosa de conteúdo na exportação de código para linhas** | **Alta** | O PR 3 é ida e volta comparada campo a campo, não inspeção visual. Nenhuma marca migra sem esse teste passar para ela. |
| 2 | Validação de contraste e de manifesto vive no gerador `.mjs`; conteúdo criado pela interface escaparia dela | Alta | Mover a validação para módulo compartilhado antes do PR 6, ou a interface aceitará tema ilegível |
| 3 | Honestidade editorial diluída: status virando dado editável sem trilha | Alta | O trigger de versionamento já cobre `brand_documents`; estender a `brands` no PR 1 |
| 4 | RLS de `brands` errada expõe marca de outra conta | **Alta** | Teste negativo obrigatório no PR 1, no CI — condição 2 e 4 do ADR-0003 |
| 5 | Divergência entre manifesto e banco, repetindo o problema que já tivemos entre manifesto e arquivo gerado | Média | O manifesto deixa de ser fonte e vira formato de importação/exportação |
| 6 | Scripts Node sem sessão precisando escrever | Média | Decidir entre chave de serviço com escopo ou rota autenticada — ver §8 |

## 8. Decisões que preciso trazer antes de implementar

**Como os scripts escrevem no banco.** O gerador e o importador rodam em terminal, sem sessão. Ou
recebem uma chave de serviço com escopo restrito, ou passam a chamar uma rota autenticada. A
primeira é mais simples e concentra poder; a segunda é mais segura e exige login no terminal.

**O que acontece com `NEXT_PUBLIC_BRENNIMARK_INSTANCE`.** Nesta migração ela permanece, escolhendo
qual linha de `brands` carregar. Some na migração 2. Confirmar que aceita continuar assim no
intervalo.

**Se a Guitar Garage entra pelo caminho novo.** Ela deixou de ser prioridade como instância escrita
à mão. Como **primeiro PDF real atravessando o importador no PR 5**, ela deixa de ilustrar o
produto e passa a validá-lo. Recomendo assim.

## 9. Fora de escopo

Migração 2 e 3, Studio, cobrança, editor visual completo de blocos, e redesenho de conteúdo de
qualquer marca. Esta migração move conteúdo de lugar; não o reescreve.
