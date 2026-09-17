import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

/**
 * A guarda do histórico de migrações.
 *
 * Em 05/09/2026 o repositório e o banco tinham os mesmos 44 nomes de migração
 * e **nenhuma versão em comum** — `supabase db push` teria tentado reaplicar
 * tudo. A reconciliação alinhou os carimbos; estes testes existem para que ela
 * não se desfaça sem que alguém veja.
 *
 * O que eles NÃO fazem: provar que o replay desde zero reproduz o banco. Isso
 * exige um stack local, e está registrado em `supabase/RECONCILIACAO.md` como
 * condição de integração. Uma guarda textual não substitui um banco vazio.
 */
const raiz = process.cwd();
const DIR = path.join(raiz, "supabase", "migrations");
const HISTORICO = path.join(raiz, "supabase", "historico-remoto.txt");

/** As migrações locais, ordenadas, com carimbo e nome separados. */
function migracoesLocais(): { versao: string; nome: string; arquivo: string }[] {
  return fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((arquivo) => {
      const corte = arquivo.indexOf("_");
      return {
        versao: arquivo.slice(0, corte),
        nome: arquivo.slice(corte + 1, -4),
        arquivo,
      };
    });
}

/** O histórico do banco, como registrado no repositório. */
function historicoRemoto(): Map<string, string> {
  const linhas = fs.readFileSync(HISTORICO, "utf8").trim().split("\n");
  return new Map(linhas.map((l) => {
    const [versao, nome] = l.trim().split(/\s+/);
    return [versao, nome];
  }));
}

/**
 * As migrações que ainda não foram aplicadas ao banco.
 *
 * Lista explícita, e não "tudo que não está no histórico": uma pendência que
 * aparece por engano — arquivo renomeado errado, carimbo digitado torto — tem
 * exatamente a mesma forma de uma pendência legítima. Declarar quais são as
 * legítimas é o que permite reprovar as outras.
 *
 * Vazia em 09/09/2026 porque não há pendência: `ai_ledger_exposicao_de_cobranca`
 * era a única, e foi aplicada ao banco hospedado como `20260909014823`. Medido
 * contra o ledger de produção, não presumido — ver `supabase/RECONCILIACAO.md`.
 */
