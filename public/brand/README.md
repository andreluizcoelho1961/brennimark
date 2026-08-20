Drop reference material here as it's produced, then wire it into the matching
page in `src/content/docs.ts` via that page's `images` array — no new
component needed, `DocPage` renders any `images` list as a grid automatically
(see `src/components/docs/AssetGrid.tsx`).

- `logos/` — logo usage-rule assets (reversed, monochrome, clear-space
  diagrams, misuse examples). The primary logo files themselves go in
  `public/logo/` (see root `CLAUDE.md`), not here — `LogoSection.tsx` reads
  from there directly once real files land.
- `mockups/` — application mockups (merch, posters, social, stage
  backdrops, etc.) — feeds `universo-visual/*` pages.
- `pecas/` — finished or near-finished brand pieces not covered by the
  other folders.
- `iconografia/` — icon sets for `universo-visual/iconografia`.
- `grafismos/` — pattern/graphic-device sets for `universo-visual/grafismos`.

Naming: `slug-of-the-page-short-description.ext` (e.g.
`imagens-arquetipicas-tour-poster-01.jpg`) so it's obvious which doc page an
asset belongs to at a glance.

Per [[feedback_brand_content_honesty]] (see project memory): adding images to
a page doesn't change its status badge automatically — bump `status` in
`docs.ts` from `pending`/`draft` to `ready` only once the material is actually
approved, not just uploaded.
