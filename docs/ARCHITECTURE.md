# Brandville — Architecture (current implementation)

Internal reference for how the app works and is put together **today**. See
also root `CLAUDE.md` for editing conventions and non-negotiables; this file
is about *how it's built*, that one is about *how to work on it*.

The product is a reusable matrix for independent, single-brand installations,
not a shared multi-tenant platform. See
[`BRANDVILLE_MATRIX.md`](./BRANDVILLE_MATRIX.md) for the replication contract,
client-isolation rules and deployment checklist.

The target content model (modules/documents/sections/blocks, metadata,
status lifecycle) is specified separately in
[`BRAND_KNOWLEDGE_BASE_SCHEMA.md`](./BRAND_KNOWLEDGE_BASE_SCHEMA.md) —
brand-agnostic, referenced by `PRODUCT_ARCHITECTURE.md` §7-8. The target
discovery/intake flow that populates that schema is specified in
[`BRANDING_BRIEF_TEMPLATE.md`](./BRANDING_BRIEF_TEMPLATE.md).

## What this is

Brand-guidelines app for The BluesMaker: a Next.js docs app documenting
color, typography, photography, voice, logo, and (as of 2026-07-17) two
AI-powered features — a brand chat and an image-analysis tool. Shared with
partners/press as the canonical brand reference; gated behind login.

Sibling project: `the-bluesmaker-site` (the public release site). Both draw
from the same design tokens and licensed Gotham font files — see root
`CLAUDE.md` for the sync rule.

## Stack

Next.js 16 (App Router, Turbopack) + TypeScript + Tailwind CSS v4
(CSS-first `@theme`, no config file) + Supabase (Postgres + Auth) +
Vercel AI SDK (`ai` + `@ai-sdk/*` providers) + Vercel (hosting).

## Directory map

```
src/
  brandville/
    types.ts                 Contract shared by every installation
    config.ts                Selects and validates the active instance
    instances/               One configuration module per brand
  app/
    layout.tsx              Root layout — loads Gotham via next/font/local
    globals.css              Design tokens (@theme block)
    page.tsx                 Redirects to /docs
    login/page.tsx           Sign in / create account (email+password)
    onboarding/page.tsx      Post-signup profile form (name, company)
    auth/callback/page.tsx   Client-side session pickup (implicit flow)
    docs/
      layout.tsx              Auth gate + renders DocsNav + page chrome
      page.tsx                 Redirects to the default doc slug
      [...slug]/page.tsx       Generic doc-page renderer (catch-all)
      chat/page.tsx             Brand chat UI
      analise/page.tsx          Image analysis UI
      configuracoes/ia/page.tsx "Conecte sua IA" BYOK settings screen
    api/ai/
      settings/route.ts         GET/POST ai_settings
      settings/[id]/route.ts    PATCH (activate)/DELETE one setting
      test-connection/route.ts  Validate a provider/key/model before saving
      chat/route.ts              Streaming chat endpoint
      analyze/route.ts           Image-analysis endpoint
  components/
    docs/
      DocsNav.tsx        Desktop rail+panel nav, mobile drawer, ⌘K palette
      DocPage.tsx        Generic page shell (kicker, title, body, images)
      AssetGrid.tsx      Image grid for a page's `images` array
      StatusBadge.tsx    Pronto/Rascunho/Em construção badge
    ColorSection.tsx, TypographySection.tsx, PhotographySection.tsx,
    VoiceSection.tsx, LogoSection.tsx   Bespoke components for 5 doc pages
    BrandFooter.tsx, SignOutButton.tsx
  content/
    docs.ts     The docs registry — sidebar structure, status, body, images
    brand.ts    Structured brand data (color tokens, type roles, motion spec)
  lib/
    supabase/{client,server,middleware}.ts   Supabase client factories
    ai/{provider,crypto,settings,errors,brand-context}.ts   AI layer (below)
  fonts/*.otf   Licensed Gotham files (private, never redistribute)
  proxy.ts      Next.js middleware entry (delegates to lib/supabase/middleware)
public/
  brand/         Drop zone for reference images (see public/brand/README.md)
  artwork/, images/, icons/, logo/    Existing brand assets
docs/
  ARCHITECTURE.md   This file
brandville/
  intake.example.json        Modelo de briefing para uma nova instancia
scripts/
  create-brandville-instance.mjs     Questionario e comando de geracao
  brandville-instance-generator.mjs  Validacao e gerador da matriz
  import-brand-book.mjs              Entrada guiada para um PDF existente
  brandville-pdf-importer.mjs        Extracao, secoes e relatorio editorial
```

