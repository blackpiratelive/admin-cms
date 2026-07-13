# Hugo Content Adapter Integration Guide for AI Agents

> **For AI Agents & Developers**: This document explains step-by-step how to configure the static Hugo website repository to consume published content directly from the `admin-cms` REST API endpoints using Hugo Content Adapters.

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
 ┌──────────────────────────┐           ┌────────────┴─────────────┐
 │       Turso Database     │           │    CMS REST API Endpoint │
 │   (Sole Data Source)     ◄───────────┤     (/api/microblogs)    │
 └──────────────────────────┘           └──────────────────────────┘
```

- **CMS Role**: Writes microblogs and structured content into the Turso database, and exposes them via public, read-only API endpoints.
- **Hugo Role**: Executes `content/_content.gotmpl` at build time, querying the Next.js CMS endpoint (`/api/microblogs`) for published posts (`status = 'published'`).
- **No Disk Writes**: Hugo generates page objects in memory during static site generation. Zero Markdown files are committed to Git.

---

## 2. Next.js CMS REST API Quick Reference

The CMS exposes a public endpoint:
- **Endpoint**: `https://<YOUR_CMS_DOMAIN>/api/microblogs`
- **Method**: `GET`
- **Response Format**:
```json
{
  "posts": [
    {
      "id": "uuid-string",
      "slug": "post-slug",
      "contentMarkdown": "Raw Markdown content here...",
      "publishedAt": "2026-07-13T19:28:36.000Z",
      "tags": ["hugo", "nextjs", "drizzle"],
      "coverImageUrl": "https://media.yourdomain.com/image/upload/v123/sample.jpg",
      "images": [
        "https://media.yourdomain.com/image/upload/v123/sample.jpg",
        "https://media.yourdomain.com/image/upload/v124/sample2.jpg"
      ],
      "relatedPosts": ["related-post-slug-1", "related-post-slug-2"]
    }
  ]
}
```

---

## 3. Step-by-Step Hugo Website Setup Guide

### Step A: Configure Hugo Environment Variables

In your **Hugo website repository**, configure the environment variables or Hugo parameters:

```env
CMS_API_URL="https://your-cms-domain.vercel.app"
```

In `hugo.toml` (or `config.toml`):
```toml
[params]
  cms_api_url = "https://your-cms-domain.vercel.app"
```

---

### Step B: Create `content/_content.gotmpl` in Hugo Repository

Create the file `content/_content.gotmpl` inside your Hugo repository root or content directory. Hugo 0.126+ automatically executes `.gotmpl` files in `content/` as Content Adapters.

#### Complete `content/_content.gotmpl` Template Code:

```gotmpl
{{/* Fetch published microblog posts directly from Next.js CMS API */}}
{{ $apiUrl := getenv "CMS_API_URL" | default site.Params.cms_api_url }}
{{ $endpoint := printf "%s/api/microblogs" (strings.TrimSuffix "/" $apiUrl) }}

{{ with resources.GetRemote $endpoint }}
  {{ with .Err }}
    {{ errorf "Failed to fetch content from CMS API: %s" . }}
  {{ else }}
    {{ $json := .Content | transform.Unmarshal }}
    {{ $posts := $json.posts }}

    {{ range $posts }}
      {{ $id := .id }}
      {{ $slug := .slug }}
      {{ $markdown := .contentMarkdown }}
      {{ $publishedAt := .publishedAt }}
      {{ $tags := .tags }}
      {{ $coverImageUrl := .coverImageUrl }}
      {{ $images := .images }}
      {{ $relatedPosts := .relatedPosts }}

      {{ $pageData := dict
          "title" (printf "Microblog %s" (time.Format "2006-01-02" $publishedAt))
          "content" (dict "mediaType" "text/markdown" "value" $markdown)
          "date" (time.AsTime $publishedAt)
          "params" (dict 
              "slug" $slug 
              "tags" $tags 
              "cover_image_url" $coverImageUrl 
              "images" $images
              "related_posts" $relatedPosts
              "is_microblog" true
          )
      }}

      {{/* Construct Hugo Page under /microblog/<slug>/ */}}
      {{ $.AddPage $pageData (printf "microblog/%s.md" $slug) }}
    {{ end }}
  {{ end }}
{{ end }}
```

---

## 4. Rendering Images & Related Posts in Hugo Layouts

### A. Display Image Gallery (e.g. inside `layouts/partials/microblog-gallery.html`)
To display all attached images on the front-end Hugo site, add a range query in your Hugo post layout:

```html
{{ with .Params.images }}
  <div class="microblog-gallery">
    {{ range . }}
      <a href="{{ . }}" target="_blank" rel="noopener noreferrer">
        <img src="{{ . }}" alt="Post Image" class="gallery-thumbnail" style="max-width: 150px; margin: 5px; border-radius: 4px;" />
      </a>
    {{ end }}
  </div>
{{ end }}
```

### B. Display Related Links (e.g. inside `layouts/partials/microblog-related.html`)
To render the related links on the static pages:

```html
{{ with .Params.related_posts }}
  <div class="related-microblogs">
    <h4>Related Posts:</h4>
    <ul>
      {{ range . }}
        {{/* Find the Hugo page by its slug */}}
        {{ with site.GetPage (printf "microblog/%s" .) }}
          <li>
            <a href="{{ .Permalink }}">{{ .Date.Format "Jan 2, 2006" }} - {{ .Content | truncate 60 }}</a>
          </li>
        {{ end }}
      {{ end }}
    </ul>
  </div>
{{ end }}
```

---

## 5. How Triggering Works on Content Publish

1. Power user clicks **Publish Post** or **Trigger Hugo Rebuild** in the CMS.
2. The CMS updates the row status to `'published'` in Turso and fires a POST request to `VERCEL_DEPLOY_HOOK`.
3. Vercel triggers a new build of the Hugo site.
4. Hugo executes `content/_content.gotmpl`, fetches the published microblogs via HTTP from `/api/microblogs` API, and generates the updated static site.

---

## 6. Verification Checklist for AI Agents

When assisting with the Hugo integration, ensure:
1. `CMS_API_URL` is set in Vercel/CI environment variables for the Hugo repository.
2. `hugo server` or `hugo --gc --minify` completes cleanly.
3. Microblog pages are accessible at `/microblog/<slug>/`.
