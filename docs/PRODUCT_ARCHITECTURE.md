# Brandville Product Architecture v1.0

**Document type:** Product architecture specification  
**Product:** Brandville  
**Version:** 1.0  
**Status:** Strategic baseline  
**Pilot implementation:** The BluesMaker  
**Owner:** André Coelho Studio  
**Last updated:** 2026-07-17

---

> Companion docs: [`BRAND_KNOWLEDGE_BASE_SCHEMA.md`](./BRAND_KNOWLEDGE_BASE_SCHEMA.md)
> (the detailed module/document/section/block schema behind §7-8 below),
> [`BRANDING_BRIEF_TEMPLATE.md`](./BRANDING_BRIEF_TEMPLATE.md) (the
> discovery/intake flow that populates that schema), and
> [`ARCHITECTURE.md`](./ARCHITECTURE.md) (what's actually implemented today).

---

# 0. Executive Summary

Brandville is a multi-brand, multi-workspace platform for documenting, governing, consulting, evaluating, and exporting brand knowledge.

The product transforms conventional brand-guideline documentation into a structured operational system. It combines:

- brand strategy;
- verbal identity;
- visual identity;
- design-system documentation;
- asset management;
- AI-assisted consultation;
- image analysis;
- governance;
- versioning;
- exportable brand books;
- reusable templates.

The BluesMaker is the first full implementation and pilot case. It must validate the platform without becoming the platform architecture itself.

The central architectural principle is:

> **Brandville is the reusable product. Each client brand is a configurable instance.**

The platform must separate five concerns:

1. **Product shell** — navigation, authentication, permissions, search, editing, export, and AI interfaces.
2. **Brand content** — purpose, positioning, voice, visual rules, assets, examples, and decisions.
3. **Brand templates** — reusable document structures and question sets for different project types.
4. **Brand themes** — visual presentation for each workspace or brand.
5. **Brand intelligence** — contextual AI, analysis rules, decision heuristics, and evaluation criteria.

This separation is mandatory for scalability.

---

# 1. Product Definition

## 1.1 Product name

**Brandville**

## 1.2 Product category

Brand governance and brand knowledge platform.

## 1.3 Core job to be done

Brandville helps studios, consultants, companies, cultural organizations, and creative teams turn brand strategy and identity into a living, searchable, governable, and AI-assisted system.

## 1.4 Primary product promise

> Brand knowledge should remain usable after the presentation is over.

## 1.5 Product scope

Brandville must support the complete lifecycle of a brand system:

- discovery;
- briefing;
- strategy;
- design definition;
- documentation;
- approval;
- implementation;
- consultation;
- auditing;
- maintenance;
- export;
- evolution.

## 1.6 Non-goals

Brandville is not primarily:

- a generic website builder;
- a project-management platform;
- a DAM-only product;
- a social-media scheduler;
- a design tool;
- a replacement for Figma;
- a replacement for human brand strategy;
- an autonomous creative director.

It may integrate with such systems, but its core function is structured brand intelligence.

---

# 2. Strategic Architecture

## 2.1 System hierarchy

```text
BRANDVILLE
Reusable product platform

    ├── Workspaces
    │     ├── Members
    │     ├── Permissions
    │     ├── Billing
    │     └── Settings
    │
    ├── Brands
    │     ├── Knowledge Base
    │     ├── Design System
    │     ├── Assets
    │     ├── AI Context
    │     ├── Reviews
    │     └── Exports
    │
    ├── Templates
    │     ├── Universal Brand
    │     ├── Artist Brand
    │     ├── Cultural Project
    │     ├── Corporate Brand
    │     ├── Product Brand
    │     └── Hospitality Brand
    │
    └── Themes
          ├── Default
          ├── Editorial
          ├── Minimal
          ├── Institutional
          └── Custom
```

## 2.2 Core architectural rule

No client-specific content may be required by the product core.

The application must continue to function when:

- The BluesMaker content is removed;
- the theme changes completely;
- the document structure changes;
- optional modules are disabled;
- a second brand is created in the same workspace;
- the active AI provider changes.

## 2.3 Product layers

### Layer A — Platform

Contains shared product behavior:

- authentication;
- onboarding;
- workspaces;
- navigation;
- permissions;
- command palette;
- search;
- document rendering;
- editors;
- versioning;
- exports;
- AI routing;
- error handling;
- audit logs.

### Layer B — Template system

Defines reusable starting structures:

- document groups;
- modules;
- questions;
- required fields;
- optional fields;
- review criteria;
- AI instructions;
- default status;
- default ordering.

### Layer C — Brand instance

Contains client-specific decisions:

- brand name;
- purpose;
- positioning;
- values;
- audience;
- voice;
- visual identity;
- assets;
- examples;
- anti-patterns;
- tokens;
- approvals;
- versions.

### Layer D — Theme

Defines visual presentation:

- colors;
- typography;
- density;
- layout style;
- visual accents;
- image behavior;
- component skinning.

### Layer E — Intelligence

Defines machine-readable reasoning context:

- knowledge retrieval;
- approval status;
- brand rules;
- evaluation rubrics;
- role-specific system prompts;
- image-analysis frameworks;
- content-review frameworks;
- decision heuristics.

---

# 3. Product Principles

## 3.1 Structured before decorative

Brandville must prioritize data structure, clarity, traceability, and consistency before visual customization.

## 3.2 Honest status

Unsettled content must never be presented as approved truth.

Every content item needs an explicit state:

- pending;
- draft;
- review;
- approved;
- deprecated;
- archived.

## 3.3 Brand content is data

Brand knowledge must not exist only as long static Markdown strings.

The platform must model content in reusable structures such as:

- prose;
- principles;
- rules;
- examples;
- anti-patterns;
- checklists;
- tokens;
- references;
- galleries;
- decision rubrics.

## 3.4 AI is contextual, not authoritative

AI must:

- cite or identify the relevant brand modules;
- respect approval status;
- hedge when content is unresolved;
- distinguish explicit rules from inference;
- never silently invent brand decisions.

## 3.5 Product and client identity remain distinct

The Brandville interface must remain usable even when the client brand has:

- dark colors;
- low contrast accent colors;
- experimental typography;
- irregular layout rules;
- no approved visual system yet.

## 3.6 Portability

The architecture must avoid unnecessary dependence on a single:

- database;
- AI provider;
- hosting provider;
- storage provider;
- design tool.

## 3.7 Progressive complexity

A small client may use:

- 10 modules;
- 1 brand;
- 2 users;
- basic export.

A larger organization may use:

- multiple brands;
- multiple teams;
- advanced permissions;
- localized content;
- extensive versioning;
- approval workflows;
- integrations.

Both must use the same product foundation.

---

# 4. Primary User Types

## 4.1 Studio owner

Creates, configures, and governs client workspaces.

Needs:

- reusable templates;
- fast onboarding;
- content import;
- review control;
- polished presentation;
- export;
- portfolio-ready cases.

## 4.2 Brand strategist

Develops:

- purpose;
- positioning;
- values;
- audience;
- architecture;
- governance.

Needs:

- structured writing;
- version comparison;
- comments;
- approval;
- research references.

## 4.3 Creative director

Evaluates:

- visual language;
- photography;
- typography;
- design coherence;
- campaign systems.

Needs:

- visual references;
- image analysis;
- decision rubrics;
- approved examples;
- anti-patterns.

## 4.4 Designer

Uses the system to produce work.

Needs:

- current approved rules;
- tokens;
- downloadable assets;
- implementation examples;
- do/don't guidance.

## 4.5 Writer or content team

Needs:

- voice;
- vocabulary;
- message hierarchy;
- examples;
- editorial rules;
- campaign language guidance.

## 4.6 Client stakeholder

Needs:

- simple navigation;
- high-confidence approved content;
- controlled commenting;
- clear decisions;
- exportable documentation.

## 4.7 Developer

Needs:

- tokens;
- component rules;
- accessibility requirements;
- implementation notes;
- machine-readable outputs.

## 4.8 Press or partner

Needs:

- restricted read-only access;
- logo files;
- official descriptions;
- approved imagery;
- usage guidance.

---

# 5. Workspace and Brand Model

## 5.1 Workspace

A workspace is the primary organizational and security boundary.

A workspace may represent:

- André Coelho Studio;
- a client company;
- a cultural organization;
- a holding group;
- an internal brand team.

A workspace contains:

- members;
- roles;
- brands;
- templates;
- billing;
- AI credentials;
- workspace settings;
- activity logs.

## 5.2 Brand

A brand is an independent knowledge and design system inside a workspace.

Examples:

```text
Workspace: André Coelho Studio
  ├── The BluesMaker
  ├── Cultural Branding Studio
  └── Client Demo Brand
```

```text
Workspace: Corporate Group
  ├── Master Brand
  ├── Product A
  └── Product B
```

## 5.3 Multi-brand requirement

The system must support multiple brands inside the same workspace without:

- duplicating users;
- duplicating AI settings unnecessarily;
- mixing documents;
- leaking assets;
- mixing search results;
- applying one theme globally.

## 5.4 Active brand context

Every brand-sensitive route must resolve:

```ts
{
  workspaceId,
  brandId,
  userId,
  role,
  permissions
}
```

The active brand must be explicit in:

- URL;
- server request;
- database query;
- AI context;
- asset lookup;
- export job.

---

# 6. Template Architecture

## 6.1 Purpose

Templates provide reusable starting structures without hardcoding client content.

A template defines:

- recommended modules;
- default order;
- briefing questions;
- optional modules;
- validation rules;
- example structures;
- AI guidance;
- export structure.

## 6.2 Universal template

The universal template contains the shared foundation for most branding projects.

### Core modules

1. Brand Overview
2. Context and Challenge
3. Purpose
4. Mission
5. Vision
6. Values
7. Beliefs
8. Positioning
9. Brand Promise
10. Audience
11. Personality
12. Archetypes
13. Verbal Identity
14. Visual Identity
15. Brand Experience
16. Governance

## 6.3 Optional modules

- Music DNA
- Cultural Context
- Employer Brand
- Product Architecture
- Service Experience
- Retail Environment
- Sustainability
- Packaging
- Wayfinding
- Motion
- Sound Identity
- Campaign System
- Digital Product
- Release System
- Exhibition System
- Sponsorship System
- Accessibility
- Localization

## 6.4 Template inheritance

Templates should support inheritance.

```text
Universal Brand
    ↓
Artist Brand
    ↓
Independent Music Artist
```

Child templates may:

- add modules;
- change order;
- add questions;
- add evaluation criteria;
- set default visibility;
- define specialized AI instructions.

They must not mutate the parent globally.

## 6.5 Template versioning

Templates require versions.

A brand created from `artist-brand@1.0` must not automatically change when `artist-brand@2.0` is published.

Migration must be explicit.

---

# 7. Content Architecture

## 7.1 Content hierarchy

```text
Brand
  └── Document Group
        └── Document
              └── Section
                    └── Block
```

## 7.2 Document group

Examples:

- Foundation
- Strategy
- Audience
- Verbal Identity
- Visual Identity
- Digital
- Governance
- References

## 7.3 Document

A document represents a navigable knowledge unit.

Examples:

- Purpose
- Positioning
- Tone of Voice
- Photography
- Typography
- Logo
- Motion

## 7.4 Section

A section groups related content within a document.

Example:

```text
Photography
  ├── Strategic role
  ├── Principles
  ├── Lighting
  ├── Composition
  ├── Subjects
  ├── Anti-patterns
  └── Evaluation checklist
```

## 7.5 Block types

Recommended initial block types:

```ts
type BrandBlockType =
  | "prose"
  | "quote"
  | "principles"
  | "rules"
  | "values"
  | "examples"
  | "anti_patterns"
  | "checklist"
  | "table"
  | "gallery"
  | "asset_grid"
  | "color_tokens"
  | "type_scale"
  | "logo_lockups"
  | "motion_spec"
  | "code"
  | "references"
  | "decision_rubric"
  | "callout";
```

## 7.6 Content metadata

Every document and section should support:

- status;
- version;
- author;
- reviewer;
- created date;
- updated date;
- approved date;
- tags;
- locale;
- visibility;
- source references;
- related documents;
- AI inclusion flag.

## 7.7 Machine readability

The same content must support:

- human-readable documentation;
- AI retrieval;
- search indexing;
- export;
- validation;
- API consumption.

---

# 8. Suggested Data Model

## 8.1 Workspaces

```ts
interface Workspace {
  id: string
  name: string
  slug: string
  ownerId: string
  plan: "demo" | "studio" | "team" | "enterprise"
  createdAt: string
  updatedAt: string
}
```

## 8.2 Workspace members

```ts
interface WorkspaceMember {
  workspaceId: string
  userId: string
  role:
    | "owner"
    | "admin"
    | "strategist"
    | "editor"
    | "reviewer"
    | "viewer"
  createdAt: string
}
```

## 8.3 Brands

```ts
interface Brand {
  id: string
  workspaceId: string
  name: string
  slug: string
  description?: string
  industry?: string
  templateId: string
  templateVersion: string
  themeId: string
  status: "draft" | "active" | "archived"
  defaultLocale: string
  createdAt: string
  updatedAt: string
}
```

## 8.4 Documents

```ts
interface BrandDocument {
  id: string
  brandId: string
  groupKey: string
  key: string
  slug: string
  title: string
  summary?: string
  status:
    | "pending"
    | "draft"
    | "review"
    | "approved"
    | "deprecated"
  order: number
  version: number
  locale: string
  visibility: "internal" | "client" | "partner" | "public"
  includeInAI: boolean
  createdAt: string
  updatedAt: string
  approvedAt?: string
}
```

## 8.5 Sections

```ts
interface BrandSection {
  id: string
  documentId: string
  key: string
  title?: string
  summary?: string
  order: number
  status: BrandDocument["status"]
}
```

## 8.6 Blocks

```ts
interface BrandBlock {
  id: string
  sectionId: string
  type: BrandBlockType
  content: unknown
  order: number
  metadata?: Record<string, unknown>
}
```

## 8.7 Assets

```ts
interface BrandAsset {
  id: string
  brandId: string
  documentId?: string
  type:
    | "image"
    | "logo"
    | "font"
    | "video"
    | "audio"
    | "document"
    | "archive"
  name: string
  filePath: string
  mimeType: string
  fileSize: number
  usageRights?: string
  attribution?: string
  status: "draft" | "approved" | "deprecated"
  tags: string[]
  createdAt: string
  updatedAt: string
}
```

## 8.8 Brand tokens

```ts
interface BrandTokenSet {
  id: string
  brandId: string
  category:
    | "color"
    | "typography"
    | "spacing"
    | "radius"
    | "motion"
    | "shadow"
    | "layout"
  version: number
  status: "draft" | "approved" | "deprecated"
  values: Record<string, unknown>
}
```

## 8.9 Reviews

```ts
interface BrandReview {
  id: string
  brandId: string
  targetType: "document" | "section" | "block" | "asset" | "export"
  targetId: string
  reviewerId: string
  decision: "comment" | "request_changes" | "approve" | "reject"
  comment?: string
  createdAt: string
}
```

## 8.10 Versions

```ts
interface BrandVersion {
  id: string
  brandId: string
  entityType: string
  entityId: string
  version: number
  snapshot: unknown
  authorId: string
  createdAt: string
}
```

---

# 9. Route Architecture

## 9.1 Recommended URL model

```text
/app
  /workspaces
  /w/[workspaceSlug]
    /dashboard
    /brands
    /settings
    /members

  /w/[workspaceSlug]/b/[brandSlug]
    /overview
    /docs
    /docs/[...slug]
    /edit/[...slug]
    /chat
    /analysis
    /assets
    /reviews
    /exports
    /settings
```

## 9.2 Route requirements

All brand routes must:

- validate workspace membership;
- validate brand access;
- resolve permissions;
- scope database queries;
- scope AI context;
- scope assets;
- scope search.

## 9.3 Public or partner routes

Optional controlled sharing:

```text
/share/[shareToken]
```

Share links must support:

- expiration;
- password;
- document restrictions;
- download restrictions;
- watermarking;
- access logs.

---

# 10. Application Modules

## 10.1 Dashboard

Shows:

- active brands;
- recent edits;
- pending reviews;
- incomplete modules;
- AI usage;
- exports;
- team activity.

## 10.2 Documentation

Core reading experience.

Capabilities:

- sidebar navigation;
- search;
- command palette;
- status labels;
- related documents;
- version indicator;
- citations;
- assets;
- responsive layout.

## 10.3 Editor

Capabilities:

- structured block editing;
- Markdown support;
- drag ordering;
- status control;
- comments;
- version history;
- preview;
- validation;
- AI-assisted rewrite;
- source references.

## 10.4 Assets

Capabilities:

- upload;
- tagging;
- preview;
- download;
- version replacement;
- rights metadata;
- usage notes;
- document association;
- approved/deprecated states.

## 10.5 Brand Chat

The assistant answers questions about the active brand.

It must:

- use the current brand only;
- prioritize approved content;
- identify draft content;
- avoid fabrication;
- show relevant source modules;
- respect user permissions.

## 10.6 Image Analysis

The analysis tool evaluates uploaded imagery using the active brand's:

- photography rules;
- visual principles;
- typography rules;
- color system;
- composition rules;
- anti-patterns;
- accessibility rules;
- campaign context.

## 10.7 Reviews

Supports:

- comments;
- approval;
- rejection;
- change requests;
- assignment;
- due dates;
- review history.

## 10.8 Exports

Initial export targets:

- Markdown;
- PDF;
- static web package;
- JSON;
- design tokens;
- press kit;
- asset package.

## 10.9 Settings

Workspace settings:

- members;
- billing;
- AI providers;
- security;
- default templates.

Brand settings:

- name;
- theme;
- template;
- locales;
- visibility;
- export defaults;
- AI behavior.

---

# 11. Permissions Architecture

## 11.1 Roles

### Owner

Full workspace control.

### Admin

Manages brands, members, templates, and settings.

### Strategist

Creates and edits strategic content.

### Editor

Edits assigned content and assets.

### Reviewer

Comments and approves.

### Viewer

Read-only access.

## 11.2 Permission dimensions

Permissions should be evaluated by:

- workspace;
- brand;
- module;
- action;
- content status;
- visibility.

## 11.3 Actions

```ts
type PermissionAction =
  | "view"
  | "create"
  | "edit"
  | "comment"
  | "review"
  | "approve"
  | "publish"
  | "export"
  | "manage_assets"
  | "manage_members"
  | "manage_ai"
  | "manage_brand"
  | "manage_workspace";
```

---

# 12. AI Architecture

## 12.1 AI principles

The AI layer must remain provider-agnostic.

A single provider adapter should resolve:

```ts
{
  provider,
  model,
  apiKey,
  capabilities
}
```

## 12.2 AI roles

Recommended roles:

- brand chat;
- image analysis;
- content review;
- brief generation;
- consistency audit;
- export assistant;
- prompt generation.

## 12.3 Context builder

Recommended interface:

```ts
buildBrandContext({
  workspaceId,
  brandId,
  userId,
  role,
  requestedModules,
  includeDrafts,
  locale
})
```

## 12.4 Context priority

1. Approved brand content.
2. Approved design tokens.
3. Approved assets and examples.
4. Reviewed draft content.
5. Draft content with explicit warning.
6. Template guidance.
7. General model knowledge.

General model knowledge must never override explicit approved brand rules.

## 12.5 Retrieval strategy

Use a layered approach:

- metadata filtering;
- full-text search;
- semantic retrieval;
- status weighting;
- module relevance;
- recency;
- explicit relationships.

## 12.6 Image-analysis output structure

```ts
interface BrandImageAnalysis {
  summary: string
  overallScore: number
  dimensions: {
    composition: ScoreDetail
    photography: ScoreDetail
    color: ScoreDetail
    typography: ScoreDetail
    emotionalFit: ScoreDetail
    distinctiveness: ScoreDetail
    accessibility: ScoreDetail
  }
  strengths: string[]
  risks: string[]
  antiPatternsDetected: string[]
  recommendations: string[]
  relevantBrandDocuments: string[]
  confidence: number
}
```

## 12.7 AI safety and honesty

The assistant must explicitly state when:

- a topic is pending;
- the knowledge base is incomplete;
- a conclusion is inferred;
- the configured model lacks vision;
- the user lacks access to a source;
- two approved rules conflict.

---

# 13. Search Architecture

## 13.1 Search scope

Search must support:

- current document;
- current brand;
- current workspace;
- permitted shared content.

## 13.2 Searchable entities

- documents;
- sections;
- blocks;
- assets;
- tags;
- references;
- comments;
- exports;
- versions.

## 13.3 Command palette

The command palette should combine:

- navigation;
- document search;
- asset search;
- actions;
- recent items.

---

# 14. Theme Architecture

## 14.1 Product tokens

Brandville product tokens must remain stable.

Examples:

```css
--app-background
--app-surface
--app-text
--app-text-muted
--app-border
--app-focus
--app-danger
--app-success
--app-navigation-width
```

## 14.2 Brand tokens

Brand-specific tokens are contextual.

Examples:

```css
--brand-primary
--brand-secondary
--brand-accent
--brand-background
--brand-foreground
--brand-display-font
--brand-body-font
--brand-radius
--brand-motion-ease
```

## 14.3 Isolation rule

A client brand theme must never compromise:

- product accessibility;
- form legibility;
- system alerts;
- authentication;
- critical actions;
- permission interfaces.

## 14.4 Theme application modes

Recommended modes:

- restrained accent;
- immersive brand;
- neutral review;
- export-only.

This allows the working interface to remain neutral while public-facing documentation becomes more expressive.

---

# 15. Design System Architecture

## 15.1 Product design system

Owns:

- shell;
- forms;
- tables;
- dialogs;
- navigation;
- notifications;
- editors;
- accessibility;
- responsive behavior.

## 15.2 Brand design system renderer

Renders client-specific:

- color systems;
- typography;
- logo rules;
- spacing;
- motion;
- components;
- layout systems.

## 15.3 Generic renderers

Client-specific components should become data-driven generic renderers:

```text
ColorSystemRenderer
TypographySystemRenderer
PhotographyGuideRenderer
VoiceGuideRenderer
LogoSystemRenderer
MotionSystemRenderer
TokenTableRenderer
AssetGalleryRenderer
DecisionRubricRenderer
```

## 15.4 Renderer contract

A renderer must:

- accept structured data;
- validate data;
- support empty states;
- support draft status;
- support exports;
- avoid client imports;
- remain theme-aware.

---

# 16. Import and Migration Architecture

## 16.1 Supported import sources

Initial:

- Markdown;
- JSON;
- CSV;
- pasted text;
- uploaded images;
- local seed files.

Future:

- Notion;
- Google Docs;
- Figma variables;
- Style Dictionary;
- existing website;
- PDF brand book.

## 16.2 Migration from static content

Current static content should move through three stages:

### Stage 1 — Seed data

Existing `docs.ts` and `brand.ts` content becomes a client seed.

### Stage 2 — Database content

The seed populates normalized tables.

### Stage 3 — Admin editing

Content is edited through the application and versioned.

## 16.3 Compatibility layer

During migration, the app may support:

```ts
resolveBrandContent({
  databaseFirst: true,
  fallbackToSeed: true
})
```

The fallback must be temporary and observable.

---

# 17. Export Architecture

## 17.1 Export profiles

Examples:

- Full Brand Book
- Visual Guidelines
- Verbal Guidelines
- Press Kit
- Developer Handoff
- Partner Pack
- Executive Summary

## 17.2 Export pipeline

```text
Select profile
  ↓
Resolve approved content
  ↓
Resolve permissions
  ↓
Resolve theme
  ↓
Render structured output
  ↓
Generate files
  ↓
Store export record
```

## 17.3 Export integrity

Exports must record:

- brand version;
- document versions;
- export date;
- author;
- theme;
- included modules;
- locale.

---

# 18. Versioning and Governance

## 18.1 Version levels

- block version;
- document version;
- token version;
- asset version;
- brand release version;
- template version.

## 18.2 Brand release

A brand release is a coordinated approved snapshot.

Example:

```text
The BluesMaker Brand System 1.0
```

It may include:

- approved documents;
- approved assets;
- token set;
- export;
- release notes.

## 18.3 Change log

Each release should document:

- added;
- changed;
- deprecated;
- removed;
- migration notes.

## 18.4 Governance rules

Only authorized roles may:

- approve;
- publish;
- deprecate;
- export official versions;
- change template;
- change active theme.

---

# 19. Security Architecture

## 19.1 Security boundary

Workspace ID must be enforced at database policy level.

Frontend filtering is insufficient.

## 19.2 Required controls

- row-level security;
- encrypted AI credentials;
- secure file URLs;
- audit logs;
- rate limits;
- upload validation;
- MIME checks;
- image size limits;
- signed share links;
- session expiration;
- role enforcement.

## 19.3 Sensitive assets

Fonts, proprietary strategy documents, and unreleased campaign assets must not be publicly exposed.

## 19.4 AI credential policy

API keys must:

- be encrypted at rest;
- never be exposed client-side;
- be testable before activation;
- be isolated by workspace;
- support deactivation;
- record last successful use.

---

# 20. Accessibility

Brandville must target WCAG 2.2 AA for the product interface.

Requirements include:

- keyboard navigation;
- visible focus;
- semantic landmarks;
- screen-reader labels;
- reduced-motion support;
- contrast checks;
- error messaging;
- accessible dialogs;
- accessible upload controls;
- responsive text scaling.

Brand themes may be expressive, but official exported documentation should warn when client-approved colors fail accessibility requirements.

---

# 21. Performance

## 21.1 Product targets

- fast authenticated navigation;
- lazy-loaded galleries;
- optimized image variants;
- streamed AI responses;
- pagination for assets and activity;
- cached approved documents;
- incremental search indexing.

## 21.2 Large workspace considerations

The architecture must remain functional with:

- 100+ documents;
- 10,000+ assets;
- multiple brands;
- large audit histories;
- multilingual content.

---

# 22. Localization

## 22.1 Content locale

Each document may have multiple locales.

## 22.2 Fallback logic

```text
Requested locale
  ↓
Brand default locale
  ↓
Workspace default locale
  ↓
Template language
```

## 22.3 Translation states

- untranslated;
- machine draft;
- human review;
- approved.

---

# 23. Analytics and Observability

## 23.1 Product analytics

Track:

- most viewed modules;
- search failures;
- AI questions;
- asset downloads;
- export frequency;
- incomplete modules;
- review duration.

## 23.2 AI observability

Track:

- provider;
- model;
- token usage;
- latency;
- errors;
- cited modules;
- user feedback;
- confidence;
- demo mode.

Do not log confidential prompt content without explicit policy.

---

# 24. Portfolio Architecture

The portfolio case should frame Brandville as:

> A reusable brand-governance platform developed from a real independent music project and designed to scale to future studio clients.

The case should demonstrate:

1. Brand strategy.
2. Information architecture.
3. Product design.
4. Design-system thinking.
5. AI implementation.
6. Multi-tenant architecture.
7. Content modeling.
8. Governance.
9. Real pilot validation.

The BluesMaker must appear as:

- pilot;
- proof of concept;
- first production instance;
- visual case study.

It must not appear as the only possible use case.

---

# 25. Recommended Codebase Boundaries

```text
src/
  app/
    w/[workspaceSlug]/
      b/[brandSlug]/

  core/
    auth/
    permissions/
    content/
    templates/
    themes/
    ai/
    search/
    exports/
    versioning/
    validation/

  components/
    product/
    docs/
    editors/
    assets/
    reviews/
    renderers/
    ai/

  templates/
    universal/
    artist/
    cultural/
    corporate/
    hospitality/

  themes/
    default/
    editorial/
    minimal/
    institutional/

  seeds/
    the-bluesmaker/

  lib/
    database/
    storage/
    telemetry/
```

---

# 26. The BluesMaker Pilot Mapping

## Product

Brandville

## Workspace

André Coelho Studio

## Brand

The BluesMaker

## Template

Artist Brand

## Theme

Editorial / immersive brand mode

## Specialized modules

- Music DNA
- Release System
- Lyrics
- Photography
- Streaming
- Video
- Press Assets

## AI use cases

- brand consultation;
- visual consistency review;
- cover-art analysis;
- copy review;
- prompt generation;
- internal collaborator guidance.

---

# 27. Migration Priorities

## Priority 1 — Remove global brand assumptions

Eliminate product logic that assumes:

- one brand;
- one document registry;
- one theme;
- one set of assets.

## Priority 2 — Add brand routing

Introduce workspace and brand slugs.

## Priority 3 — Normalize content

Move from static arrays to structured database entities.

## Priority 4 — Generalize renderers

Convert client-specific components into data-driven renderers.

## Priority 5 — Scope AI context

Every AI call must resolve workspace and brand.

## Priority 6 — Introduce template engine

Create universal and artist templates.

## Priority 7 — Add versioning and review

Make the product suitable for client work.

## Priority 8 — Add export profiles

Support practical delivery.

---

# 28. Technical Decision Records Required

Create ADRs for:

1. Multi-tenant workspace boundary.
2. Brand data model.
3. Template inheritance.
4. Content block architecture.
5. AI provider abstraction.
6. Brand-context retrieval.
7. Theme isolation.
8. Asset storage.
9. Versioning strategy.
10. Export pipeline.
11. Search architecture.
12. Static seed migration.

---

# 29. MVP Definition

The first scalable MVP is complete when a studio owner can:

1. Create a workspace.
2. Create a brand from a template.
3. Invite a collaborator.
4. Edit structured brand documents.
5. Upload and organize assets.
6. Mark content as draft or approved.
7. Ask the brand chat a contextual question.
8. Analyze an image against brand rules.
9. Export an approved Markdown or PDF brand book.
10. Create a second brand without code changes.

---

# 30. Definition of Done

Brandville Product Architecture v1.0 is correctly implemented when:

- The BluesMaker is stored as an instance, not product logic.
- Multiple brands can coexist.
- Templates can create different brand structures.
- Themes are isolated from the product shell.
- AI context is scoped by workspace and brand.
- Content status is explicit.
- Renderers consume structured data.
- assets are permission-aware;
- brand versions can be exported;
- client work can be added without modifying core code.

---

# 31. Final Principle

> **Brandville must not merely display brand guidelines. It must preserve, operationalize, and govern brand intelligence over time.**

The BluesMaker proves the concept.

The product must remain larger than the pilot.
