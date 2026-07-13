# AI Handoff & Architecture Blueprint

> **Notice to Future AI Assistants**: Read this document first to immediately understand the repository structure, schema, conventions, and design philosophy without spending tokens parsing the entire codebase.
>
> 📖 **Hugo Integration**: For instructions on plugging Hugo Content Adapters to this CMS, read [HUGO_CONTENT_ADAPTER.md](file:///home/dog/git/admin-cms/HUGO_CONTENT_ADAPTER.md).

---

## 1. High-Level Summary

This repository is **`admin-cms`**, a private, single-user administrative dashboard built with Next.js App Router for managing content published to a Hugo website via Turso (libSQL).

- **Strict Separation of Concerns**: Hugo site is read-only static; CMS is the sole writer to Turso.
- **Content Delivery**: Hugo fetches directly from Turso using Hugo Content Adapters at build time. No markdown files or JSON files are output to disk or committed to Git.
- **Workflow**: Create/Edit Post -> Save to Turso -> Status set to `published` -> Trigger `VERCEL_DEPLOY_HOOK` -> Hugo site rebuilds automatically.
- **UI & UX Highlights**: Responsive layouts, loading state spinners across all saving/publishing/deleting actions, Location metadata support (Name, Lat, Long) stored in Turso DB, public REST endpoints (`/api/microblogs`, `/api/gallery`), and live active Gallery management.


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
│   ├── components/              # Shared UI (Header, Sidebar, DeployWidget, etc.)
│   ├── db/
│   │   ├── schema.ts            # Drizzle table schemas (microblogs, etc.)
│   │   └── index.ts             # Turso / libSQL client & auto-initializer
│   ├── features/
│   │   ├── auth/                # Session cookies, password check, login server actions
│   │   ├── microblog/           # Microblog actions, Zod validation, Editor & List
│   │   ├── media/               # StorageProvider interface (Local, S3, R2, Vercel Blob)
│   │   └── deploy/              # Manual Vercel deploy trigger action
│   ├── lib/
│   │   └── deploy-hook.ts       # Vercel deploy hook caller
│   └── middleware.ts            # Next.js route protection middleware
├── tests/                       # Vitest unit test suite
├── HUGO_CONTENT_ADAPTER.md      # Step-by-step Hugo Content Adapter setup guide
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

### `gallery`
- `id` (text, primary key): UUID string
- `title` (text, not null): Photo title
- `slug` (text, unique, not null): URL slug
- `description` (text, nullable): Caption or notes
- `originalUrl`, `largeUrl`, `mediumUrl`, `thumbnailUrl` (text, not null): Cloudflare R2 / local derivative URLs
- `width`, `height`, `fileSize`, `mimeType` (number/string, nullable): Image file specifications
- `camera`, `lens`, `focalLength`, `aperture`, `shutterSpeed`, `iso`, `takenAt` (nullable EXIF technical metadata)
- `latitude`, `longitude`, `locationName` (nullable GPS location metadata)
- `visibility` (enum: `'public' | 'private' | 'unlisted'`, default `'public'`)
- `featured` (integer: `1` or `0`, default `0`)
- `tags` (text, JSON array string): Filter tags
- `album` (text, nullable): Portfolio collection/album name
- `createdAt`, `updatedAt` (ISO timestamps)


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

## 7. Cloudflare R2 Configuration via Vercel Environment Variables

The High-Performance Photo Gallery upload system utilizes browser-side Web Workers to resize photographs and uploads them directly to Cloudflare R2 via pre-signed S3 URLs.

To configure Cloudflare R2 in Vercel:

1. **Obtain Credentials from Cloudflare Dashboard**:
   - Go to **Cloudflare Dashboard** -> **R2** -> **Manage R2 API Tokens**.
   - Create an API Token with **Object Read & Write** permissions for your R2 bucket.
   - Note down the `Access Key ID`, `Secret Access Key`, and your Cloudflare `Account ID` (found in the R2 Overview sidebar).

2. **Add Environment Variables in Vercel**:
   In your Vercel Project Settings under **Settings** -> **Environment Variables**, add:

   | Variable | Example / Description |
   | --- | --- |
   | `R2_ACCOUNT_ID` | `abc123def4567890ghijkl` (Cloudflare Account ID) |
   | `R2_ACCESS_KEY_ID` | `1a2b3c4d5e6f7g8h9i0j` (R2 API Token Access Key) |
   | `R2_SECRET_ACCESS_KEY` | `9876543210fedcba` (R2 API Token Secret) |
   | `R2_BUCKET_NAME` | `gallery` (Name of your Cloudflare R2 bucket) |
   | `R2_PUBLIC_DOMAIN` | `https://media.yourdomain.com` or `https://pub-id.r2.dev` |

3. **CORS Configuration on R2 Bucket** (Required for Direct Browser Uploads):
   In Cloudflare R2 -> Select Bucket -> **Settings** -> **CORS Policy**, add:
   ```json
   [
     {
       "AllowedOrigins": ["https://your-cms.vercel.app", "http://localhost:3000"],
       "AllowedMethods": ["GET", "PUT", "HEAD"],
       "AllowedHeaders": ["*"],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

> 💡 **Local Development Fallback**: If R2 environment variables are omitted, the CMS automatically falls back to an authenticated local mock upload endpoint (`/api/gallery/local-upload`) so local testing works out of the box.

---

## 8. How to Run Commands & Tests

- **Development Server**: `npm run dev`
- **Build Verification**: `npm run build`
- **Execute Tests**: `npm run test`
- **Drizzle DB Push**: `npm run db:push`

