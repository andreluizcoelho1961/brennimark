/**
 * Pessoas e acesso — a decisão de forma, fora da rota e fora da tela.
 *
 * QUEM AUTORIZA É O BANCO: `public.conceder_acesso` e `public.revogar_acesso`
 * conferem quem administra a conta, se a marca é desta conta e a forma de cada
 * papel, e a prova `scripts/prova-conceder-e-revogar.sh` tranca isso em 35
 * casos. O que vive aqui é a MESMA forma, decidida antes de a requisição sair —
 * para a pessoa receber "escolha ao menos uma marca" em vez de um erro de banco.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`,
 * que não resolve apelido de caminho.
 */

export const PAPEIS = ["administrador", "consulta"] as const;
export type Papel = (typeof PAPEIS)[number];

export function ehPapel(valor: unknown): valor is Papel {
  return typeof valor === "string" && (PAPEIS as readonly string[]).includes(valor);
}

/**
 * O e-mail, normalizado do mesmo jeito que o banco exige.
 *
 * Minúsculas e sem espaço nas pontas: sem isso, "Maria@x" e "maria@x" seriam
 * duas concessões, e a pessoa colheria só uma — a constraint do banco recusa a
 * forma errada, e aqui ela nem chega a ser enviada.
 */
export function normalizarEmail(valor: unknown): string {
  return typeof valor === "string" ? valor.trim().toLowerCase() : "";
}

export function emailPlausivel(email: string): boolean {
  // Deliberadamente frouxo: o dono da verdade sobre um e-mail é o servidor que
  // entrega a mensagem, não uma expressão regular. Isto só barra o obviamente
  // errado — sem arroba, com espaço no meio, ou grande demais.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 320;
}

export type Concessao = { nome: string; email: string; papel: Papel; marcas: string[] };

/** O nome que o administrador digita. Vai para a concessão e, na ativação, para
 *  o perfil — a pessoa não cai no "diga quem você é" depois de trocar a senha. */
export function normalizarNome(valor: unknown): string {
  return typeof valor === "string" ? valor.trim().replace(/\s+/g, " ") : "";
}
export type Recusa =
  | { motivo: "nome" }
  | { motivo: "email" }
  | { motivo: "papel" }
  | { motivo: "administrador-com-marca" }
  | { motivo: "consulta-sem-marca" };

/**
 * A forma de cada papel.
 *
 * Administrador alcança todas as marcas da conta, inclusive as futuras — por
 * isso não se concede marca a marca, e mandar marcas junto seria a tela dizendo
 * uma coisa e o banco outra. Consulta é sempre por marca, e pode ser uma, várias
 * ou todas: quem escolhe é quem administra.
 */
export function conferirConcessao(entrada: {
  nome: unknown; email: unknown; papel: unknown; marcas?: unknown;
}): { ok: true; concessao: Concessao } | { ok: false } & Recusa {
  const email = normalizarEmail(entrada.email);
  const nome = normalizarNome(entrada.nome);
  if (nome.length === 0 || nome.length > 120) return { ok: false, motivo: "nome" };
  if (!emailPlausivel(email)) return { ok: false, motivo: "email" };
  if (!ehPapel(entrada.papel)) return { ok: false, motivo: "papel" };

  const marcas = Array.isArray(entrada.marcas)
    ? entrada.marcas.filter((m): m is string => typeof m === "string" && m.length > 0)
    : [];

  if (entrada.papel === "administrador" && marcas.length > 0) {
    return { ok: false, motivo: "administrador-com-marca" };
  }
  if (entrada.papel === "consulta" && marcas.length === 0) {
    return { ok: false, motivo: "consulta-sem-marca" };
  }

  // Marca repetida na seleção não é erro de quem clicou: é ruído. Sai aqui.
  return { ok: true, concessao: { nome, email, papel: entrada.papel, marcas: [...new Set(marcas)] } };
}

export type Pessoa = {
  email: string;
  papel: Papel;
  marcas: { id: string; nome: string }[];
  pendente: boolean;
  desde: string | null;
  /** Nome digitado na concessão, ou o do perfil de quem já entrou. */
  nome?: string | null;
  /** Só para login com senha provisória criado por ESTA conta. */
  senhaProvisoriaAte?: string | null;
};

/**
 * A ordem da lista, e por que ela não é alfabética pura.
 *
 * Quem está esperando para entrar vem primeiro: é a linha sobre a qual alguém
 * precisa agir (reenviar, revogar, corrigir o e-mail). Depois, administradores
 * antes de quem consulta, e aí sim alfabética — dentro de cada grupo, a ordem
 * previsível é a que deixa achar uma pessoa pelo nome.
 */
export function ordenarPessoas(pessoas: readonly Pessoa[]): Pessoa[] {
  const peso = (p: Pessoa) => (p.pendente ? 0 : p.papel === "administrador" ? 1 : 2);
  return [...pessoas].sort((a, b) => peso(a) - peso(b) || a.email.localeCompare(b.email));
}

/**
 * O que a linha diz sobre o alcance da pessoa.
 *
 * Administrador não lista marcas: listar as de hoje mentiria amanhã, quando uma
 * marca nova nascer e ele também a alcançar.
 */
export function alcanceDaPessoa(pessoa: Pessoa, totalDeMarcas: number, ingles = false): string {
  if (pessoa.papel === "administrador") {
    return ingles ? "All brands in the account" : "Todas as marcas da conta";
  }
  const n = pessoa.marcas.length;
  if (n === 0) return ingles ? "No brand yet" : "Nenhuma marca ainda";
  // Com uma marca só, "todas" seria "As 1 marcas" — visto no ensaio de 18/09.
  // O nome da marca diz mais.
  if (n === totalDeMarcas && totalDeMarcas > 1) {
    return ingles ? `All ${n} brands (granted one by one)` : `As ${n} marcas (concedidas uma a uma)`;
  }
  return pessoa.marcas.map((m) => m.nome).join(", ");
}

/** A frase do resultado, para a tela não inventar texto a partir do código. */
export function textoDoResultado(resultado: string, ingles = false): string {
  const frases: Record<string, [string, string]> = {
    aplicada: ["Acesso concedido.", "Access granted."],
    // Sem senha na resposta: o login já existia (senha provisória ainda não
    // trocada, ou criado em outro lugar). O acesso espera a ativação.
    pendente: [
      "Concessão registrada. O acesso vale quando esta pessoa ativar o login.",
      "Grant recorded. Access starts once this person activates the sign-in.",
    ],
    "senha-provisoria": [
      "Login criado. Entregue a senha provisória à pessoa — ela troca a senha no primeiro acesso.",
      "Sign-in created. Hand the temporary password to the person — they change it at first sign-in.",
    ],
    "nova-senha": [
      "Nova senha provisória gerada. A anterior deixou de valer.",
      "New temporary password generated. The previous one no longer works.",
    ],
    revogada: ["Acesso removido.", "Access removed."],
    "marca-revogada": ["Marca removida do acesso desta pessoa.", "Brand removed from this person's access."],
    "pendencia-revogada": ["Convite cancelado.", "Invitation cancelled."],
  };
  const par = frases[resultado];
  if (!par) return ingles ? "Done." : "Pronto.";
  return ingles ? par[1] : par[0];
}
