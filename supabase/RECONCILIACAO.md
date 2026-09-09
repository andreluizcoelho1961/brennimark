# Reconciliação do histórico de migrações — 05/09/2026

O repositório e o banco tinham **os mesmos 44 nomes de migração e nenhuma
versão em comum**. `supabase db push` veria 44 carimbos desconhecidos e
tentaria reaplicar tudo: `create table` sobre tabela existente falharia no
meio, possivelmente deixando estado parcial.

Esta branch alinha os carimbos locais aos que o banco registra. **Nada foi
aplicado ao banco, e nenhum `migration repair` foi executado.**

## Como a comparação foi feita

O SQL aplicado está guardado em `supabase_migrations.schema_migrations.
statements`, como o arquivo inteiro, comentários inclusive. A comparação foi
por impressão digital, em três passes: bruto, sem comentários, e com a
concatenação de literais colapsada.

| Resultado | Quantidade |
|---|---|
| Idênticos byte a byte | 14 |
| Diferentes **apenas em comentários** | 20 |
| SQL realmente diferente | 10 |

Os dez estão classificados abaixo. **Em todos, o arquivo local é igual ou mais
forte que o remoto** — em nenhum foi preciso preservar a forma remota nem
dividir a migração.

## Os três placeholders

Três migrações existem no histórico do banco e não no repositório, porque o
repositório empacotou o efeito delas em arquivos vizinhos. Os placeholders
existem para o histórico ter as mesmas versões dos dois lados, e são
**deliberadamente no-op**: repetir o SQL remoto faria um banco novo executar a
mesma redefinição duas vezes, a segunda com a versão mais antiga.

| Carimbo remoto | Placeholder | Efeito real vive em |
|---|---|---|
| `20260830140944` | `publish_brand_import_requires_existing_source` | `20260830140909_import_source_must_exist_and_deletion_queue.sql` |
| `20260902120623` | `search_chunks_within_one_brand` | `20260902120552_lexical_retrieval_by_brand.sql` |
| `20260902120847` | `publish_records_source_pages` | `20260902120552_lexical_retrieval_by_brand.sql` |

## Manifesto completo

