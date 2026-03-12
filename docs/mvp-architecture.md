# Architecture

## Goal

Deliver a full-stack foundation for the AI SEO Localization Tool that matches the PRD's core pipeline:

1. Parse English SEO pages into a normalized schema.
2. Apply keyword lock mappings per target locale.
3. Translate page content while preserving heading structure and SEO intent.
4. Generate localized page files.
5. Generate hreflang data and locale-specific sitemap XML.
6. Expose a simple internal web UI for project and export operations.

## Current implementation

### Shared domain package

`packages/shared` centralizes the domain model and deterministic generation logic:

- `types.ts`: projects, pages, keyword locks, export bundle contracts
- `page-schema.ts`: slug normalization, text transformation, Markdown/HTML rendering
- `keyword-lock.ts`: per-language lock selection and keyword enforcement
- `hreflang.ts`: alternate locale link generation
- `sitemap.ts`: XML sitemap rendering with hreflang alternates
- `exporters.ts`: packaged file outputs for localized content

This keeps the API and web layers aligned to one schema instead of duplicating SEO logic.

### API app

`apps/api` is a Fastify service with persistent local state and disk-backed export output.

Core responsibilities:

- project CRUD-lite for source language, target languages, and base URL
- page ingestion through raw markdown or structured page schema
- keyword lock CRUD-lite
- translation prompt generation and provider integration
- export bundle generation for content files, hreflang JSON, and sitemaps
- persistent state written to `runtime/app-state.json`
- exported assets written to `runtime/exports/<projectId>/<slug>/...`

Important implementation note:

- The translation layer supports `openrouter`, `siliconflow`, `openai`, and custom OpenAI-compatible endpoints.
- Real translation requires a provider API key plus model, while `TRANSLATION_PROVIDER=mock` remains demo-only.

### Web app

`apps/web` is a Next.js admin shell with dedicated views for:

- Dashboard
- Projects
- Pages
- Keywords
- Generate
- Exports

The UI reads live API data from `NEXT_PUBLIC_API_BASE_URL` and does not silently fall back to mock data.

## Data flow

```text
English markdown/schema
  -> parser
  -> PageSchema
  -> keyword lock lookup
  -> translation engine
  -> localized PageSchema variants
  -> content/hreflang/sitemap exporters
  -> web UI or downstream repository sync
```

## Recommended next steps

1. Replace local file persistence with PostgreSQL repositories behind the current store interface.
2. Move project generation into queued jobs backed by Redis.
3. Persist prompt/output history and audit logs for each translation run.
4. Write integration tests for parser, keyword lock enforcement, provider integration, and export bundle generation.
5. Add repository export targets so bundles can be written straight into a content repo.
