import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

/**
 * Guarda contra texto em português escrito direto no código.
 *
 * Quando uma pasta ou arquivo é migrado para os catálogos de tradução
 * (`src/i18n/mensagens/*.json`), ele entra em MIGRADAS e nunca mais pode ter
 * frase em português no código — só chave. Sem isto, o texto volta numa
 * refatoração qualquer, e o defeito só aparece para o primeiro cliente em
 * inglês.
 *
 * A lista cresce a cada fatia migrada. Cobre o que já foi migrado, não é
 * promessa sobre o que ainda não foi (mesma regra de `leak-guard.test.ts`).
 *
 * LIMITE CONHECIDO: o detector reconhece português por acento ou por palavras
 * de ligação ("não", "para", "com"…). Uma palavra solta sem acento ("Salvar")
 * passa. Ele pega frase, que é onde está quase todo o texto da interface; a
 * revisão cobre o resto.
 */
const MIGRADAS: string[] = [
  "src/i18n/request.ts",
  "src/platform/locale-client.tsx",
  "src/components/shell/TelaInicial.tsx",
  "src/components/shell/EmptyBrandState.tsx",
  "src/app/(plataforma)/w/[workspaceSlug]/b/[brandKey]/docs/not-found.tsx",
  "src/components/acesso/PedidoDeNovaSenha.tsx",
  "src/components/acesso/NovaSenha.tsx",
  "src/components/demonstracao/EntradaNoTour.tsx",
  "src/components/ajuda/AjudaDaMoldura.tsx",
  "src/components/ProvedorDeTraducao.tsx",
  "src/components/IdiomaDaSessao.tsx",
  "src/components/site/Cabecalho.tsx",
  "src/components/site/SeletorDeIdiomaDoSite.tsx",
  "src/components/site/AvisoDeIdioma.tsx",
  "src/components/site/LinksDasFerramentas.tsx",
  "src/components/site/MolduraDoSite.tsx",
  "src/components/site/EntrarOuAbrir.tsx",
  "src/components/site/paginas/Manifesto.tsx",
  "src/components/site/paginas/Agencias.tsx",
  "src/components/site/paginas/Empresas.tsx",
  "src/components/site/paginas/Studio.tsx",
  "src/components/site/paginas/LicencaDeFontes.tsx",
  "src/components/site/comum.tsx",
  "src/components/site/paginas/Manual.tsx",
  "src/components/site/paginas/Complementos.tsx",
  "src/components/site/paginas/Materiais.tsx",
  "src/components/site/paginas/Entrega.tsx",
  "src/components/site/paginas/Vini.tsx",
  "src/components/site/paginas/Seguranca.tsx",
  "src/components/site/paginas/Termos.tsx",
  "src/components/site/paginas/Privacidade.tsx",
  "src/components/site/DocumentoLegal.tsx",
  "src/components/site/paginas/Fonts.tsx",
  "src/components/site/JanelaDoFonts.tsx",
  "src/components/site/PedirConviteDoFonts.tsx",
  "src/components/site/SecoesDaHome.tsx",
  "src/components/site/TelasDaHome.tsx",
  "src/components/site/TourDaPlataforma.tsx",
  "src/app/[lang]/page.tsx",
  "src/components/site/paginas/Ajuda.tsx",
  "src/components/site/ajuda/ArtigoDaAjuda.tsx",
  "src/components/site/ajuda/BuscaDaAjuda.tsx",
  "src/components/site/ajuda/CategoriaDaAjuda.tsx",
  "src/components/ajuda/PainelComoUsar.tsx",
  "src/components/ferramentas/Cores.tsx",
  "src/components/ferramentas/CoresDoAssinante.tsx",
  "src/components/ferramentas/Grids.tsx",
  "src/components/ferramentas/GridsDoAssinante.tsx",
  "src/components/ferramentas/KitAvulso.tsx",
  "src/components/ferramentas/KitDoAssinante.tsx",
  "src/components/ferramentas/CadastroParaBaixar.tsx",
  "src/components/ferramentas/ConviteDaFerramenta.tsx",
  "src/components/ferramentas/AbrirEmJanela.tsx",
  "src/components/ferramentas/BarraDaJanela.tsx",
  "src/app/[lang]/ferramentas/(com-site)/cores/page.tsx",
  "src/app/[lang]/ferramentas/(com-site)/grids/page.tsx",
  "src/app/[lang]/ferramentas/(com-site)/kit/page.tsx",
  "src/app/(plataforma)/w/[workspaceSlug]/b/[brandKey]/docs/cores/page.tsx",
  "src/app/(plataforma)/w/[workspaceSlug]/b/[brandKey]/docs/grids/page.tsx",
  "src/app/(plataforma)/w/[workspaceSlug]/b/[brandKey]/docs/kit/page.tsx",
  "src/lib/grids/formatos.ts",
  "src/lib/grids/calcular.ts",
  "src/lib/grids/marca.ts",
  "src/lib/grids/idml.ts",
  "src/lib/grids/logo-no-navegador.ts",
  "src/lib/cores/cores.ts",
  "src/lib/kit/tamanhos.ts",
  "src/lib/kit/pacote.ts",
  "src/lib/kit/desenhar-no-navegador.ts",
  "src/lib/kit/materiais-do-kit.ts",
  "src/app/(plataforma)/receber/[codigo]/page.tsx",
  "src/app/(plataforma)/esqueci-senha/page.tsx",
  "src/app/(plataforma)/not-found.tsx",
  "src/app/(plataforma)/sair/[token]/page.tsx",
  "src/app/(plataforma)/confirmar/[token]/page.tsx",
  "src/components/cadastro/SaidaDoCadastro.tsx",
  "src/components/cadastro/ConfirmacaoDoCadastro.tsx",
  "src/lib/email/mensagens.ts",
  "src/components/site/LembrarIdiomaDoSite.tsx",
  "src/app/(plataforma)/assinar/obrigado/page.tsx",
  "src/app/(plataforma)/assinar/page.tsx",
  "src/components/cobranca/SenhaNaVolta.tsx",
  "src/components/cobranca/FormularioDeAssinatura.tsx",
];