| Carimbo antigo | Carimbo remoto | Migração | Classificação | Absorção |
|---|---|---|---|---|
| `20260717180341` | `20260829130830` | `create_profiles_table` | idêntico ou só comentários | — |
| `20260717202208` | `20260829130850` | `add_workspaces_and_ai_settings` | idêntico ou só comentários | — |
| `20260717202237` | `20260829130901` | `lock_down_handle_new_profile_rpc` | idêntico ou só comentários | — |
| `20260721132847` | `20260829130927` | `add_ai_routing_policies` | idêntico ou só comentários | — |
| `20260721132938` | `20260829130939` | `fix_ai_routing_delete_behavior` | idêntico ou só comentários | — |
| `20260721133445` | `20260829130949` | `index_ai_routing_composite_foreign_keys` | idêntico ou só comentários | — |
| `20260721173333` | `20260829131026` | `add_analysis_history` | idêntico ou só comentários | — |
| `20260721174508` | `20260829131038` | `index_analysis_history_foreign_keys` | idêntico ou só comentários | — |
| `20260721184318` | `20260829131115` | `add_brandville_content_admin` | idêntico ou só comentários | — |
| `20260721193521` | `20260829131141` | `add_brand_document_version_history` | idêntico ou só comentários | — |
| `20260827215051` | `20260829131207` | `add_brand_document_blocks` | idêntico ou só comentários | — |
| `20260827215129` | `20260829131218` | `drift_restrict_foundational_grants` | idêntico ou só comentários | — |
| `20260827215145` | `20260829131236` | `drift_policies_target_authenticated` | idêntico ou só comentários | — |
| `20260827215159` | `20260829131246` | `drift_handle_new_profile_empty_search_path` | idêntico ou só comentários | — |
| `20260828120000` | `20260829131303` | `add_brands_table` | idêntico ou só comentários | — |
| `20260829090000` | `20260829131403` | `drift_revoke_remaining_anon_grants` | idêntico ou só comentários | — |
| `20260829140000` | `20260829151827` | `prepare_brand_id_as_content_key` | espaço em parênteses (+2) | — |
| `20260829140100` | `20260829151946` | `index_brand_workspace_foreign_keys` | idêntico ou só comentários | — |
| `20260829150000` | `20260829155804` | `version_trigger_yields_to_brand_cascade` | idêntico ou só comentários | — |
| `20260829160000` | `20260829184324` | `history_actions_say_what_happened` | idêntico ou só comentários | — |
| `20260829170000` | `20260829221058` | `restore_origin_stays_inside_the_brand` | idêntico ou só comentários | — |
| `20260830100000` | `20260830132402` | `brand_imports_and_publish_rpc` | idêntico ou só comentários | — |
| `20260830110000` | `20260830134312` | `brand_imports_writable_by_owner_and_pdf_lifecycle` | idêntico ou só comentários | — |
| `20260830120000` | `20260830140909` | `import_source_must_exist_and_deletion_queue` | absorve etapa remota | contém `publish_brand_import` de `20260830140944` |
| `20260830130000` | `20260830141619` | `enqueue_abandoned_import_cleanup` | idêntico ou só comentários | — |
| `20260901090000` | `20260901181629` | `revoke_rls_bypassing_privileges` | idêntico ou só comentários | — |
| `20260901100000` | `20260901182424` | `import_limits_pages_and_provenance` | **comportamento**, já curado | o `coalesce` local não estava nesta etapa remota; redefinições posteriores o trouxeram, e a função viva no banco já o tem |
| `20260901180000` | `20260901215333` | `raise_import_bucket_to_100_mib` | idêntico ou só comentários | — |
| `20260901200000` | `20260901231527` | `workspace_slug_is_persisted_data` | literal de string | — |
| `20260901210000` | `20260902004327` | `assets_and_analysis_belong_to_a_brand` | literal de string | — |
| `20260901220000` | `20260902004818` | `deleting_a_brand_takes_every_file` | idêntico ou só comentários | — |
| `20260902090000` | `20260902120552` | `lexical_retrieval_by_brand` | absorve 2 etapas remotas | contém `buscar_trechos` de `20260902120623` e `publish_brand_import` de `20260902120847` |
| `20260902100000` | `20260902140641` | `drop_unused_gin_index` | literal de string | — |
| `20260902110000` | `20260902141310` | `ai_governance_matrix` | literal de string | — |
| `20260903120000` | `20260903144136` | `ai_budget_reservation_and_ledger` | literal de string | — |
| `20260903150000` | `20260903152804` | `ai_budget_expiry_and_kill_switch_read` | idêntico ou só comentários | — |
| `20260903170000` | `20260903165653` | `ai_ledger_price_snapshot` | idêntico ou só comentários | — |
| `20260903180000` | `20260903205231` | `brand_ai_role_length_limit` | idêntico ou só comentários | — |
| `20260903190000` | `20260903214958` | `ai_budgets_unique_nulls_not_distinct` | idêntico ou só comentários | — |
| `20260903210000` | `20260903223355` | `ai_ledger_server_only_functions` | texto de `comment on` (+47) | — |
| `20260903220000` | `20260904121755` | `ai_ledger_drop_legacy_authenticated_functions` | idêntico ou só comentários | — |
| `20260904150000` | `20260904142933` | `brand_documents_title_provenance` | idêntico ou só comentários | — |
| `20260904150500` | `20260904142954` | `publish_brand_import_title_provenance` | idêntico ou só comentários | — |
| `20260904160000` | `20260904144934` | `publish_brand_import_client_brand_id` | idêntico ou só comentários | — |

## O que ficava pendente — e não fica mais

