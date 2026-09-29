/**
 * Os tipos de `import foto from "./x.jpg"` (largura, altura, endereço).
 *
 * O Next os declara em `next-env.d.ts`, que é gerado pelo `next dev`/`build`
 * e fica fora do Git — e o `typecheck` do `verify` roda ANTES do build, num
 * worktree novo sem esse arquivo. Declarar aqui faz o tipo existir sempre.
 */
/// <reference types="next/image-types/global" />
