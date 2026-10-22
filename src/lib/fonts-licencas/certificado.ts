import { createPrivateKey, createPublicKey, sign, verify, type KeyObject } from "node:crypto";

/**
 * O certificado de licença do Brennimark Fonts — contrato v1 com o aplicativo
 * (Fatia 59 do Fonts, commit a75a201, 16/10/2026).
 *
 * O arquivo é um envelope JSON:
 *   format    "brennimark-fonts-license-v1"
 *   payload   os bytes UTF-8 do JSON dos campos, em Base64URL SEM padding
 *   signature assinatura Ed25519 DESSES bytes exatos, em Base64URL sem padding
 *
 * O aplicativo verifica a assinatura sobre os bytes do `payload` como vieram,
 * sem reordenar nem reserializar. Por isso esta função assina os bytes que ela
 * mesma produziu, uma vez, e o que vai no arquivo é exatamente isso.
 *
 * A chave privada mora só na Vercel (`BRENNIMARK_CHAVE_LICENCAS_FONTS`, PEM) e
 * esta função só roda no servidor. Ed25519 é determinístico: os mesmos campos
 * dão os mesmos bytes e a mesma assinatura, e é por isso que o certificado não
 * precisa ser guardado: refaz-se da linha do banco.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */

export const FORMATO = "brennimark-fonts-license-v1";
export const EMISSOR = "brennimark";
export const VARIAVEL_DA_CHAVE = "BRENNIMARK_CHAVE_LICENCAS_FONTS";

/** O que o banco devolve de uma ativação (`console_fonts_ativar`). */
export interface CamposDoBanco {
  license_id: string;
  license_number: string;
  plan: string;
  issued_at: string;
  expires_at: string;
  max_devices: number;
  activation_id: string;
  device_public_key: string;
}

export interface Certificado {
  format: typeof FORMATO;
  payload: string;
  signature: string;
}

/** Data em UTC, sem milissegundos: `2026-10-16T12:00:00Z`, como no contrato. */
export function dataDoCertificado(valor: string): string {
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) throw new Error(`data inválida: ${valor}`);
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function base64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

/** Os campos na ORDEM do contrato. A ordem faz parte dos bytes assinados. */
export function montarPayload(campos: CamposDoBanco): Uint8Array {
  const objeto = {
    version: 1,
    issuer: EMISSOR,
    license_id: campos.license_id,
    license_number: campos.license_number,
    plan: campos.plan,
    issued_at: dataDoCertificado(campos.issued_at),
    expires_at: dataDoCertificado(campos.expires_at),
    max_devices: campos.max_devices,
    activation_id: campos.activation_id,
    device_public_key: campos.device_public_key,
  };
  return new TextEncoder().encode(JSON.stringify(objeto));
}

/**
 * Lê a chave privada da variável de ambiente. Aceita o PEM com quebras de
 * linha de verdade ou escritas como `\n` (campo de uma linha só na Vercel).
 * Devolve `null` se não estiver configurada ou não for uma chave Ed25519.
 */
export function lerChavePrivada(valor: string | undefined): KeyObject | null {
  if (!valor || !valor.trim()) return null;
  try {
    const chave = createPrivateKey(valor.replace(/\\n/g, "\n"));
    return chave.asymmetricKeyType === "ed25519" ? chave : null;
  } catch {
    return null;
  }
}

export function emitirCertificado(campos: CamposDoBanco, chave: KeyObject): Certificado {
  const bytes = montarPayload(campos);
  const assinatura = sign(null, bytes, chave);
  return { format: FORMATO, payload: base64url(bytes), signature: base64url(assinatura) };
}

/** A conferência que o aplicativo faz, aqui para provar o contrato e se auto-checar. */
export function conferirCertificado(certificado: Certificado, chavePublica: KeyObject): boolean {
  if (certificado.format !== FORMATO) return false;
  if (/[^A-Za-z0-9_-]/.test(certificado.payload) || /[^A-Za-z0-9_-]/.test(certificado.signature)) return false;
  const bytes = Buffer.from(certificado.payload, "base64url");
  const assinatura = Buffer.from(certificado.signature, "base64url");
  return verify(null, bytes, chavePublica, assinatura);
}

export function chavePublicaDe(privada: KeyObject): KeyObject {
  return createPublicKey(privada);
}

// ─── O pedido do Console, antes de chegar ao banco ──────────────────────────

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODIGO = /^[A-Za-z0-9+/_=-]{16,200}$/;

export type AcaoDeFonts =
  | { acao: "criar"; plano: "beta" | "individual" | "studio"; dispositivos: number; nome: string; email: string; agencia: string; dias: number }
  | { acao: "ativar"; licencaId: string; codigo: string }
  | { acao: "certificado"; ativacaoId: string }
  | { acao: "revogar-ativacao"; ativacaoId: string }
  | { acao: "revogar-licenca"; licencaId: string };

export function lerAcaoDeFonts(corpo: unknown): { ok: true; acao: AcaoDeFonts } | { ok: false; motivo: string } {
  const c = (corpo ?? {}) as Record<string, unknown>;
  const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");

  switch (c.acao) {
    case "criar": {
      if (c.plano !== "beta" && c.plano !== "individual" && c.plano !== "studio") return { ok: false, motivo: "Escolha o plano." };
      const dispositivos = Number(c.dispositivos);
      if (!Number.isInteger(dispositivos) || dispositivos < 1 || dispositivos > 1000) return { ok: false, motivo: "O número de computadores vai de 1 a 1000." };
      if (c.plano !== "studio" && dispositivos > 2) return { ok: false, motivo: "Individual e beta têm no máximo 2 computadores. Para mais, use Estúdio." };
      const nome = texto(c.nome);
      if (nome.length < 1 || nome.length > 120) return { ok: false, motivo: "Escreva o nome do testador (até 120 caracteres)." };
      const email = texto(c.email);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return { ok: false, motivo: "E-mail inválido." };
      const dias = c.dias === undefined || c.dias === "" ? 90 : Number(c.dias);
      if (!Number.isInteger(dias) || dias < 1 || dias > 90) return { ok: false, motivo: "A validade vai de 1 a 90 dias: o aplicativo recusa prazo maior." };
      return { ok: true, acao: { acao: "criar", plano: c.plano, dispositivos, nome, email, agencia: texto(c.agencia).slice(0, 120), dias } };
    }
    case "ativar": {
      if (typeof c.licencaId !== "string" || !UUID.test(c.licencaId)) return { ok: false, motivo: "Licença inválida." };
      const codigo = texto(c.codigo);
      if (!CODIGO.test(codigo)) return { ok: false, motivo: "O código do computador parece incompleto. Copie-o inteiro da tela Sobre do aplicativo." };
      return { ok: true, acao: { acao: "ativar", licencaId: c.licencaId, codigo } };
    }
    case "certificado":
    case "revogar-ativacao": {
      if (typeof c.ativacaoId !== "string" || !UUID.test(c.ativacaoId)) return { ok: false, motivo: "Ativação inválida." };
      return { ok: true, acao: { acao: c.acao, ativacaoId: c.ativacaoId } };
    }
    case "revogar-licenca": {
      if (typeof c.licencaId !== "string" || !UUID.test(c.licencaId)) return { ok: false, motivo: "Licença inválida." };
      return { ok: true, acao: { acao: "revogar-licenca", licencaId: c.licencaId } };
    }
    default:
      return { ok: false, motivo: "Ação desconhecida." };
  }
}