`fix/contabilidade-ia` foi mesclada à `main` em 08/09/2026 (`cce53b8`, PR #3), e
o P0 aplicou a migração restante ao banco hospedado em 09/09. As duas migrações
foram absorvidas aqui e **renomeadas para os carimbos que o banco realmente
registrou** — conteúdo byte a byte idêntico, conferido por `sha256` antes e
depois:

| Antes | Depois — carimbo remoto | Situação |
|---|---|---|
| `20260905140000_ai_expiry_contencao_server_only_e_idade_minima.sql` | **`20260905153236`** | aplicada |
| `20260905160000_ai_ledger_exposicao_de_cobranca.sql` | **`20260909014823`** | aplicada pelo P0 em 09/09 |

Não há mais migração local sem par no banco. O acoplamento que a guarda
declarava em `DE_OUTRA_BRANCH` fechou, e a lista foi **esvaziada, não
afrouxada** — o teste que falhava de propósito nesse dia cumpriu o papel.

## Condições de integração — estado em 09/09/2026

O P0 aplicou `ai_ledger_exposicao_de_cobranca` ao banco hospedado como
`20260909014823`. Com os dois carimbos definitivos existindo, esta branch
absorveu a `main` (`cce53b8`), renomeou os dois arquivos e repetiu o replay.

| # | Condição | Estado |
|---|---|---|
| 1 | Replay completo a partir de banco vazio | ✅ `db reset` em PostgreSQL 17, **49 migrações** em ordem, terminando nas duas renomeadas |
| 2 | Schema final equivalente ao remoto | ✅ igualdade **exata**, ver abaixo |
| 3 | Advisors nos dois lados | ✅ conferidos e classificados, ver abaixo |
| 4 | Nenhuma migração pendente | ✅ `PENDENTES_ESPERADAS` vazia por fato: não há migração local sem par no banco |
| 5 | CI do tip atual verde | ❌ **vermelho por colisão declarada** — ver o fim deste documento |

**O ledger, provado por hash e não conferido a olho.** `historico-remoto.txt`
normalizado e o `string_agg` de `supabase_migrations.schema_migrations` dão o
mesmo `md5`, com 49 linhas dos dois lados:

```
80ac7a2c7e6001d9e099e0492d2e5820
```

**A equivalência de schema, com a MESMA consulta nos dois bancos:**

| | Local | Produção |
|---|---|---|
| Migrações | 49 | 49 |
| Colunas | 178 | 178 |
| Constraints | 120 | 120 |
| Índices | 67 | 67 |
| Políticas | 39 | 39 |
| Triggers (não internos) | 4 | 4 |
| Funções | 19 | 19 |
| Buckets | 3 | 3 |

Contagem igual não é schema igual — dois bancos podem ter 178 colunas
diferentes. Por isso três hashes estruturais, todos idênticos dos dois lados:

| Hash | O que entra nele |
|---|---|
| `34ddf9e60a90aedf95a39dd6fb790867` | toda coluna de tabela: nome, tipo formatado, `not null` |
| `c379c88d7805218a41475f308f30fb63` | toda função: nome, assinatura, tipo de retorno, `security definer` |
| `ea650cf6ed206197875aff8a12ca32c5` | toda política RLS: tabela, nome, comando, papéis |

O hash de funções inclui `prosecdef` de propósito: uma função que trocasse
`security definer` por `invoker` mudaria o hash sem mudar contagem nenhuma.

**Nota sobre os números anteriores.** A tabela de 08/09 dizia 177 colunas, 263
constraints, 66 índices, 7 triggers e 18 funções. As diferenças não são
mudança de banco: a consulta mudou. A de agora conta constraints só de tabelas
de `public`, exclui triggers internos e inclui a coluna e a função que a
migração nova trouxe. O que vale de uma comparação é ela ser a mesma dos dois
lados — e é.

### Advisors — conferidos nos dois lados, e classificados

| Achado | Produção | Local | Classificação |
|---|---|---|---|
| `SECURITY DEFINER` executável por `authenticated` | `kill_switch_ativo` | `kill_switch_ativo` | **igual** — dívida conhecida, exceção intencional ainda por registrar |
| Foreign keys sem índice de cobertura | 6 | 6, o mesmo conjunto | **igual** — dívida conhecida |
| Índices sem uso | 15 | não comparável | **regra de runtime**, não de schema: depende de `pg_stat`, e um banco recém-resetado e sem tráfego acusaria tudo |
| Proteção contra senha vazada desligada | sim | não comparável | **configuração do Auth hospedado**, sem equivalente local |

O lado local não tem a API de advisors do Supabase. As duas regras **derivadas
do schema** foram reproduzidas por consulta equivalente e devolveram o mesmo
resultado — mesma função, mesmas seis chaves. As outras duas não são
comparáveis por natureza, e dizer que "batem" seria inventar medida.

**Nenhum achado novo veio da migração.** O índice parcial que ela cria,
`ai_ledger_reservadas_idx`, não aparece entre os sem uso.

### Uma divergência de AMBIENTE, que não é lacuna de migração

O `service_role` tem privilégios diferentes nos dois lados:

| | Local | Produção |
|---|---|---|
| Grants de tabela | 45 | 105 |
| Funções executáveis | 6 | 18 |

A produção concede privilégio pleno ao `service_role` pelo bootstrap da
plataforma hospedada; o local concede **só o que as migrações declaram**.

**Não criar migração para replicar isso.** Codificar um padrão do fornecedor
dentro do schema destruiria o valor do stack local, que hoje é mais
restritivo — e essa é a direção segura: o que passa localmente passa em
produção, e um caminho que dependa de privilégio não declarado falha aqui em
vez de funcionar por acidente lá.

Conferido que não morde o produto: as RPCs chamadas com o cliente de serviço
são as quatro `_server` mais `expirar_reservas_de_ia`, todas concedidas por
migração. `kill_switch_ativo` parecia faltar, mas é concedida a `authenticated`
e chamada com o cliente de sessão.

### O que ainda falta antes de integrar

Um item só, e ele **não é desta frente**.

O CI desta branch está vermelho por **uma** asserção:
`src/platform/leak-guard.test.ts` lê a migração da exposição de cobrança pelo
caminho literal, com o carimbo antigo `20260905160000`. A renomeação para
`20260909014823` — exigida por esta reconciliação — derruba essa leitura.

**Esse arquivo pertence ao PR #9**, junto com `scripts/prova-de-concorrencia-ai-ledger.sh`
e o documento de evidências. O protocolo manda parar na fronteira do arquivo e
registrar a colisão em vez de editar uma linha na frente do outro agente, e é o
que foi feito: nada em `leak-guard.test.ts` foi tocado aqui.

As duas referências ao carimbo antigo, para quem for aplicá-las:

| Arquivo | Linha | O que muda |
|---|---|---|
| `src/platform/leak-guard.test.ts` | 1535 | caminho literal da migração → `20260909014823_ai_ledger_exposicao_de_cobranca.sql` |
| `scripts/prova-de-concorrencia-ai-ledger.sh` | 6 | comentário citando o nome antigo — cosmético, não quebra execução |

Enquanto isso não acontecer, **esta branch não pode ser declarada verde**, e
não está sendo. Testes locais: 559/560, e a única falha é essa.

### ✅ Portão fechado: a prova de concorrência (08/09/2026)

O que esta seção cobrava — recriar como artefato versionado as quatro corridas,
cujo ensaio de 05/09 se perdeu no reset sem ficar registrado — **foi feito e
está na `main`** pelo PR #3:

- `scripts/prova-de-concorrencia-ai-ledger.sh` — rig reexecutável
- `docs/evidencias/prova-de-concorrencia-ai-ledger-2026-09-08.md` — a execução registrada

Os dois caminhos são da `main`. Esta branch só os enxerga depois do rebase, e
por isso ficam como caminho e não como link — um link relativo aqui apontaria
para nada.

A espera voltou a ser **observada, e não presumida**: o rig procura um backend
em `wait_event_type = 'Lock'` em `pg_stat_activity` e trata ausência de espera
como falha — sem isso, um resultado correto pode ser acidente de agendamento. A
corrida 1 roda também contra uma réplica pré-correção, que reproduz o defeito
(`999` sobrescreve `111`); um teste que passasse dos dois lados não testaria a
correção.

Onze asserções, quatro esperas observadas, três execuções consecutivas verdes.

