import fs from "node:fs/promises";
import path from "node:path";

const BASE_URL = process.env.BRANDVILLE_BASE_URL ?? "http://127.0.0.1:3417";
const LIMIT = Number.parseInt(process.env.BRANDVILLE_EVAL_LIMIT ?? "4", 10);
const CASE_FILTER = (process.env.BRANDVILLE_EVAL_CASES ?? "").split(",").map((value) => value.trim()).filter(Boolean);
const REPORT_PATH = process.env.BRANDVILLE_EVAL_REPORT ?? ".tmp/brand-evaluation-report.json";
const EXTERNAL_EVAL_ALLOWED = process.env.BRANDVILLE_ALLOW_EXTERNAL_EVAL === "true";

const cases = [
  {
    id: "foundation-colors",
    question: "Quais são os códigos hex das cores permanentes da marca?",
    required: ["#000000", "#F6F2EF", "#9AA3AD"],
    citationPath: "/docs/universo-visual/guia-de-cores",
    citationStatus: "PRONTO",
  },
  {
    id: "release-accent",
    question: "O turquesa #01A48F é uma cor permanente do The BluesMaker?",
    required: ["#01A48F", "lançamento"],
    citationPath: "/docs/universo-visual/guia-de-cores",
    citationStatus: "PRONTO",
  },
  {
    id: "typography",
    question: "Qual é a família tipográfica oficial e quais pesos estão documentados?",
    required: ["Gotham", "Book", "Medium", "Bold", "Black"],
    citationPath: "/docs/universo-visual/tipografia",
    citationStatus: "PRONTO",
  },
  {
    id: "logo-download",
    question: "Qual arquivo devo baixar para usar o wordmark horizontal branco sobre fundo escuro?",
    required: ["/logo/logo-wordmark-horizontal-white.png"],
    citationPath: "/docs/universo-visual/simbolos-e-logotipos",
    citationStatus: "PRONTO",
  },
  {
    id: "voice-guardrail",
    question: "Posso descrever o novo single como revolutionary, groundbreaking e uma unique experience?",
    required: ["fora", "vocabulário"],
    citationPath: "/docs/universo-verbal/tom-de-voz",
    citationStatus: "PRONTO",
  },
  {
    id: "photography-status",
    question: "Uma foto com fumaça, chapéu de bluesman e iluminação âmbar está alinhada à direção fotográfica?",
    required: ["fumaça", "âmbar"],
    citationPath: "/docs/universo-visual/imagens-arquetipicas",
    citationStatus: "RASCUNHO",
  },
  {
    id: "missing-pantone",
    question: "Qual é o Pantone oficial do turquesa da marca?",
    required: ["Não há uma diretriz documentada suficiente"],
    forbidden: ["Pantone 326", "Pantone 327", "PMS 326", "PMS 327"],
  },
  {
    id: "logo-distortion",
    question: "Posso esticar o logo horizontal para preencher um banner?",
    required: ["proporcional"],
    citationPath: "/docs/universo-visual/simbolos-e-logotipos",
    citationStatus: "PRONTO",
  },
];

function includes(text, value) {
  return text.toLocaleLowerCase("pt-BR").includes(value.toLocaleLowerCase("pt-BR"));
}

function extractCitations(text) {
  const pattern = /\[Fonte:\s*(.+?)\s+—\s+(?:(PRONTO|RASCUNHO|EM CONSTRUÇÃO)\s+·\s+(\/docs\/[^\]\s]+)|(\/docs\/[^\]\s]+)\s+·\s+(PRONTO|RASCUNHO|EM CONSTRUÇÃO))\]/g;
  return [...text.matchAll(pattern)].map((match) => ({
    title: match[1],
    status: match[2] ?? match[5],
    path: match[3] ?? match[4],
  }));
}

function evaluate(testCase, response) {
  const facts = testCase.required.map((value) => ({ value, passed: includes(response, value) }));
  const forbidden = (testCase.forbidden ?? []).map((value) => ({ value, passed: !includes(response, value) }));
  const citations = extractCitations(response);
  const citation = testCase.citationPath ? citations.some((item) => item.path.startsWith(testCase.citationPath)) : true;
  const status = testCase.citationStatus ? citations.some((item) => item.status === testCase.citationStatus) : true;
  const checks = [...facts, ...forbidden];
  const factualScore = checks.length === 0 ? 1 : checks.filter((check) => check.passed).length / checks.length;
  const score = Math.round((factualScore * 0.6 + Number(citation) * 0.25 + Number(status) * 0.15) * 100);

  return { score, facts, forbidden, citation, status, passed: score === 100 };
}

async function runCase(testCase) {
  const startedAt = Date.now();
  const response = await fetch(`${BASE_URL}/api/ai/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [{ role: "user", content: testCase.question }] }),
    signal: AbortSignal.timeout(90_000),
  });

  const answer = await response.text();
  if (!response.ok) throw new Error(`${response.status}: ${answer}`);

  return {
    id: testCase.id,
    question: testCase.question,
    answer,
    provider: response.headers.get("x-ai-provider"),
    model: response.headers.get("x-ai-model"),
    demoMode: response.headers.get("x-ai-demo-mode") === "true",
    durationMs: Date.now() - startedAt,
    evaluation: evaluate(testCase, answer),
  };
}

async function main() {
  if (!EXTERNAL_EVAL_ALLOWED) {
    throw new Error(
      "Avaliação externa bloqueada. Defina BRANDVILLE_ALLOW_EXTERNAL_EVAL=true somente após autorizar o envio do guide ao provedor configurado.",
    );
  }

  const filtered = CASE_FILTER.length > 0 ? cases.filter((testCase) => CASE_FILTER.includes(testCase.id)) : cases;
  const selected = filtered.slice(0, Number.isFinite(LIMIT) ? LIMIT : 4);
  const results = [];

  for (const testCase of selected) {
    try {
      const result = await runCase(testCase);
      results.push(result);
      console.log(`${result.evaluation.passed ? "PASS" : "FAIL"} ${result.id} — ${result.evaluation.score}/100`);
    } catch (error) {
      results.push({ id: testCase.id, question: testCase.question, error: error instanceof Error ? error.message : String(error) });
      console.error(`ERROR ${testCase.id}`);
    }
  }

  const completed = results.filter((result) => "evaluation" in result);
  const report = {
    createdAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    selectedCases: selected.length,
    completedCases: completed.length,
    averageScore: completed.length > 0 ? Math.round(completed.reduce((sum, result) => sum + result.evaluation.score, 0) / completed.length) : 0,
    passedCases: completed.filter((result) => result.evaluation.passed).length,
    results,
  };

  await fs.mkdir(path.dirname(REPORT_PATH), { recursive: true });
  await fs.writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Report: ${REPORT_PATH}`);

  if (report.completedCases !== selected.length || report.averageScore < 85) process.exitCode = 1;
}

main();
