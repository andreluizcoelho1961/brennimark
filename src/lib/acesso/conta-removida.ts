/**
 * Como a tela mostra uma pessoa cujo login foi apagado — LGPD, 24/09/2026.
 *
 * O banco troca o e-mail dela, nos registros que guardam cópia, por um apelido
 * anônimo e estável (`conta-removida-7f3a2c@removida.invalid`; ver a migration
 * `conta_removida`). A tela mostra "Conta removida · 7F3A2C": o mesmo apelido
 * agrupa o que a mesma pessoa fez, sem dizer quem era.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */
const APELIDO = /^conta-removida-([0-9a-f]{6})@removida\.invalid$/;

export function ehContaRemovida(email: string | null | undefined): boolean {
  return APELIDO.test(email ?? "");
}

export function rotuloDaPessoa(email: string | null | undefined, ingles = false): string {
  const achado = APELIDO.exec(email ?? "");
  if (!achado) return email ?? "";
  return `${ingles ? "Removed account" : "Conta removida"} · ${achado[1].toUpperCase()}`;
}
