# AI SEO Localization Tool

Full-stack foundation for an AI SEO localization platform that parses English SEO pages, applies keyword locks, generates localized variants, and exports hreflang plus sitemap assets.

## Stack

- Backend: Node.js + Fastify + TypeScript
- Frontend: Next.js App Router + React + Tailwind
- Shared domain package: page schema, keyword lock logic, hreflang, sitemap, export bundle builders
- Persistence for this scaffold: local disk-backed runtime state

## Workspace layout

```text
apps/
  api/   Fastify API for projects, pages, keyword locks, translation, exports
  web/   Next.js internal admin UI for Dashboard, Projects, Pages, Keywords, Generate, Exports
packages/
  shared/ Shared types and generation helpers
docs/
  mvp-architecture.md
```

## Quick start

1. Install dependencies:

   ```bash
   npm install
   ```

2. Configure environment:

   ```bash
   cp .env.example .env
   ```

   Real translation requires a provider key such as `TRANSLATION_API_KEY`.
   Supported providers in the UI are `openrouter`, `siliconflow`, `openai`, `custom-compatible`, and `mock`.

3. Start the API:

   ```bash
   npm run dev:api
   ```

4. Start the web app in another terminal:

   ```bash
   npm run dev:web
   ```

5. Open `http://localhost:3000`.

## Current implementation

- Unified `PageSchema` for slug, metadata, sections, and FAQ
- Markdown parsing into the shared schema
- Keyword lock registry and language-specific enforcement
- Multi-provider translation integration with strict runtime status reporting
- Persistent backend state stored on disk
- Localized page export generation in Markdown, JSON, and HTML
- Export files written to disk with bundle manifests and sitemap files
- hreflang JSON generation
- Locale-specific sitemap XML generation
- Admin UI routes aligned to the PRD navigation
- End-to-end project, page, keyword, translate, and export flow through real API calls

## API routes

- `GET /health`
- `GET /api/overview`
- `GET /api/projects`
- `POST /api/projects`
- `GET /api/pages`
- `POST /api/pages`
- `GET /api/keywords`
- `POST /api/keywords`
- `GET /api/system/status`
- `POST /api/translate/page`
- `POST /api/translate/page/:pageId/all`
- `POST /api/generate/project/:projectId`
- `POST /api/run/project/:projectId`
- `GET /api/exports/:projectId`

## Known gaps for next iteration

- Replace local file persistence with PostgreSQL and job orchestration with Redis queue workers
- Add URL-import parsing and repository export integration
- Add auth and role enforcement for `Admin` and `Editor`
- Add validation, tests, and persistent job telemetry
