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
- **UI & UX Highlights**: Responsive layouts, loading state spinners across all saving/publishing/deleting actions, Location metadata support (Name, Lat, Long) stored in Turso DB, public REST endpoints (`/api/microblogs`, `/api/gallery`), live active Gallery management, and real-time Cloudflare R2 storage usage & plan limits monitor on the Settings page.



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
│   │   │   ├── todos/           # Todo list and project management route
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
│   │   │   ├── todos/           # Todo CRUD actions and TodoDashboard UI
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
- `shortUrl` (text, nullable): RapidLink short URL generated for post
- `createdAt` (text, ISO timestamp)
- `updatedAt` (text, ISO timestamp)
- `publishedAt` (text, nullable ISO timestamp)
- Both `createdAt` and `publishedAt` can be adjusted in the Microblog editor using native browser `datetime-local` controls. Values are stored as ISO timestamps.

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
- `shortUrl` (text, nullable): RapidLink short URL generated for photo (especially useful for unlisted photos)
- `createdAt`, `updatedAt` (ISO timestamps)

### `links` (RapidLink URL Shortener)
- `slug` (text, primary key): Short URL path identifier (e.g. `my-link`)
- `url` (text, not null): Destination target URL
- `createdAt` (text, ISO timestamp)
- `clickCount` (integer, default `0`): Aggregated redirection clicks
- `hostname` (text, not null): Configured custom domain
- `password` (text, nullable): Optional bcrypt-hashed protection password

### `domains`
- `hostname` (text, primary key): Custom domain name (e.g. `lnk.to`)
- `addedAt` (text, ISO timestamp)

### `pastes` (Markdown Pastebin)
- `slug` (text, primary key): Unique paste path identifier (e.g. `p/abc123xyz`)
- `content` (text, not null): Markdown or plain text code content
- `hostname` (text, not null): Configured domain
- `password` (text, nullable): Optional bcrypt-hashed password
- `expiresAt` (text, nullable ISO timestamp): Automatic expiry timestamp
- `createdAt` (text, ISO timestamp)

### `projects` and `todos` (Personal task management)
- `projects`: `id`, unique `name`, optional `description`, and creation/update timestamps.
- `todos`: `id`, required `title`, optional `description` and `dueDate`, priority (`low`, `medium`, or `high`), `completed` integer flag, optional `projectId`, JSON-string `tags`, and creation/update timestamps.
- The Todo dashboard at `/todos` supports task creation/editing, completion, deletion, project creation/deletion, tag suggestions, and filtering by completion state, project, and tag. Its composer initially shows only the “What needs doing?” input and expands to show task options when text is entered. Deleting a project leaves its tasks intact but unassigned.

### Sync Center Tables (`providers`, `sync_logs`, Trakt & Last.fm tables)
- `providers`: `id` (slug primary key), `name`, `slug`, `enabled`, `connected`, `status` (`connected` | `disconnected` | `syncing` | `error` | `disabled`), `lastSync`, `lastSuccess`, `configurationJson`, `createdAt`, `updatedAt`.
- `sync_logs`: `id`, `provider`, `startedAt`, `finishedAt`, `duration`, `status` (`success` | `failed` | `in_progress` | `partial`), `itemsCreated`, `itemsUpdated`, `itemsDeleted`, `errorMessage`, `metadataJson`.
- `trakt_movies`: `traktId` (PK), `tmdbId`, `title`, `year`, `overview`, `runtime`, `rating`, `watchedAt`, `genres`, `posterPath`, `backdropPath`. Personal metadata preserved on sync: `favorite`, `notes`, `visibility`, `customTags`, `review`.
- `trakt_shows`: `traktId` (PK), `tmdbId`, `title`, `overview`, `status`, `year`, `posterPath`, `backdropPath`. Personal metadata preserved on sync: `favorite`, `notes`, `visibility`, `customTags`, `review`.
- `trakt_episodes`: `id` (PK `${showTraktId}_s${season}_e${ep}`), `showTraktId`, `episodeNumber`, `seasonNumber`, `title`, `watchedAt`, `rating`.
- `lastfm_scrobbles`: `id` (PK `${uts}_${artist}_${track}`), `lastfmId`, `artist`, `album`, `track`, `playedAt`, `mbid`, `createdAt`.
- `lastfm_artists`: `artistName` (PK), `playCount`, `lastPlayed`, `firstPlayed`. Personal metadata preserved: `favorite`, `notes`, `tags`, `hidden`, `review`.
- `lastfm_albums`: `id` (PK `${artist}:::${albumName}`), `albumName`, `artist`, `playCount`. Personal metadata preserved: `favorite`, `notes`, `tags`, `hidden`, `review`.
- `lastfm_tracks`: `id` (PK `${artist}:::${trackName}`), `trackName`, `artist`, `playCount`. Personal metadata preserved: `favorite`, `notes`, `tags`, `hidden`, `review`.