## Auth & data model

Supabase project `cghuwkcnxcesxyiiucst` (region sa-east-1). Auth is
email+password (switched from magic-link 2026-07-17 — PKCE magic links
broke when the OS opened the email link in a different browser than the
one that requested it; see commit `6a4cabd`).

**Tables** (all RLS-enabled):

- `profiles` — one row per `auth.users`, filled in during onboarding
  (`full_name`, `company`). `id` = `auth.users.id`.
- `workspaces` / `workspace_members` — multi-tenant scaffolding, built
  ahead of actual need (today: 1 profile → 1 auto-provisioned workspace).
  A `SECURITY DEFINER` trigger (`handle_new_profile`) creates a workspace
  + owner membership whenever a `profiles` row is inserted. That trigger
  function has `EXECUTE` revoked from `anon`/`authenticated` — Supabase
  exposes public-schema functions as REST RPC by default, so this had to
  be locked down explicitly (caught by the security advisor).
- `ai_settings` — BYOK provider credentials, see AI layer below.

**Request flow:**

1. `src/proxy.ts` → `lib/supabase/middleware.ts` runs on every request
   (except static assets), reads the session from cookies, and redirects
   unauthenticated requests to `/login` (except `/login` and
   `/auth/callback`, which are public). `NEXT_PUBLIC_SKIP_AUTH=true` (local
   `.env.local` only, never in Vercel) bypasses this entirely.
2. `app/docs/layout.tsx` re-checks auth server-side and redirects to
   `/onboarding` if the profile has no `full_name` yet.
3. `lib/supabase/client.ts` (browser) is configured with
   `flowType: "implicit"` — not the `@supabase/ssr` default `"pkce"` —
   because implicit flow puts the session directly in the redirect URL's
   hash fragment instead of requiring a `code_verifier` cookie from the
   *same* browser that initiated the flow. `auth/callback/page.tsx` is a
   client component (not a server route) for the same reason: hash
   fragments never reach the server.

## Docs content system

`src/content/docs.ts` is the single source of truth for the sidebar: an
array of `DocPageEntry` (`slug`, `group`, `title`, `status`, optional
`body` paragraphs, optional `images`). `GROUPS` defines the six top-level
sections and `GROUP_CODES` their 2-letter rail abbreviations.

`app/docs/[...slug]/page.tsx` looks up the entry by slug and renders it
through `DocPage`, which:

