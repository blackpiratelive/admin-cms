# Hugo Content Adapter Integration Guide for AI Agents

> **For AI Agents & Developers**: This document explains step-by-step how to configure the static Hugo website repository to consume published content directly from the `admin-cms` Turso (libSQL) database using Hugo Content Adapters.

---

## 1. Integration Architecture Overview

```text
 ┌──────────────────────────┐           ┌──────────────────────────┐
 │       admin-cms          │           │       Hugo Website       │
 │   (Writes to Turso)      │           │    (Content Adapter)     │
 └─────────────┬────────────┘           └────────────▲─────────────┘
               │                                     │
               │ Writes Data                         │ HTTP API Fetch
               ▼                                     │ (Build Time)
 ┌───────────────────────────────────────────────────┴─────────────┐
 │                    Turso (libSQL) Database                      │
 └─────────────────────────────────────────────────────────────────┘
```

- **CMS Role**: Writes microblogs and structured content into the Turso database.
- **Hugo Role**: Executes `content/_content.gotmpl` at build time, querying Turso's libSQL HTTP API (`/v2/pipeline`) for published posts (`status = 'published'`).
- **No Disk Writes**: Hugo generates page objects in memory during static site generation. Zero Markdown files are committed to Git.

---

## 2. Turso HTTP API Quick Reference

Turso databases expose an HTTP Pipeline endpoint:
- **Endpoint**: `https://<YOUR_TURSO_DATABASE_NAME>.turso.io/v2/pipeline`
- **Headers**:
  - `Authorization: Bearer <TURSO_AUTH_TOKEN>`
  - `Content-Type: application/json`
- **Method**: `POST`
- **Body Payload**:
```json
{
  "requests": [
    { "type": "execute", "stmt": { "sql": "SELECT id, slug, content_markdown, published_at, tags, cover_image_url FROM microblogs WHERE status = 'published' ORDER BY datetime(published_at) DESC" } },
    { "type": "close" }
  ]
}
```

---

## 3. Step-by-Step Hugo Website Setup Guide

### Step A: Configure Hugo Environment Variables

In your **Hugo website repository**, configure the environment variables or Hugo parameters:

```env
TURSO_DATABASE_URL="https://your-database-name.turso.io"
TURSO_AUTH_TOKEN="your-turso-auth-token"
```

In `hugo.toml` (or `config.toml`):
```toml
[params]
  turso_db_url = "https://your-database-name.turso.io"
```

---

### Step B: Create `content/_content.gotmpl` in Hugo Repository

Create the file `content/_content.gotmpl` inside your Hugo repository root or content directory. Hugo 0.126+ automatically executes `.gotmpl` files in `content/` as Content Adapters.

#### Complete `content/_content.gotmpl` Template Code:

```gotmpl
{{/* Fetch published microblog posts directly from Turso libSQL HTTP API */}}
{{ $dbUrl := getenv "TURSO_DATABASE_URL" | default site.Params.turso_db_url }}
{{ $token := getenv "TURSO_AUTH_TOKEN" }}
{{ $endpoint := printf "%s/v2/pipeline" (strings.TrimSuffix "/" $dbUrl) }}

{{ $query := dict "requests" (slice 
    (dict "type" "execute" "stmt" (dict "sql" "SELECT id, slug, content_markdown, published_at, tags, cover_image_url FROM microblogs WHERE status = 'published' ORDER BY datetime(published_at) DESC"))
    (dict "type" "close")
) }}

{{ $opts := dict
    "method" "post"
    "headers" (dict "Authorization" (printf "Bearer %s" $token) "Content-Type" "application/json")
    "body" ($query | jsonify)
}}

{{ with resources.GetRemote $endpoint $opts }}
  {{ with .Err }}
    {{ errorf "Failed to fetch content from Turso DB: %s" . }}
  {{ else }}
    {{ $json := .Content | transform.Unmarshal }}
    {{ $results := index $json.results 0 }}
    {{ $rows := $results.response.result.rows }}

    {{ range $rows }}
      {{/* Extract row columns: 0=id, 1=slug, 2=content_markdown, 3=published_at, 4=tags, 5=cover_image_url */}}
      {{ $id := index . 0 "value" }}
      {{ $slug := index . 1 "value" }}
      {{ $markdown := index . 2 "value" }}
      {{ $publishedAt := index . 3 "value" }}
      {{ $tagsRaw := index . 4 "value" }}
      {{ $coverImageUrl := index . 5 "value" }}

      {{/* Parse tags JSON string */}}
      {{ $tags := slice }}
      {{ with $tagsRaw }}
        {{ $tags = . | transform.Unmarshal }}
      {{ end }}

      {{ $pageData := dict
          "title" (printf "Microblog %s" (time.Format "2006-01-02" $publishedAt))
          "content" (dict "mediaType" "text/markdown" "value" $markdown)
          "date" (time.AsTime $publishedAt)
          "params" (dict "slug" $slug "tags" $tags "cover_image_url" $coverImageUrl "is_microblog" true)
      }}

      {{/* Construct Hugo Page under /microblog/<slug>/ */}}
      {{ $.AddPage $pageData (printf "microblog/%s.md" $slug) }}
    {{ end }}
  {{ end }}
{{ end }}
```

---

## 4. How Triggering Works on Content Publish

1. Power user clicks **Publish Post** or **Trigger Hugo Rebuild** in the CMS.
2. The CMS updates the row status to `'published'` in Turso and fires a POST request to `VERCEL_DEPLOY_HOOK`.
3. Vercel triggers a new build of the Hugo site.
4. Hugo executes `content/_content.gotmpl`, fetches the published microblogs via HTTP from Turso, and generates the updated static site.

---

## 5. Verification Checklist for AI Agents

When assisting with the Hugo integration, ensure:
1. `TURSO_AUTH_TOKEN` is set in Vercel/CI environment variables for the Hugo repository.
2. `hugo server` or `hugo --gc --minify` completes cleanly.
3. Microblog pages are accessible at `/microblog/<slug>/`.