---

## 4. Auth & Middleware Design

- **Single Password**: Defined by `ADMIN_PASSWORD` env variable (fallback `admin123` in dev).
- **Session**: Enthralling JWT stored in `cms_session` HTTP-only cookie signed with `jose`.
- **Middleware**: Intercepts request paths except `/login`, public Hugo Content Adapter APIs (`/api/microblogs`, `/api/gallery`), and static assets. Redirects unauthorized requests to `/login`.

---

## 5. Sync Center Architecture (`src/features/sync/`)

The **Sync Center** (`/sync`) manages all external integrations through a provider-based abstraction model.

### Provider Interface (`ISyncProvider`)
All integrations implement `ISyncProvider` (inheriting from `BaseSyncProvider`):
- `connect(config)` & `disconnect()`
- `sync(options)` (supports `incremental`, `full`, and `batch` modes)
- `cancelSync()` (aborts active sync executions gracefully and updates audit log state)
- `getStatus()` & `getStatistics()`
- `validateConfiguration(config)` & `testConnection(config)`

### Provider Registry (`registry.ts`)
Providers self-register with `syncRegistry`. Adding a future provider (e.g. GitHub, Steam, Hevy, OpenLibrary) requires creating a provider class and registering it in `registry.ts`—no changes to core Sync Center UI or server actions are needed.

### Initial Integration Providers
1. **🎬 Trakt**: Configured via Trakt Username, Client ID, and Client Secret (obtained from trakt.tv/oauth/applications). Supports **Incremental Sync** (fetching watched summary lists) and **Batch History Backfill** (paginating historical watch activity pages). Uses `onConflictDoNothing()` to prevent duplicate constraint errors. Only stores TMDB relative image paths (`poster_path`, `backdrop_path`); never hosts posters on R2/Cloudinary. Preserves CMS-only personal metadata (`favorite`, `notes`, `visibility`, `customTags`, `review`).
2. **🎵 Last.fm**: Imports listening history, scrobbles, top artists, top albums, and top tracks. Uses in-memory duplicate tracking sets and Drizzle `onConflictDoNothing()` queries to guarantee zero `SQLITE_CONSTRAINT` unique primary key conflicts during high-volume batch history imports. To accommodate Vercel's 10-second serverless execution limits with large accounts (65k+ scrobbles), Last.fm supports **Incremental Sync** (fetching latest activity) and **Batch History Backfill** (paginated pagination window). Preserves CMS personal metadata (`favorite`, `notes`, `tags`, `hidden`, `review`).

---

## 6. Extensibility Guidelines for Future AI Agents

To add a new content type or provider:
1. **New Content Module**:
   - Database Schema in `src/db/schema.ts`
   - Feature folder in `src/features/[feature_name]/`
   - App Route in `src/app/(dashboard)/[feature_name]/page.tsx`
2. **New Sync Integration Provider**:
   - Create provider class in `src/features/sync/providers/[provider_slug]/index.ts` extending `BaseSyncProvider`
   - Register provider instance in `src/features/sync/registry.ts`

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

## 8. RapidLink URL Shortener & Pastebin Integration

The `/links` management tab in the CMS connects exclusively via HTTP REST API to your standalone `minimal-url-shortner` deployment.

To connect your deployed `minimal-url-shortner` instance, add these Environment Variables in Vercel:

| Variable | Description / Example |
| --- | --- |
| `RAPIDLINK_API_URL` | Base URL of your deployed shortener (e.g., `https://rapidlink.example.com`) |
| `RAPIDLINK_API_KEY` | Dashboard secret password configured as `DASHBOARD_PASSWORD` in your shortener app |

The CMS communicates with the following endpoints using `Authorization: Bearer <RAPIDLINK_API_KEY>` headers:
- `GET /api/links` / `POST /api/shorten` / `PUT /api/links` / `DELETE /api/links`
- `GET /api/pastes` / `POST /api/create-paste` / `DELETE /api/pastes`
- `GET /api/domains` / `POST /api/add-domain` / `DELETE /api/domains`

### Public Gallery Share Links (`/gallery/[slug]`)
- Clicking **"Shorten URL"** or **"Share"** in the Photo Gallery constructs the target public view URL (`https://admin.blackpiratex.com/gallery/[slug]`), shortens it via `RAPIDLINK_API_URL`, and automatically saves `shortUrl` to the CMS Turso DB (`gallery` table).
- The `/gallery/[slug]` route is configured as a public, unauthenticated viewer route in `src/middleware.ts`, displaying full high-res photographs, EXIF metadata, camera settings, and location details without requiring login.


---

## 9. How to Run Commands & Tests

- **Development Server**: `npm run dev`
- **Build Verification**: `npm run build`
- **Execute Tests**: `npm run test`
- **Drizzle DB Push**: `npm run db:push`