const ACENTOS = /[áàâãéêíóôõúüç]/i;
const LIGACAO = /\b(não|nao|para|com|uma|você|voce|seu|sua|ou|por|que|dos|das|nos|nas|ao|aos|está|esta|são|sao)\b/gi;

/** O texto parece português? Acento, ou duas palavras de ligação, ou "não"/"você". */
export function parecePortugues(texto: string): boolean {
  if (ACENTOS.test(texto)) return true;
  const achadas = texto.match(LIGACAO) ?? [];
  if (achadas.some((p) => /^(não|nao|você|voce)$/i.test(p))) return true;
  return achadas.length >= 2;
}

/** Tira comentários. Barras de URL ("https://") sobrevivem: `//` só vale após espaço. */
function semComentarios(codigo: string): string {
  return codigo.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");
}

/** Cada trecho de texto do código: literais entre aspas e texto solto de JSX. */
export function textosDoCodigo(codigo: string): string[] {
  const limpo = semComentarios(codigo);
  const literais = [...limpo.matchAll(/(["'`])((?:\\.|(?!\1)[^\\\n])*)\1/g)].map((m) => m[2]);
  // Texto de JSX pode ocupar várias linhas: junta os espaços antes de julgar.
  const jsx = [...limpo.matchAll(/>([^<>{}]+)</g)].map((m) => m[1].replace(/\s+/g, " "));
  return [...literais, ...jsx].map((t) => t.trim()).filter(Boolean);
}

export function frasesEmPortugues(codigo: string): string[] {
  return textosDoCodigo(codigo).filter(parecePortugues);
}

test("o detector pega frase em português no JSX e em literal", () => {
  assert.deepEqual(frasesEmPortugues(`<button>Salvar alterações</button>`), ["Salvar alterações"]);
  assert.deepEqual(frasesEmPortugues(`const m = "Você não tem acesso";`), ["Você não tem acesso"]);
  // O limite conhecido, registrado como prova: sem acento e com uma só palavra de ligação, passa.
  assert.deepEqual(frasesEmPortugues("const m = `Erro ao salvar o arquivo`;"), []);
  assert.deepEqual(frasesEmPortugues(`aviso("falha para conectar com o servidor")`), [
    "falha para conectar com o servidor",
  ]);
});

test("o detector pega parágrafo de JSX que ocupa várias linhas", () => {
  const codigo = "<p>\n  O manual original é o PDF\n  enviado na importação.\n</p>";
  assert.deepEqual(frasesEmPortugues(codigo), ["O manual original é o PDF enviado na importação."]);
});

test("o detector deixa passar chave, endereço, comentário e código", () => {
  assert.deepEqual(frasesEmPortugues(`t("comum.salvar")`), []);
  assert.deepEqual(frasesEmPortugues(`fetch("https://exemplo.com/api")`), []);
  assert.deepEqual(frasesEmPortugues(`// Não tem acesso\nconst a = 1; /* explicação com ação */`), []);
  assert.deepEqual(frasesEmPortugues(`import { x } from "@/platform/locale";`), []);
  assert.deepEqual(frasesEmPortugues(`const lista: Array<string> = [];`), []);
});

test("nenhum arquivo migrado tem texto em português no código", () => {
  for (const arquivo of MIGRADAS) {
    const codigo = readFileSync(path.join(process.cwd(), arquivo), "utf8");
    assert.deepEqual(
      frasesEmPortugues(codigo),
      [],
      `${arquivo} tem texto em português no código; mova para src/i18n/mensagens e use a chave`,
    );
  }
});
