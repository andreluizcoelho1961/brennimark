# Universal Brand Knowledge Base Schema v1.0

**Document type:** Canonical schema specification
**Product:** Brennimark
**Version:** 1.0

---

> Companion to [`PRODUCT_ARCHITECTURE.md`](./PRODUCT_ARCHITECTURE.md) (the
> platform spec this schema plugs into),
> [`BRANDING_BRIEF_TEMPLATE.md`](./BRANDING_BRIEF_TEMPLATE.md) (the
> discovery flow that populates this schema), and
> [`ARCHITECTURE.md`](./ARCHITECTURE.md) (what's actually implemented today
> — currently a single flat `docsRegistry` array, not this module/document/
> section/block hierarchy). Target state, not current state.

---

# Purpose

This document defines the universal information architecture for every Brand Knowledge Base created inside Brennimark.

It is brand-agnostic and reusable across industries.

---

# Design Principles

1. Content before presentation.
2. Structured before narrative.
3. Human-readable and machine-readable.
4. Versionable.
5. Searchable.
6. AI-friendly.
7. Modular.
8. Extensible.

---

# Global Hierarchy

Workspace
└── Brand
    └── Knowledge Base
        ├── Module
        │   ├── Document
        │   │   ├── Section
        │   │   │   └── Block
        │   │   └── Metadata
        │   └── Assets
        └── Tokens

---

# Required Core Modules

- Brand Overview
- Context & Challenge
- Purpose
- Mission
- Vision
- Values
- Beliefs
- Positioning
- Audience
- Personality
- Archetypes
- Verbal Identity
- Visual Identity
- Brand Experience
- Governance

---

# Optional Modules

- Music DNA
- Photography
- Motion
- Packaging
- Service Experience
- Product Architecture
- Employer Brand
- Sustainability
- Accessibility
- Press Kit
- Campaign System

---

# Universal Document Structure

Every document contains:

- Summary
- Principles
- Rules
- Examples
- Anti-patterns
- Checklist
- References
- AI Notes

---

# Metadata

Each document stores:

- id
- slug
- title
- category
- summary
- status
- version
- locale
- visibility
- author
- reviewer
- createdAt
- updatedAt
- approvedAt
- tags
- relatedDocuments
- includeInAI

---

# Block Types

- prose
- quote
- principles
- rules
- checklist
- values
- examples
- antiPatterns
- references
- gallery
- table
- tokenTable
- code
- callout
- decisionRubric

---

# Status

pending

draft

review

approved

deprecated

archived

---

# AI Consumption

Priority:

1. Approved documents
2. Approved assets
3. Approved tokens
4. Reviewed drafts
5. Drafts with warning

---

# Export Targets

- Markdown
- PDF
- JSON
- Brand Book
- Design System
- Executive Summary
- Press Kit

---

# Versioning

Documents are versioned independently.

Brand releases are snapshots of approved versions.

---

# Extensibility

Templates inherit from this schema.

New modules can be added without breaking existing implementations.

---

# Definition of Done

The schema is complete when it supports multiple industries, multiple templates, AI retrieval, structured exports and long-term evolution.

---

# Final Principle

The schema defines how brand knowledge is organized, never what a specific brand should say.
