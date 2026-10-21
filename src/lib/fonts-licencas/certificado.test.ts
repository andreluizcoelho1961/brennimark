import assert from "node:assert/strict";
import test from "node:test";
import { generateKeyPairSync } from "node:crypto";
import {
  chavePublicaDe, conferirCertificado, dataDoCertificado, emitirCertificado, FORMATO, lerAcaoDeFonts, lerChavePrivada,
  montarPayload, type CamposDoBanco,
} from "./certificado";

const CAMPOS: CamposDoBanco = {
  license_id: "11111111-1111-4111-8111-111111111111",
  license_number: "BMF-BETA-000123",
  plan: "individual",
  issued_at: "2026-10-16T12:00:00.123456+00:00",
  expires_at: "2027-01-14T12:00:00.987654+00:00",
  max_devices: 2,
  activation_id: "22222222-2222-4222-8222-222222222222",
  device_public_key: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
};

const { privateKey } = generateKeyPairSync("ed25519");
const publica = chavePublicaDe(privateKey);

test("o payload sai com os campos na ordem do contrato, e as datas sem milissegundos", () => {
  const json = JSON.parse(Buffer.from(montarPayload(CAMPOS)).toString("utf8"));
  assert.deepEqual(Object.keys(json), [
    "version", "issuer", "license_id", "license_number", "plan", "issued_at", "expires_at",
    "max_devices", "activation_id", "device_public_key",
  ]);
  assert.equal(json.version, 1);
  assert.equal(json.issuer, "brennimark");
  assert.equal(json.issued_at, "2026-10-16T12:00:00Z");
  assert.equal(json.expires_at, "2027-01-14T12:00:00Z");
});

test("o envelope tem o formato do contrato e Base64URL sem padding", () => {
  const cert = emitirCertificado(CAMPOS, privateKey);
  assert.equal(cert.format, FORMATO);
  assert.match(cert.payload, /^[A-Za-z0-9_-]+$/);
  assert.match(cert.signature, /^[A-Za-z0-9_-]+$/);
  assert.equal(Buffer.from(cert.signature, "base64url").length, 64, "assinatura Ed25519 tem 64 bytes");
});

test("a assinatura confere sobre os bytes EXATOS do payload, como o aplicativo verifica", () => {
  const cert = emitirCertificado(CAMPOS, privateKey);
  assert.equal(conferirCertificado(cert, publica), true);
  // O que está no arquivo decodifica para os mesmos bytes que foram assinados.
  assert.deepEqual(Buffer.from(cert.payload, "base64url"), Buffer.from(montarPayload(CAMPOS)));
});

test("mexer em qualquer byte do payload, na assinatura ou no formato invalida", () => {
  const cert = emitirCertificado(CAMPOS, privateKey);
  const adulterado = Buffer.from(cert.payload, "base64url");
  adulterado[adulterado.length - 5] ^= 1;
  assert.equal(conferirCertificado({ ...cert, payload: adulterado.toString("base64url") }, publica), false);

  const assinatura = Buffer.from(cert.signature, "base64url");
  assinatura[0] ^= 1;
  assert.equal(conferirCertificado({ ...cert, signature: assinatura.toString("base64url") }, publica), false);

  assert.equal(conferirCertificado({ ...cert, format: "outro" as never }, publica), false);
  assert.equal(conferirCertificado({ ...cert, payload: cert.payload + "=" }, publica), false, "padding não é aceito");
});

test("outra chave não valida: ninguém emite licença sem a chave do site", () => {
  const cert = emitirCertificado(CAMPOS, privateKey);
  const outra = chavePublicaDe(generateKeyPairSync("ed25519").privateKey);
  assert.equal(conferirCertificado(cert, outra), false);
});

test("o mesmo registro dá o mesmo certificado, byte a byte (por isso não se guarda)", () => {
  assert.deepEqual(emitirCertificado(CAMPOS, privateKey), emitirCertificado({ ...CAMPOS }, privateKey));
});

test("a data da licença muda o certificado: ativar tarde não estende a validade", () => {
  const depois = emitirCertificado({ ...CAMPOS, issued_at: "2026-11-30T09:00:00+00:00" }, privateKey);
  const antes = emitirCertificado(CAMPOS, privateKey);
  assert.notEqual(depois.payload, antes.payload);
  const json = JSON.parse(Buffer.from(depois.payload, "base64url").toString("utf8"));
  assert.equal(json.expires_at, "2027-01-14T12:00:00Z");
});

