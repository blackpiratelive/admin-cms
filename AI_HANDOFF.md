# AI Handoff & Personal Knowledge Platform Architecture Blueprint

> **Notice to Future AI Assistants**: Read this document first to immediately understand the repository structure, schema, conventions, and Personal Knowledge Platform (PKP) design philosophy without spending tokens parsing the entire codebase.
>
> 📖 **Hugo Integration**: For instructions on plugging Hugo Content Adapters to this CMS, read [HUGO_CONTENT_ADAPTER.md](file:///home/dog/git/admin-cms/HUGO_CONTENT_ADAPTER.md).

---

## 1. High-Level Summary

This repository is **`admin-cms`**, a private, single-user **Personal Knowledge Platform** built with Next.js App Router for managing, connecting, enriching, and publishing every aspect of digital life to a Hugo website via Turso (libSQL).

- **Strict Separation of Concerns**: Hugo site is read-only static; CMS is the sole writer to Turso. Provider data (Trakt, Last.fm) is owned by external providers, while CMS personal metadata (ratings, notes, tags, reviews, visibility) belongs exclusively to the CMS.
- **Entity-Driven Interconnected Architecture**: Reusable core entities (Locations, Trips, Projects, Persons, Tags, Collections) connected seamlessly via a generic Relationship Engine and Attachment System without redundant join tables.
- **Workflow**: Create/Edit Post or Media -> Save to Turso -> Status set to `published` -> Trigger `VERCEL_DEPLOY_HOOK` -> Hugo site rebuilds automatically.
- **UI & UX Highlights**: Keyboard-first Command Palette (`Ctrl+K`) for global fuzzy search across all entities and quick actions, central Settings Hub (`/settings`), Locations (`/locations`) & Trips (`/trips`) management, real-time R2 usage monitors, and responsive themes.

---

## 2. Key Directories & Code Structure

```text
admin-cms/
├── src/
│   ├── app/
│   │   ├── (auth)/login/        # Password login page
│   │   ├── (dashboard)/         # Protected dashboard layout & routes
│   │   │   ├── page.tsx         # Control center overview with modular widgets
│   │   │   ├── microblog/       # Microblog list & CRUD editor routes
│   │   │   ├── todos/           # Todo list & Project management route
│   │   │   ├── locations/       # Reusable geographical locations entity page
│   │   │   ├── trips/           # Travel itineraries and trip grouping route
│   │   │   ├── settings/        # Centralized Settings Hub (General, Storage, Providers, etc.)
│   │   │   ├── libraries/       # Personal Media Libraries (Movies, TV, Music, Collections)
│   │   │   └── sync/            # Sync Center integration hub
│   │   ├── globals.css          # Design tokens, themes (HN Orange, Dark, Mono, Teal)
│   │   └── layout.tsx           # Root layout & ThemeProvider
│   ├── components/              # Shared UI (Header, Sidebar, CommandPalette, DeployWidget)
│   ├── db/
│   │   ├── schema.ts            # Drizzle table schemas for all entities and providers
│   │   └── index.ts             # Turso / libSQL client & auto-initializer DDL
│   ├── features/
│   │   ├── activity/            # Universal Activity Engine logging & timeline
│   │   ├── relationships/       # Generic Relationship Engine (connects any two entities)
│   │   ├── attachments/         # Reusable Attachment System for media & files
│   │   ├── jobs/                # Background Job Queue Engine (queued, running, completed)
│   │   ├── search/              # Universal fuzzy multi-table search engine
│   │   ├── locations/           # Location CRUD actions & metadata handlers
│   │   ├── trips/               # Trip management server actions
│   │   ├── auth/                # Session cookies, password check, login server actions
│   │   ├── microblog/           # Microblog actions, Zod validation, Editor & List
   │   ├── libraries/           # Personal media libraries & metadata preservation
│   │   └── sync/                # Extensible Provider integration registry
│   ├── lib/
│   │   ├── event-bus.ts         # Internal event pub-sub bus
│   │   └── deploy-hook.ts       # Vercel deploy hook caller
│   └── middleware.ts            # Next.js route protection middleware
├── tests/                       # Vitest unit test suite
├── HUGO_CONTENT_ADAPTER.md      # Step-by-step Hugo Content Adapter setup guide
├── arch.txt                     # Architecture Evolution Plan
└── drizzle.config.ts            # Drizzle kit configuration
```

---

## 3. Database Schema (`src/db/schema.ts`)

### `locations`
- `id` (text, primary key): `loc_${timestamp}_${rand}`
- `name` (text, not null), `slug` (text, unique, not null)
- `country`, `state`, `city`, `latitude`, `longitude`, `elevation`, `timezone`
- `firstVisited`, `lastVisited` (ISO timestamp strings), `visitCount` (integer, default 1)
- `privateNotes`, `publicDescription`, `tags` (JSON string array)
- `visibility` (`public` | `private` | `unlisted`), `favorite` (0 or 1)
- `photographyNotes`, `parkingNotes`, `walkingDifficulty`, `weatherNotes`, `bestSeason`, `bestTimeOfDay`, `cameraRecommendations`, `personalRating`

### `trips`
- `id` (text, primary key): `trip_${timestamp}_${rand}`
- `title` (text, not null), `slug` (text, unique, not null), `description`
- `startDate`, `endDate` (date strings)
- `status` (`planned` | `ongoing` | `completed` | `cancelled`)
- `visibility` (`public` | `private` | `unlisted`), `favorite` (0 or 1), `tags` (JSON string array)

### `relationships` (Generic Relationship Engine)
- `id` (text, primary key): `rel_${timestamp}_${rand}`
- `sourceType` (text, e.g. `photo`, `movie`, `microblog`)
- `sourceId` (text)
- `targetType` (text, e.g. `location`, `project`, `trip`)
- `targetId` (text)
- `relationship` (text, e.g. `taken_at`, `watched_at`, `belongs_to`, `mentions`, `contains`, `references`)

### `attachments` (Reusable Media Attachment System)
- `id` (text, primary key): `att_${timestamp}_${rand}`
- `entityType` (text), `entityId` (text)
- `kind` (text: `screenshot` | `poster` | `cover` | `hero` | `gallery_ref` | `video` | `pdf` | `file`)
- `url` (text, not null), `mime`, `width`, `height`, `metadataJson`

### `jobs` (Background Task Queue)
- `id` (text, primary key): `job_${timestamp}_${rand}`
- `type` (text: `sync_provider` | `image_processing` | `search_indexing` | `deploy_site`)
- `payloadJson`, `status` (`queued` | `running` | `completed` | `failed` | `cancelled`)
- `progress` (0-100), `errorMessage`, `resultJson`, `attempts`, `maxAttempts`

### `projects` and `todos`
- `projects`: `id`, unique `name`, `slug`, `description`, `repositoryUrl`, `websiteUrl`, `status` (`active` | `completed` | `archived` | `on_hold` | `planned`), `technologies` (JSON array), `startDate`, `completedDate`, `visibility` (`public` | `private` | `unlisted`).
- `todos`: `id`, required `title`, optional `description` and `dueDate`, priority (`low` | `medium` | `high`), `completed` flag, `projectId`, JSON-string `tags`.

### Core Content Tables & Relationships
- `microblogs`: `id`, `slug`, `contentMarkdown`, `status`, `tags`, `coverImageUrl`, `images`, `shortUrl`, `locationId`, `tripId`, `createdAt`, `updatedAt`, `publishedAt`.
- `gallery`: `id`, `title`, `slug`, `description`, `originalUrl`, `largeUrl`, `mediumUrl`, `thumbnailUrl`, `width`, `height`, `fileSize`, `mimeType`, `camera`, `lens`, `focalLength`, `aperture`, `shutterSpeed`, `iso`, `takenAt`, `latitude`, `longitude`, `locationName`, `locationId`, `tripId`, `visibility`, `featured`, `tags`, `album`, `shortUrl`.
- `movieMetadata`: `traktId`, `favorite`, `personalRating`, `review`, `notes`, `tags`, `visibility`, `featured`, `watchedWith`, `watchLocation`, `locationId`, `tripId`, `relatedPhotos`, `relatedMicroblogs`.
- **Public REST Content Adapter Endpoints**:
  - `/api/microblogs`: Serves published microblogs with resolved `location` and `trip` objects.
  - `/api/gallery`: Serves public gallery photos with resolved EXIF, `location` and `trip` objects.
  - `/api/movies`: Serves public movies with ratings, reviews, `location` and `trip` objects.

---

## 4. Universal Search & Command Palette (`Ctrl+K`)

- Accessible via the top header or keyboard shortcut `Ctrl+K`.
- Executes fuzzy multi-table searches across Microblogs, Gallery, Movies, TV Shows, Music, Projects, Locations, Trips, Collections, Notes, Bookmarks, Quotes.
- Offers instant Quick Actions: Create Microblog, Upload Photos, Open Locations, Create Project/Task, Sync Providers, System Settings.

---

## 5. Event Bus & Activity Stream Architecture

- **Internal Event Bus** (`src/lib/event-bus.ts`): Allows modules to publish system events (`entity.created`, `photo.uploaded`, `sync.completed`, etc.) without hard coupling dependencies.
- **Universal Activity Log** (`src/features/activity/`): Logs user and system activity events automatically for dashboard widgets, timeline feeds, and audit trails.

---

## 6. How to Run Commands & Tests

- **Development Server**: `npm run dev`
- **Build Verification**: `npm run build`
- **Execute Tests**: `npm run test`
- **Type Check**: `npx tsc --noEmit`
- **Drizzle DB Schema Push**: `npm run db:push`


