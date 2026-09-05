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
 */
const PENDENTES_ESPERADAS: string[] = [];

/**
 * O que a reconciliação NÃO alcança nesta base, porque pertence a outra branch.
 *
 * `fix/migration-history` sai de `49ce1fe`, anterior às duas migrações escritas
 * em `fix/contabilidade-ia`. Elas precisam do mesmo tratamento — uma de
 * renomeação, outra de declaração como pendente — e isso acontece quando
 * aquela branch for rebaseada sobre esta.
 *
 * Declarado aqui, e não silenciado, porque um acoplamento entre branches que
 * ninguém escreve é um acoplamento que alguém vai descobrir no merge.
 */
const DE_OUTRA_BRANCH = {
  /** Aplicada no banco; o arquivo local vive em `fix/contabilidade-ia`. */
  carimbosSemArquivo: ["20260905153236"],
  /** Não aplicada; será a única pendente depois do rebase. */
  pendentes: ["ai_ledger_exposicao_de_cobranca"],
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
   * A CLI gera `file_size_limit = "50MiB"` por padrão. A migração
   * `raise_import_bucket_to_100_mib` põe o bucket de importação em 104857600
   * bytes, que é o requisito do produto — um teto GLOBAL menor recusaria o
   * upload antes de a regra do bucket ser consultada, e a recusa se pareceria
   * com defeito do produto em vez de configuração do ambiente.
   */
  const config = fs.readFileSync(path.join(raiz, "supabase", "config.toml"), "utf8");
  const casado = config.match(/^file_size_limit = "(\d+)MiB"/m);
  assert.ok(casado, "config.toml não declara file_size_limit ativo");
  assert.ok(
    Number(casado[1]) >= 100,
    `file_size_limit local é ${casado[1]}MiB, abaixo dos 100 MiB que a migração declara`,
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