const PENDENTES_ESPERADAS: string[] = [
  // `kill_switch_excecao_registrada` saiu daqui em 10/09/2026: aplicada ao
  // banco hospedado por decisão do proprietário, carimbada `20260910215914`.
  // Medido depois: só o comentário mudou — corpo, grants, SECURITY DEFINER e
  // search_path idênticos ao estado anterior.
  /**
   * Alinha o bucket de importação ao teto real do plano gratuito (50 MB).
   *
   * Escrita em 09/09/2026, NÃO aplicada em produção: mexer no teto do Storage
   * hospedado muda o que o produto aceita de um cliente, e aplicar em banco é
   * decisão do proprietário. O requisito de 100 MiB continua de pé em
   * `TETO_DO_PRODUTO_BYTES` — o que esta migration corrige é o bucket prometer
   * um tamanho que a plataforma recusa, fazendo a pessoa pagar o upload
   * inteiro para receber um erro conhecido antes do primeiro byte.
   */
  "bucket_alinhado_ao_plano_gratuito",
  /**
   * A conta nasce da assinatura, e todo acesso é concedido.
   *
   * Escrita em 17/09/2026, NÃO aplicada em produção. Entrar deixa de criar
   * conta; administrar a conta passa a implicar administrar as marcas dela (sem
   * cópia em `brand_members`); nasce a concessão pendente por e-mail, colhida no
   * primeiro login. Provada em `scripts/prova-acesso-concedido.sh` (30 casos), e
   * as provas de acesso, Storage e manifesto foram reescritas para a regra nova.
   */
  "acesso_concedido",
  // `item_e_variante` saiu daqui em 17/09/2026: aplicada ao banco hospedado por
  // autorização nominal do André, carimbada `20260917170413`, e o arquivo
  // renomeado. Conferido antes: zero assets em produção. Conferido depois:
  // impressão de políticas, colunas, travas, gatilhos, índices e grants IDÊNTICA
  // à local (a5cddaa64dc4eef7008bb31184de8517, 88 peças).
  // `consumo_de_armazenamento` saiu daqui em 17/09/2026: aplicada ao banco
  // hospedado por autorização nominal do André, carimbada `20260917170445`,
  // seguida de `consumo_de_armazenamento_so_leitura` (`20260917170551`), que
  // revoga os privilégios de escrita que o padrão do Supabase hospedado dá a
  // toda tabela nova. Conferido depois das duas: impressão IDÊNTICA à local
  // (534292e233d43a7a452989a2a3e3497d, 19 peças).
  // `apagar_marca_leva_imagens` saiu daqui em 17/09/2026: aplicada ao banco
  // hospedado por autorização do André, carimbada `20260917111737`, e o
  // arquivo renomeado. Conferido depois: impressão da função IDÊNTICA à local
  // (2b19c11ad89a7ac3a0ee8bb650cb26be).
  // `apagar_por_marca` saiu daqui em 16/09/2026: aplicada ao banco hospedado
  // por autorização nominal do André, carimbada `20260916165048`, e o arquivo
  // renomeado. Conferido depois: impressão das duas funções IDÊNTICA à local
  // (6abf4385bb5b6a115ddf3447c2c66a2e), e restam 4 funções decidindo por conta
  // — as quatro legítimas (sistema, cadastro, criar marca, limpar PDF sem
  // marca).
  // `documento_fonte_por_marca` saiu daqui em 16/09/2026: aplicada ao banco
  // hospedado por autorização nominal do André, carimbada `20260916143418`, e
  // o arquivo renomeado. Conferido depois: impressão das duas funções IDÊNTICA
  // à local (ecffa360198aaeb8fb94f6635ced735a).
  // `identidade_do_acesso_imutavel` saiu daqui em 15/09/2026: aplicada ao
  // banco hospedado por autorização nominal do André, carimbada
  // `20260915215809`, e o arquivo renomeado para esse carimbo. Conferido
  // depois: impressão digital da função IDÊNTICA à local
  // (c210330bf6f372421c45213ccb6cb35e), e tentar mover um acesso real em
  // produção devolveu 23514 com a trava nomeada, sem mudar nenhuma linha.
  // `registro_de_download` saiu daqui em 15/09/2026: aplicada ao banco
  // hospedado por autorização nominal do André, junto com `storage_por_marca`
  // (PR #39), carimbada `20260915222109`, e o arquivo renomeado para esse
  // carimbo. Conferido depois: impressão das policies e da função IDÊNTICA à
  // local (1f60d4f3f86942975c639a19666e5aba), e `authenticated` só com
  // INSERT e SELECT na tabela.
  // `storage_por_marca` saiu daqui em 15/09/2026: aplicada ao banco hospedado
  // por autorização nominal do André, carimbada `20260915222216`, e o arquivo
  // renomeado para esse carimbo. Conferido depois: `storage.objects` com 13
  // policies e impressão 1b8dba31cf8cadd12a14425f4a61f2a5 — a mesma que o
  // teste do arquivo previu partindo das 11 antigas, cuja impressão em
  // produção (7e6931fb987263fdeb464ae8d91c173f) também foi conferida contra a
  // reconstrução local antes de aplicar. Com a sessão do dono: 28 imagens de
  // página e 2 PDFs visíveis, como antes.
  // `acesso_por_marca` e `registro_de_acesso_por_marca` saíram daqui em
  // 13/09/2026: aplicadas ao banco hospedado por decisão do proprietário,
  // carimbadas `20260913223226` e `20260913223333` — e os arquivos foram
  // renomeados para esses carimbos, porque o repositório precisa bater com o
  // ledger. Conferido depois de aplicar: a impressão digital das 30 policies e
  // das 4 funções envolvidas é IDÊNTICA à do banco local
  // (c9b962c8b959f06eb7b076e92349a56d), e a semeadura deixou as 2 marcas da
  // única conta com as quatro capacidades para o dono. Nenhuma marca ficou sem
  // ninguém.
  // `asset_descontinuado_em_vez_de_apagado` saiu daqui em 13/09/2026: aplicada
  // ao banco hospedado junto com as duas de acesso, carimbada
  // `20260913224905`, e o arquivo renomeado para esse carimbo. Só acrescenta
  // colunas nulas, constraints e um gatilho a `brand_assets`; nenhuma das 0
  // linhas existentes mudou. Impressão digital das constraints, dos índices e
  // da função IDÊNTICA à do banco local (7fb93f3ea844db1a8c802d286ac73c29).
  // `documento_fonte_e_manifesto_por_pagina` saiu daqui em 11/09/2026:
  // aplicada ao banco hospedado por autorização nominal do proprietário,
  // carimbada `20260911155633`. Conteúdo aplicado idêntico ao arquivo validado
  // em `6ca600e`; RLS, grants e SECURITY DEFINER conferidos depois.
];

