# AI Handoff & Architecture Blueprint

> **Notice to Future AI Assistants**: Read this document first to immediately understand the repository structure, schema, conventions, and design philosophy without spending tokens parsing the entire codebase.

---

## 1. High-Level Summary

This repository is **`admin-cms`**, a private, single-user administrative dashboard built with Next.js App Router for managing content published to a Hugo website via Turso (libSQL).

- **Strict Separation of Concerns**: Hugo site is read-only static; CMS is the sole writer to Turso.
- **Content Delivery**: Hugo fetches directly from Turso using Hugo Content Adapters at build time. No markdown files or JSON files are output to disk or committed to Git.
- **Workflow**: Create/Edit Post -> Save to Turso -> Status set to `published` -> Trigger `VERCEL_DEPLOY_HOOK` -> Hugo site rebuilds automatically.

---

## 2. Key Directories & Code Structure

```text
admin-cms/
├── src/
│   ├── app/
│   │   ├── (auth)/login/        # Password login page
│   │   ├── (dashboard)/         # Protected dashboard layout & routes
│   │   │   ├── page.tsx         # Dashboard overview with metrics
│   │   │   ├── microblog/       # Microblog list & CRUD editor routes
│   │   │   └── [placeholder]/   # Modular placeholder pages (blog, books, etc.)
│   │   ├── globals.css          # Design tokens, themes (HN Orange, Dark, Mono, Teal)
│   │   └── layout.tsx           # Root layout & ThemeProvider
│   ├── components/              # Shared UI (Header, Sidebar, ThemeToggle, etc.)
│   ├── db/
│   │   ├── schema.ts            # Drizzle table schemas (microblogs, etc.)
│   │   └── index.ts             # Turso / libSQL client initializer
│   ├── features/
│   │   ├── auth/                # Session cookies, password check, login server actions
│   │   ├── microblog/           # Microblog actions, Zod validation, Editor & List
│   │   └── media/               # StorageProvider interface (Local, S3, R2, Vercel Blob)
│   ├── lib/
│   │   └── deploy-hook.ts       # Vercel deploy hook caller
│   └── middleware.ts            # Next.js route protection middleware
├── tests/                       # Vitest unit test suite
├── drizzle.config.ts            # Drizzle kit configuration
└── prompt.txt                   # Original prompt & requirements
```

---

## 3. Database Schema (`src/db/schema.ts`)

### `microblogs`
- `id` (text, primary key): UUID string
- `slug` (text, unique, not null): URL slug auto-generated from markdown or custom
- `contentMarkdown` (text, not null): Raw markdown content
- `status` (text, enum: `'draft' | 'published' | 'scheduled' | 'archived'`): Status state
- `tags` (text, default `'[]'`): JSON string array of tags
- `coverImageUrl` (text, nullable): External URL for cover media
- `createdAt` (text, ISO timestamp)
- `updatedAt` (text, ISO timestamp)
- `publishedAt` (text, nullable ISO timestamp)

---

## 4. Auth & Middleware Design

- **Single Password**: Defined by `ADMIN_PASSWORD` env variable (fallback `admin123` in dev).
- **Session**: Enthralling JWT stored in `cms_session` HTTP-only cookie signed with `jose`.
- **Middleware**: Intercepts request paths except `/login` and static assets. Redirects unauthorized requests to `/login`.

---

## 5. Extensibility Guidelines for Future AI Agents

To add a new content type (e.g. `Books`, `Blog`, `Quotes`):
1. **Database Schema**: Add table definition in `src/db/schema.ts` (e.g. `export const books = sqliteTable(...)`).
2. **Feature Folder**: Create `src/features/[feature_name]/` with:
   - `schema.ts`: Zod input validation & types.
   - `actions.ts`: Server actions for CRUD + deploy hook trigger.
   - `[Feature]Editor.tsx` & `[Feature]List.tsx`: Visual components.
3. **App Route**: Replace the page in `src/app/(dashboard)/[feature_name]/page.tsx` with the new feature component.
4. **Tests**: Add unit test in `tests/[feature_name].test.ts`.

---

## 6. How to Run Commands & Tests

- **Development Server**: `npm run dev`
- **Build Verification**: `npm run build`
- **Execute Tests**: `npm run test`
- **Drizzle DB Push**: `npm run db:push`
