# Evidência visual do V1 — 2026-09-02

Geradas por `e2e/evidencia-v1.spec.ts`, que **não é teste**: ele não afirma
nada, só produz as imagens. Roda apenas com `EVIDENCIA_V1=1`, para não encher o
repositório de binário a cada `npm run verify`.

```
EVIDENCIA_V1=1 npx playwright test evidencia-v1 --project=chromium
```

## As quatro marcas opostas, desktop e mobile

`marca-sobria`, `marca-institucional`, `marca-mercado`, `marca-festival`.

O que elas mostram: **a moldura é idêntica nas quatro** — barra acromática,
navegação em cinza, seletor de marca no mesmo lugar — e **o canvas é
inteiramente da marca**. A Festival é magenta, a Institucional é azul sobre
branco, e a barra do Brennimark é a mesma nas duas.

A verificação de que a moldura é idêntica não é olho: é pixel medido, em
`e2e/moldura-universal.spec.ts`. Estas imagens existem para leitura humana.

## As superfícies sem marca aberta

`login`, `resolvedor`, `nao-encontrado`, `falha`.

É onde a moldura precisa parecer o produto sem nada para vestir. Antes do V1 o
login era turquesa — a cor do release de um cliente. Agora é acromático.

A tela de falha aparece dentro da moldura, com a barra preservada, copy de
produto, duas saídas e uma referência opaca. Nenhuma mensagem técnica.