/**
 * O que a reconciliação NÃO alcança nesta base, porque pertence a outra branch.
 *
 * **Vazio desde 09/09/2026, e vazio por fato, não por omissão.** O acoplamento
 * que estas listas declaravam era com `fix/contabilidade-ia`: esta branch saía
 * de `49ce1fe`, anterior às duas migrações escritas lá. Aquela branch foi
 * mesclada à `main` (`cce53b8`, PR #3), a `main` foi absorvida aqui, e as duas
 * migrações passaram a existir nesta base — com os carimbos remotos
 * definitivos, `20260905153236` e `20260909014823`.
 *
 * O teste abaixo é que forçou isto: ele falhava de propósito no dia em que os
 * itens chegassem. Falhou, e a lista foi esvaziada em vez de afrouxada.
 *
 * A estrutura fica porque o mecanismo pode ser preciso de novo — outra branch
 * pode voltar a escrever migração que esta base ainda não vê. Um acoplamento
 * entre branches que ninguém declara é um acoplamento que alguém descobre no
 * merge.
 */
const DE_OUTRA_BRANCH: { carimbosSemArquivo: string[]; pendentes: string[] } = {
  /** Carimbo aplicado no banco cujo arquivo vive noutra branch. */
  carimbosSemArquivo: [],
  /** Migração escrita noutra branch e ainda não aplicada ao banco. */
  pendentes: [],
};

/** Placeholders: existem no banco, e o efeito vive noutro arquivo local. */
const PLACEHOLDERS = [
  "20260830140944_publish_brand_import_requires_existing_source",
  "20260902120623_search_chunks_within_one_brand",
  "20260902120847_publish_records_source_pages",
];

test("nenhum carimbo de migração aparece duas vezes", () => {
  // Dois arquivos com o mesmo carimbo é ordem indefinida — e, no caso de
  // `create or replace`, "qual versão ficou" vira sorteio.
  const vistos = new Map<string, string>();
  for (const m of migracoesLocais()) {
    const anterior = vistos.get(m.versao);
    assert.equal(anterior, undefined, `carimbo ${m.versao} em ${anterior} e ${m.arquivo}`);
    vistos.set(m.versao, m.arquivo);
  }
});

test("todo carimbo local existe no histórico do banco, salvo as pendências declaradas", () => {
  const remoto = historicoRemoto();
  const inesperadas = migracoesLocais()
    .filter((m) => !remoto.has(m.versao))
    .filter((m) => !PENDENTES_ESPERADAS.includes(m.nome));
  assert.deepEqual(
    inesperadas.map((m) => m.arquivo),
    [],
    "migração local sem par no histórico e não declarada como pendente",
  );
});

test("as pendências declaradas existem de fato — a lista não pode virar ficção", () => {
  // Sem isto, remover a migração pendente e esquecer de tirá-la da lista
  // deixaria a guarda anterior passando por vacuidade.
  const nomes = new Set(migracoesLocais().map((m) => m.nome));
  for (const p of PENDENTES_ESPERADAS) {
    assert.ok(nomes.has(p), `pendência declarada não existe no repositório: ${p}`);
  }
});

test("o que foi atribuído a outra branch precisa sair da lista quando chegar aqui", () => {
  /*
   * A guarda contra a lista apodrecer. No dia em que `fix/contabilidade-ia`
   * for rebaseada sobre esta branch, os dois itens passam a existir — e
   * continuar declarando-os como "de outra branch" faria as guardas acima
   * ignorarem migrações que elas deveriam conferir.
   *
   * Este teste falha nesse dia, de propósito: é o lembrete de mover
   * `ai_ledger_exposicao_de_cobranca` para PENDENTES_ESPERADAS e de esvaziar
   * `carimbosSemArquivo`.
   */
  const versoes = new Set(migracoesLocais().map((m) => m.versao));
  const nomes = new Set(migracoesLocais().map((m) => m.nome));

  for (const v of DE_OUTRA_BRANCH.carimbosSemArquivo) {
    assert.ok(
      !versoes.has(v),
      `${v} já existe aqui: tire-o de DE_OUTRA_BRANCH.carimbosSemArquivo`,
    );
  }
  for (const n of DE_OUTRA_BRANCH.pendentes) {
    assert.ok(
      !nomes.has(n),
      `${n} já existe aqui: mova-o de DE_OUTRA_BRANCH.pendentes para PENDENTES_ESPERADAS`,
    );
  }
});

