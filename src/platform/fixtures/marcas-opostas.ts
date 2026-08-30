/**
 * Quatro marcas que não têm nada em comum.
 *
 * Elas existem para provar uma coisa só: a moldura é a mesma para todas, e
 * nenhuma cor atravessa do canvas para os instrumentos ou o contrário. Foram
 * escolhidas nos extremos porque é lá que a moldura quebra — marca preta sobre
 * moldura escura, marca branca sobre moldura escura, saturada que vibra contra
 * qualquer filete, e multicolorida que não tem um acento só.
 *
 * A azul institucional é obrigatória: ela expõe colisão com qualquer sinal azul
 * que venha a ser considerado para o Brennimark. Hoje o sinal é acromático e a
 * colisão não existe — a fixture protege a decisão futura, não um defeito atual.
 *
 * São LINHAS de banco, não objetos prontos. Elas atravessam parseBrandRow, o
 * mesmo tradutor que a aplicação usa, porque uma fixture que monta o objeto
 * final testa o componente e não o caminho.
 */
export interface LinhaDeMarcaFicticia {
  id: string;
  key: string;
  name: string;
  short_name: string;
  descriptor: string;
  language: string;
  metadata: Record<string, unknown>;
  navigation: Record<string, unknown>;
  theme: Record<string, unknown>;
  ai: Record<string, unknown>;
  legal: Record<string, unknown>;
  status_labels: Record<string, string> | null;
}

function linha(
  id: string,
  key: string,
  name: string,
  descriptor: string,
  language: string,
  theme: Record<string, string>,
  status_labels: Record<string, string> | null = null,
): LinhaDeMarcaFicticia {
  return {
    id,
    key,
    name,
    short_name: name.slice(0, 12),
    descriptor,
    language,
    metadata: { title: name, description: descriptor, language },
    navigation: {
      groups: ["Sistema"],
      groupCodes: { Sistema: "SI" },
      defaultDocSlug: "abertura",
      utilityLinks: [],
    },
    theme: { ...theme, fontStack: "var(--font-ui)" },
    ai: { knowledgeMode: "docs", chatRole: `Guia da ${name}.`, analysisRole: `Avalia peças da ${name}.` },
    legal: { footerNotice: "" },
    status_labels,
  };
}

/** Preta e sóbria: o caso em que marca e moldura quase se confundem. */
export const MARCA_ESCURA = linha(
  "11111111-1111-4111-8111-111111111111",
  "sobria", "Sóbria", "editorial de tipografia", "pt-BR",
  {
    background: "#0a0a0a", backgroundSecondary: "#0f0f0f", surface: "#141414",
    surfaceLight: "#1c1c1c", foreground: "#f2f2f2", muted: "#8a8a8a",
    accent: "#e8e8e8", accentSecondary: "#6f6f6f", border: "#2a2a2a", focus: "#ffffff",
  },
);

/** Branca e azul: obrigatória, pelo motivo no cabeçalho. */
export const MARCA_CLARA = linha(
  "22222222-2222-4222-8222-222222222222",
  "institucional", "Institucional", "saúde e previdência", "pt-BR",
  {
    background: "#ffffff", backgroundSecondary: "#f4f7fb", surface: "#eef3f9",
    surfaceLight: "#ffffff", foreground: "#0d1b2a", muted: "#5a6b7d",
    accent: "#0b4f9e", accentSecondary: "#3d7dd0", border: "#d3dde8", focus: "#0b4f9e",
  },
);

/** Saturada: vermelho e laranja, que vibram contra qualquer filete. */
export const MARCA_SATURADA = linha(
  "33333333-3333-4333-8333-333333333333",
  "mercado", "Mercado", "varejo de proximidade", "pt-BR",
  {
    background: "#e1251b", backgroundSecondary: "#c81c14", surface: "#ff8a1f",
    surfaceLight: "#ffc629", foreground: "#ffffff", muted: "#ffe0c2",
    accent: "#ffc629", accentSecondary: "#ffffff", border: "#ff8a1f", focus: "#ffffff",
  },
);

/**
 * Multicolorida, em inglês, com vocabulário editorial próprio.
 *
 * É a fixture que cruza tudo de uma vez: manual em inglês enquanto a interface
 * fala português, e estados chamados por outros nomes. Se algum desses três
 * atravessar para a moldura, aparece aqui.
 */
export const MARCA_EXPRESSIVA = linha(
  "44444444-4444-4444-8444-444444444444",
  "festival", "Festival", "arts programme", "en",
  {
    background: "#1b0033", backgroundSecondary: "#2d0a4e", surface: "#00c2a8",
    surfaceLight: "#ffe66d", foreground: "#fff8f0", muted: "#c9a7e8",
    accent: "#ff2d95", accentSecondary: "#00c2a8", border: "#5a2d82", focus: "#ffe66d",
  },
  { ready: "Documented", draft: "Under review", pending: "No guidance" },
);

export const MARCAS_OPOSTAS = [
  MARCA_ESCURA,
  MARCA_CLARA,
  MARCA_SATURADA,
  MARCA_EXPRESSIVA,
] as const;
