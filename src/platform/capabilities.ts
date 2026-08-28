/**
 * Capacidades por marca — o que a pessoa pode fazer nesta instalação.
 *
 * Distinta de papel: papel é quem ela é, capacidade é o que ela pode aqui. A
 * mesma pessoa pode editar a marca A e apenas consultar a marca B, e a moldura
 * precisa montar composições diferentes nos dois casos.
 *
 * **Isto não é fronteira de segurança.** Capacidade decide o que APARECE. O que
 * é PERMITIDO continua decidido no servidor, por RLS e verificação de papel em
 * cada rota. Ver ADR-0002 §4.
 */
export const BRAND_CAPABILITIES = ["consultar", "editar", "aprovar", "administrar"] as const;

export type BrandCapability = (typeof BRAND_CAPABILITIES)[number];

export type WorkspaceRole = "owner" | "member";

/**
 * Deriva capacidades do papel que já existe no banco.
 *
 * Mapeamento deliberadamente conservador: reproduz exatamente o comportamento
 * atual, sem ampliar o acesso de ninguém. Os papéis mais finos — agência que
 * edita sem aprovar, gestor que aprova sem administrar — dependem de o WP1
 * ampliar `workspace_members.role`, que hoje só aceita owner e member.
 */
export function capabilitiesForRole(role: WorkspaceRole | null | undefined): BrandCapability[] {
  if (role === "owner") return [...BRAND_CAPABILITIES];
  if (role === "member") return ["consultar"];
  return [];
}

export function can(
  capabilities: readonly BrandCapability[],
  capability: BrandCapability,
): boolean {
  return capabilities.includes(capability);
}