test("nome local e nome remoto batem para o mesmo carimbo", () => {
  // O carimbo certo com o nome errado passaria na guarda de existência e
  // ainda assim descreveria a migração errada.
  const remoto = historicoRemoto();
  for (const m of migracoesLocais()) {
    const nomeRemoto = remoto.get(m.versao);
    if (!nomeRemoto) continue;
    assert.equal(m.nome, nomeRemoto, `carimbo ${m.versao}: local "${m.nome}" vs banco "${nomeRemoto}"`);
  }
});

test("os três placeholders existem", () => {
  const arquivos = new Set(migracoesLocais().map((m) => m.arquivo));
  for (const p of PLACEHOLDERS) {
    assert.ok(arquivos.has(`${p}.sql`), `placeholder ausente: ${p}.sql`);
  }
});

test("os placeholders são no-op — nenhum deles executa DDL", () => {
  /*
   * É a metade que importa. Um placeholder que ganhasse o SQL remoto faria um
   * banco novo executar a mesma redefinição duas vezes, a segunda com a versão
   * mais antiga — trocaria a inconsistência de histórico por uma de
   * comportamento, que é bem pior.
   */
  for (const p of PLACEHOLDERS) {
    const bruto = fs.readFileSync(path.join(DIR, `${p}.sql`), "utf8");
    const sql = bruto
      .split("\n")
      .map((l) => l.replace(/--.*$/, "").trim())
      .filter(Boolean)
      .join(" ");
    assert.equal(sql, "select 1 where false;", `${p} deixou de ser no-op: ${sql.slice(0, 120)}`);
    assert.match(bruto, /PLACEHOLDER/, `${p} precisa se declarar placeholder`);
    assert.match(bruto, /\.sql/, `${p} precisa nomear o arquivo que contém o efeito real`);
  }
});

test("todo carimbo do histórico remoto tem arquivo local", () => {
  // A direção oposta da guarda de pendências: um carimbo aplicado no banco sem
  // arquivo é o buraco que os placeholders existem para fechar. Se um novo
  // aparecer, é sinal de migração aplicada fora do repositório.
  const locais = new Set(migracoesLocais().map((m) => m.versao));
  const semArquivo = [...historicoRemoto().keys()]
    .filter((v) => !locais.has(v))
    .filter((v) => !DE_OUTRA_BRANCH.carimbosSemArquivo.includes(v));
  assert.deepEqual(semArquivo, [], "carimbo no banco sem arquivo no repositório");
});

// ─── O stack local precisa reproduzir as migrações, não o plano contratado ──

test("o teto de arquivo local não fica abaixo do que a migração declara", () => {
  /*
   * Estritamente ACIMA, e não igual.
   *
   * A migração `raise_import_bucket_to_100_mib` põe o bucket em 100 MiB. Se o
   * teto global valesse o mesmo, a fixture que passa dos 100 MiB seria recusada
   * pelo GLOBAL, e a recusa não diria nada sobre o bucket — que é justamente o
   * que o teste quer verificar. O padrão da CLI (50MiB) é pior ainda: recusaria
   * até a fixture válida, fazendo configuração de ambiente parecer defeito do
   * produto.
   */
  const config = fs.readFileSync(path.join(raiz, "supabase", "config.toml"), "utf8");
  const casado = config.match(/^file_size_limit = "(\d+)MiB"/m);
  assert.ok(casado, "config.toml não declara file_size_limit ativo");
  assert.ok(
    Number(casado[1]) > 100,
    `file_size_limit local é ${casado[1]}MiB; precisa ficar ESTRITAMENTE acima ` +
      "dos 100 MiB do bucket, senão a fixture acima do limite é recusada pelo " +
      "teto global e a recusa não prova nada sobre a migração",
  );
});

test("o seed fica desligado — replay tem que ser só de migração", () => {
  // Dado semeado entra na comparação de schema sem ter vindo de migração, e
  // transforma "o schema bate" em "bate, menos o que o seed mexeu".
  const config = fs.readFileSync(path.join(raiz, "supabase", "config.toml"), "utf8");
  const bloco = config.slice(config.indexOf("[db.seed]"));
  const ate = bloco.slice(0, bloco.indexOf("\n[", 1));
  assert.match(ate, /^enabled = false$/m, "o seed precisa ficar desligado para o replay");
});