test("data inválida é recusada em vez de assinar lixo", () => {
  assert.throws(() => dataDoCertificado("ontem"), /data inválida/);
});

test("a chave vem do ambiente, com quebras reais ou escritas como \\n", () => {
  const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  assert.ok(lerChavePrivada(pem));
  assert.ok(lerChavePrivada(pem.trim().replace(/\n/g, "\\n")));
});

test("sem chave, chave quebrada ou de outro tipo: nulo, nunca uma exceção", () => {
  assert.equal(lerChavePrivada(undefined), null);
  assert.equal(lerChavePrivada("   "), null);
  assert.equal(lerChavePrivada("não é uma chave"), null);
  const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  assert.equal(lerChavePrivada(rsa), null);
});

// ─── O pedido do Console ────────────────────────────────────────────────────

const LIC = "11111111-1111-4111-8111-111111111111";

test("criar: valida plano, limite, e-mail e validade; 90 dias é o padrão", () => {
  const ok = lerAcaoDeFonts({ acao: "criar", plano: "individual", dispositivos: 2, nome: " Ana ", email: "ana@exemplo.com", agencia: "" });
  assert.deepEqual(ok, { ok: true, acao: { acao: "criar", plano: "individual", dispositivos: 2, nome: "Ana", email: "ana@exemplo.com", agencia: "", dias: 90 } });
  assert.equal(lerAcaoDeFonts({ acao: "criar", plano: "individual", dispositivos: 3, nome: "A", email: "a@b.co" }).ok, false, "individual: no máximo 2");
  assert.equal(lerAcaoDeFonts({ acao: "criar", plano: "studio", dispositivos: 20, nome: "A", email: "a@b.co", agencia: "X" }).ok, true);
  assert.equal(lerAcaoDeFonts({ acao: "criar", plano: "studio", dispositivos: 0, nome: "A", email: "a@b.co" }).ok, false);
  assert.equal(lerAcaoDeFonts({ acao: "criar", plano: "gratis", dispositivos: 1, nome: "A", email: "a@b.co" }).ok, false);
  assert.equal(lerAcaoDeFonts({ acao: "criar", plano: "beta", dispositivos: 1, nome: "A", email: "sem-arroba" }).ok, false);
  assert.equal(lerAcaoDeFonts({ acao: "criar", plano: "beta", dispositivos: 1, nome: "A", email: "a@b.co", dias: 0 }).ok, false);
  assert.equal(lerAcaoDeFonts({ acao: "criar", plano: "beta", dispositivos: 1, nome: "A", email: "a@b.co", dias: 91 }).ok, false, "o app recusa mais de 90 dias");
  assert.equal(lerAcaoDeFonts({ acao: "criar", plano: "beta", dispositivos: 1, nome: "", email: "a@b.co" }).ok, false);
});

test("ativar: pede licença válida e o código do computador inteiro", () => {
  assert.equal(lerAcaoDeFonts({ acao: "ativar", licencaId: LIC, codigo: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" }).ok, true);
  assert.equal(lerAcaoDeFonts({ acao: "ativar", licencaId: LIC, codigo: "curto" }).ok, false);
  assert.equal(lerAcaoDeFonts({ acao: "ativar", licencaId: "nao-e-uuid", codigo: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" }).ok, false);
  assert.equal(lerAcaoDeFonts({ acao: "ativar", licencaId: LIC, codigo: "AAAAAAAAAAAAAAAAAAAA<script>" }).ok, false);
});

test("as demais ações pedem o identificador certo, e ação desconhecida é recusada", () => {
  assert.equal(lerAcaoDeFonts({ acao: "certificado", ativacaoId: LIC }).ok, true);
  assert.equal(lerAcaoDeFonts({ acao: "revogar-ativacao", ativacaoId: LIC }).ok, true);
  assert.equal(lerAcaoDeFonts({ acao: "revogar-licenca", licencaId: LIC }).ok, true);
  assert.equal(lerAcaoDeFonts({ acao: "revogar-licenca", licencaId: "x" }).ok, false);
  assert.equal(lerAcaoDeFonts({ acao: "apagar-tudo" }).ok, false);
  assert.equal(lerAcaoDeFonts(null).ok, false);
});
