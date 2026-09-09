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

## O que fica pendente

`fix/contabilidade-ia` **foi mesclada à `main` em 08/09/2026** (`cce53b8`, PR #3).
As duas migrações que esta base não conhecia agora vivem na `main`, e a direção
do rebase inverteu: é esta branch que passa a se apoiar nelas.

| Arquivo | Situação |
|---|---|
| `20260905140000_ai_expiry_contencao_server_only_e_idade_minima.sql` | **aplicada** no banco como `20260905153236` — o `git mv` para o carimbo de produção continua devendo, e agora é trabalho **desta** branch, no rebase sobre a `main` |
| `20260905160000_ai_ledger_exposicao_de_cobranca.sql` | **não aplicada** em produção — é, e deve continuar sendo, a única migração local pendente. Foi aplicada ao stack **local** em 08/09 para a prova de concorrência, sem carimbo em `schema_migrations`, e `db reset` desfaz |

## Condições de integração — estado em 08/09/2026

Com o runtime de contêiner instalado, o stack local subiu e o replay foi
executado. Estado por condição:

| # | Condição | Estado |
|---|---|---|
| 1 | Replay completo a partir de banco vazio | ✅ duas execuções, `exit 0`, 47 migrações em ordem |
| 2 | Schema final equivalente ao remoto | ✅ medido, ver tabela abaixo |
| 3 | Advisors e testes verdes | ⏳ testes verdes; advisors ainda não conferidos nos dois lados |
| 4 | Só `charge_exposed_at` pendente | ✅ com o PR #3 na `main`, a contenção deixou de ser "de outra branch"; `charge_exposed_at` segue a única não aplicada em produção |

**A equivalência, medida com a mesma consulta nos dois bancos:**

| | Local | Produção |
|---|---|---|
| Colunas | 177 | 177 |
| Constraints | 263 | 263 |
| Índices | 66 | 66 |
| Políticas | 39 | 39 |
| Triggers | 7 | 7 |
| Funções | 18 | 18 |

Local com 47 migrações (última `20260904144934`), produção com 48 (última
`20260905153236`). O delta é exatamente a contenção da expiração, que pertence
a `fix/contabilidade-ia` — o mesmo que `DE_OUTRA_BRANCH` já declarava na
guarda.

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

- Conferir **advisors** nos dois bancos. **É o único item restante.**
- Fazer o `git mv` de `20260905140000` para o carimbo `20260905153236` no rebase
  sobre a `main`, conforme a tabela de pendências acima.

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