- shows a color-blocked kicker (the page's `group`) and a huge
  break-word title (last word turquoise when the title has 2+ words),
- renders `body` paragraphs against a turquoise left border,
- if the entry has `images`, shows the first as a right-column aside and
  any rest via `AssetGrid` below,
- shows an honest "not decided yet" empty state if there's no `body` and
  no `images` and `status === "pending"` (see `feedback_brand_content_honesty`
  in project memory — never fabricate unsettled brand strategy).

Five slugs get a bespoke component instead of/in addition to generic
prose (`COMPONENT_SLUGS` map in the `[...slug]` route):
`universo-visual/guia-de-cores` → `ColorSection`,
`universo-visual/tipografia` → `TypographySection`,
`universo-visual/imagens-arquetipicas` → `PhotographySection`,
`universo-verbal/tom-de-voz` → `VoiceSection`,
`universo-visual/simbolos-e-logotipos` → `LogoSection`.

Reference images: drop files in `public/brand/<category>/` (see that
folder's README for the convention) and list them in the page's `images`
array — no new component needed.

## Navigation (`DocsNav.tsx`)

Client component rendering three things:

1. **Desktop** (`md:` and up) — a 16px icon rail (group codes + chat/
   analysis/settings/search shortcuts) plus a 64px expandable panel
   listing the selected group's pages. Clicking a rail button just
   changes which group's panel is showing (`manualGroup` state); it
   resets to the active page's group on navigation.
2. **Mobile** (below `md`) — a sticky top bar (hamburger + wordmark +
   search) and a slide-in drawer with an accordion of every group and a
   utility-links footer, closing itself on navigation. Requires the docs
   layout's outer container to be `flex-col md:flex-row` so the bar
   stacks above content instead of squeezing into a row.
3. **Command palette** — a `Cmd/Ctrl+K` modal overlay, filtering the docs
   registry by title/group substring, independent of the rail/panel/drawer.

## AI layer (BYOK, multi-provider)

Full design rationale in memory (`reference_ai_provider_layer_pattern` —
meant as a reusable pattern for future studio-client apps, not a
one-off). Mechanics:

- **`lib/ai/provider.ts`** — `getModel(config)` is the only place that
  imports an `@ai-sdk/*` package. `config = { provider, apiKey, model }`
  where `provider` is `"groq" | "anthropic" | "openai" | "google" |
  "openrouter"`. Also exports the suggested-model lists and a
  `supportsVision()` capability check (allowlist-based).
- **`lib/ai/crypto.ts`** — AES-256-GCM encryption for API keys at rest,
  keyed by the server-only `AI_SETTINGS_ENCRYPTION_KEY` env var. Chosen
  over Supabase Vault for portability to future non-Supabase projects.
- **`lib/ai/settings.ts`** — resolves an independent routing policy for
  chat and analysis. Each policy can reference a primary and fallback
  `ai_settings` connection, defines a 3–60 second timeout, and requires
  explicit consent before crossing provider companies. The server checks
  workspace ownership, availability and resource authorization before
  decrypting a selected key. Without a saved policy it preserves the
  shared Groq demo fallback (`GROQ_API_KEY`).
- **`lib/ai/brand-context.ts`** — builds the AI
  system prompt from `docsRegistry`, explicitly carrying each page's
  Pronto/Rascunho/Em construção status so the assistant hedges on
  unsettled content instead of presenting it as fact.
- **`lib/ai/errors.ts`** — classifies `APICallError` into
  `invalid_key` (401/403) / `rate_limited` (429) / `model_unavailable`
  (404) / `unknown`, with a Portuguese user-facing message for each.
- **API routes** (`app/api/ai/*`) — settings CRUD, `test-connection`
  (a live minimal `generateText` call, gates the Save button in the UI),
  `chat` (prepares the first `streamText()` chunk before selecting the
  provider, then exposes the chosen text stream and routing headers), `analyze` (multimodal
  `generateText` with a base64 image, 422s with a friendly message if
  the configured model isn't vision-capable).
- **UI** — `app/docs/configuracoes/ia/page.tsx` (settings screen, demo
  badges, provider/model/resource form, per-resource routing policy and
  required connection test before save), `app/docs/chat/page.tsx` (streaming chat), `app/docs/analise/page.tsx`
  (image upload + analysis).

## Design tokens & fonts

`src/app/globals.css` defines a `@theme` block: primitive colors
(sampled from the cover art — see `the-bluesmaker-site/docs/DESIGN_SYSTEM.md`
for the extraction method), semantic aliases, release-specific tokens,
spacing (`--spacing-page-inline`, responsive), and the editorial easing
curve. Must stay in sync with `the-bluesmaker-site`'s tokens.

Gotham (Book/Medium/Bold/Black) is self-hosted from `src/fonts/*.otf` via
`next/font/local` in the root layout — licensed, never redistribute
outside this repo and `the-bluesmaker-site`.

## Visual direction

The docs shell (rail+panel+poster-style page headers) was chosen
2026-07-17 by comparing four throwaway mockups against the release
site's editorial language — see `project_bluesmaker_doctrine` in memory
for the full reasoning. Not an accident of the Overlens reference; a
deliberate hybrid.

## Environment variables

| Var | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | local + Vercel | Supabase client config |
| `NEXT_PUBLIC_SKIP_AUTH` | local `.env.local` only | Bypasses the auth gate for local review — never set in Vercel |
| `GROQ_API_KEY` | local + Vercel | Shared demo-mode AI provider |
| `AI_CHAT_FALLBACK_PROVIDER` / `AI_CHAT_FALLBACK_MODEL` / `AI_CHAT_FALLBACK_API_KEY` | server only, optional | Explicitly authorizes a secondary chat route; all three must be set together |
| `AI_SETTINGS_ENCRYPTION_KEY` | local + Vercel (distinct per environment) | Encrypts saved BYOK API keys — `openssl rand -base64 32` |

## Known gaps

- No password-change / forgot-password UI yet — resetting currently
  requires direct DB access.
- Logo page (`LogoSection.tsx`) is a labeled placeholder pending real
  logo files from the client — see root `CLAUDE.md`.
- Most docs-registry pages are still `draft`/`pending`, honestly, per
  the no-fabrication rule — filling them in is ongoing work, not a bug.
