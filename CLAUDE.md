# Claude Code Instructions — The BluesMaker / Brandville

Brand guidelines app for The BluesMaker. Sibling to
`the-bluesmaker-site` (the "Call Me Analog Man" release site) — same
brand, same tokens, different purpose: this one documents the system
rather than applying it to a single release.

## Audience

Shared with external partners/press as the canonical brand reference —
treat it as presentable, external-facing material, not an internal
scratch doc. `robots: noindex` is set (not for public search), but
assume anyone with the link can see it.

## Source of truth

- Content: `src/content/brand.ts` — edit copy/data there, not inline in components.
- Docs registry: `src/content/docs.ts` — sidebar structure, page status, prose body, and reference `images` per page. Generic pages render through `DocPage`; only 5 slugs have bespoke components (see `COMPONENT_SLUGS` in `src/app/docs/[...slug]/page.tsx`).
- Reference images/mockups: drop files under `public/brand/<category>/` (see `public/brand/README.md` for the folder convention) and list them in a page's `images` array in `docs.ts` — `DocPage` renders any `images` list as a grid automatically via `AssetGrid`, no new component needed. Adding images does NOT change a page's status badge — bump `status` explicitly once material is approved, not just uploaded.
- Tokens: `src/app/globals.css` — must stay in sync with `the-bluesmaker-site`'s tokens (same brand, same cover-art-derived colors). If one changes, check the other.
- Fonts: `src/fonts/*.otf` — same licensed Gotham files as the-bluesmaker-site. Never redistribute outside these two private repos.

## Status / open items

- **Iconography**: position changed 2026-07-19. The book previously
  stated the project deliberately builds no icon system; the founder
  reviewed that and adopted a licensed 100-icon music/audio line set
  instead. Extracted from the supplied EPS with Ghostscript at 300dpi
  and sliced by grid detection into `public/icons/set/`, white on
  transparent, grouped by category (controls, volume, playback, notes,
  instruments, mics, devices, headphones). Vector master in
  `public/brand/iconografia/`. The Grafismos page was amended to match:
  instruments and notation are legitimate in a functional icon role,
  what it still avoids is their ornamental use.

- **Logo**: real files landed 2026-07-19. Three lockups of the same
  wordmark — horizontal, stacked stepping right, stacked stepping left —
  supplied as one 3-page Illustrator file. There is no symbol or icon;
  the wordmark is the whole mark. Rendered to PNG at 600dpi with
  transparency in black and white variants under `public/logo/`; the
  vector master sits in `public/brand/logos/`. Regenerate with
  Ghostscript (`-sDEVICE=pngalpha -r600`) if the source is ever revised.
  Still undefined, and deliberately marked as such on the page rather
  than invented: clear space, minimum size, misuse examples.
- Everything else (color, typography, photography, motion, voice,
  applications, assets) is populated with real, already-established
  brand facts — nothing fabricated.

## AI layer (BYOK, multi-provider)

- Never import `@ai-sdk/*` directly from feature code — always go through `getModel()` in `src/lib/ai/provider.ts`. Adding a provider means adding one case there, not touching chat/analysis code.
- Config resolution: `src/lib/ai/settings.ts`'s `resolveConfig(role)` picks the workspace's active `ai_settings` row for that role (`chat` | `analysis`, with `both` covering either), falling back to the shared Groq demo (`GROQ_API_KEY` env var, `openai/gpt-oss-20b`) when none exists. Chat may switch to `openai/gpt-oss-120b` under the same Groq key before the first token, or to an explicitly authorized secondary provider configured with the three `AI_CHAT_FALLBACK_*` server variables. `getCurrentWorkspaceId()` resolves the signed-in user's workspace via `workspace_members`; returns `null` when unauthenticated (including local `NEXT_PUBLIC_SKIP_AUTH` dev mode) — that's what makes demo mode "just work" locally.
- API keys are encrypted at rest with AES-256-GCM (`src/lib/ai/crypto.ts`) under `AI_SETTINGS_ENCRYPTION_KEY` (server-only env var, `openssl rand -base64 32`). Never return `api_key_ciphertext`/`api_key_iv` from an API route — only `api_key_last4`.
- `workspaces`/`workspace_members` are multi-tenant scaffolding ahead of actual need (today: 1 profile → 1 auto-provisioned workspace, via a `SECURITY DEFINER` trigger on `profiles` insert). The trigger function has `EXECUTE` revoked from `anon`/`authenticated` — Supabase auto-exposes public-schema functions as RPC by default, so any `SECURITY DEFINER` function added later needs the same lockdown unless it's meant to be publicly callable.
- Brand context for chat/analysis system prompts comes from `src/lib/ai/brand-context.ts`, which carries each `docsRegistry` page's Pronto/Rascunho/Em construção status into the prompt — keep this if the docs registry shape changes, it's what stops the assistant from presenting draft content as settled fact (see `feedback_brand_content_honesty` in project memory).
- Known gap: settings CRUD (`/docs/configuracoes/ia`) requires a real Supabase session and wasn't exercised end-to-end through an authenticated browser login (only via curl, confirming the 401 gate) — verify after a real magic-link sign-in before calling BYOK "done".

## Non-negotiables (same as the-bluesmaker-site)

- No fabricated logo — never generate a placeholder "logo" that looks
  like a finished mark. The current placeholder is explicitly labeled
  as a placeholder for this reason.
- Gotham font files stay private — self-hosted, never on a CDN or
  public font-serving path.
- Color values must trace back to the cover-art extraction, not be
  eyeballed — see `the-bluesmaker-site/docs/DESIGN_SYSTEM.md` for the
  original sampling method if colors ever need re-deriving.
