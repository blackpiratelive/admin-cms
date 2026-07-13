# Personal CMS for Hugo + Turso

A dedicated, lightweight single-user Content Management System (CMS) designed specifically for managing content for a static Hugo website powered by Turso (libSQL) content adapters.

## Architecture & Principles

- **Single Source of Truth**: The CMS stores all structured content in Turso (libSQL).
- **Read-Only Hugo Site**: Hugo fetches published content directly from Turso at build time using Content Adapters.
- **Zero Generated Markdown/JSON**: The CMS never commits markdown files or writes static JSON to disk.
- **Vercel Deploy Hook**: Publishing a post automatically triggers a Vercel deploy hook to rebuild the Hugo website.
- **Single-User Power Interface**: Minimalist, fast, keyboard-friendly UI inspired by HackerNews aesthetics with theme customization options.

## Tech Stack

- **Framework**: Next.js 15 (App Router, Server Actions)
- **Language**: TypeScript (Strict mode)
- **Database / ORM**: Turso (libSQL) + Drizzle ORM
- **Authentication**: Single-password login with secure encrypted session cookies (`jose`)
- **Validation**: Zod + React Hook Form
- **Styling**: Utilitarian custom CSS with theme support (HN Orange, Dark Mode, Monochrome, Retro Teal)
- **Media Abstraction**: Extensible StorageProvider interface (Local, S3, R2, Vercel Blob)
- **Testing**: Vitest

## Environment Variables

Copy `.env.example` to `.env.local`:

```bash
TURSO_DATABASE_URL="file:local.db" # Or libsql://your-db-name.turso.io
TURSO_AUTH_TOKEN="your-turso-auth-token"
ADMIN_PASSWORD="your-secure-admin-password"
VERCEL_DEPLOY_HOOK="https://api.vercel.com/v1/integrations/deploy/..."
SESSION_SECRET="super-secret-at-least-32-characters-long"
```

## Local Development & Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Generate and apply database migrations**:
   ```bash
   npm run db:push
   ```

3. **Run the development server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` and login with your configured `ADMIN_PASSWORD`.

4. **Run Unit Tests**:
   ```bash
   npm run test
   ```

5. **Build for Production**:
   ```bash
   npm run build
   ```

## Project Navigation Structure

- **Dashboard**: Overview metrics and recent activity
- **Content**:
  - `Microblog`: Fully implemented (editor, status workflow, search, filtering)
  - `Blog`, `Notes`, `Pages`: Expansion placeholders
- **Tracking**:
  - `Books`, `Movies`, `TV Shows`, `Games`: Expansion placeholders
- **Media**:
  - `Gallery`, `Uploads`: Expansion placeholders
- **Collections**:
  - `Bookmarks`, `Quotes`, `Links`: Expansion placeholders
- **Settings**: Deployment & configuration placeholders
