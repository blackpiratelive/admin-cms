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
 │   (Sole Data Source)     ◄───────────┤  (/api/microblogs/gallery)│
 └──────────────────────────┘           └──────────────────────────┘
```

- **CMS Role**: Writes microblogs, photo gallery entries, movies metadata, locations, and trips into the Turso database, and exposes them via public, read-only API endpoints.
- **Hugo Role**: Executes `content/_content.gotmpl` at build time, querying the Next.js CMS endpoints (`/api/microblogs`, `/api/gallery`, `/api/movies`) for published content.
- **No Disk Writes**: Hugo generates page objects in memory during static site generation. Zero Markdown files are committed to Git.

---

## 2. Next.js CMS REST API Quick Reference

- **Endpoints**:
  - `https://admin.blackpiratex.com/api/microblogs` (Microblogs with optional Location & Trip resolution)
  - `https://admin.blackpiratex.com/api/gallery` (Photo Gallery with EXIF, Location & Trip resolution)
  - `https://admin.blackpiratex.com/api/movies` (Movies metadata with reviews, rating, Location & Trip resolution)

### A. `/api/microblogs` Response Format:
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
        "https://media.yourdomain.com/image/upload/v123/sample.jpg"
      ],
      "relatedPosts": ["related-post-slug-1"],
      "locationId": "loc-uuid-123",
      "tripId": "trip-uuid-456",
      "location": {
        "id": "loc-uuid-123",
        "name": "Eiffel Tower",
        "city": "Paris",
        "country": "France",
        "latitude": 48.8584,
        "longitude": 2.2945
      },
      "trip": {
        "id": "trip-uuid-456",
        "title": "Summer Euro Tour 2026",
        "slug": "summer-euro-tour-2026",
        "status": "active"
      }
    }
  ]
}
```

### B. `/api/gallery` Response Format:
```json
{
  "photos": [
    {
      "id": "uuid-string",
      "title": "Sunrise at Puri Beach",
      "slug": "sunrise-at-puri-beach",
      "description": "Golden light rising over Puri sea beach",
      "originalUrl": "https://media.yourdomain.com/gallery/2026/07/sunrise-at-puri-beach/original.jpg",
      "largeUrl": "https://media.yourdomain.com/gallery/2026/07/sunrise-at-puri-beach/large.webp",
      "mediumUrl": "https://media.yourdomain.com/gallery/2026/07/sunrise-at-puri-beach/medium.webp",
      "thumbnailUrl": "https://media.yourdomain.com/gallery/2026/07/sunrise-at-puri-beach/thumb.webp",
      "width": 2560,
      "height": 1440,
      "camera": "Sony ILCE-7RM4",
      "lens": "FE 24-70mm F2.8 GM",
      "locationId": "loc-uuid-123",
      "tripId": "trip-uuid-456",
      "location": {
        "id": "loc-uuid-123",
        "name": "Puri Beach",
        "city": "Puri",
        "country": "India",
        "latitude": 19.8,
        "longitude": 85.8
      },
      "trip": {
        "id": "trip-uuid-456",
        "title": "Odisha Coastal Trail",
        "slug": "odisha-coastal-trail",
        "status": "completed"
      },
      "visibility": "public",
      "featured": true,
      "tags": ["landscape", "sunrise", "puri"],
      "album": "Travel 2026",
      "createdAt": "2026-07-13T22:00:00Z"
    }
  ]
}
```

### C. `/api/movies` Response Format:
```json
{
  "movies": [
    {
      "traktId": 550,
      "slug": "fight-club-1999",
      "title": "Fight Club",
      "year": 1999,
      "overview": "A ticking-time-bomb insomniac and a slippery soap salesman...",
      "posterPath": "/pB8BM7PDSp6B6Ih7QZ4DrQ3PmJK.jpg",
      "favorite": true,
      "personalRating": 9.5,
      "review": "A cinematic masterpiece exploring consumerism and identity.",
      "watchLocation": "Cineplex Theater",
      "locationId": "loc-uuid-789",
      "tripId": "trip-uuid-101",
      "location": {
        "id": "loc-uuid-789",
        "name": "Grand Cinema Hall",
        "city": "Mumbai",
        "country": "India"
      },
      "trip": null
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
      {{ $location := .location }}
      {{ $trip := .trip }}

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
              "location" $location
              "trip" $trip
              "is_microblog" true
          )
      }}

      {{/* Construct Hugo Page under /microblog/<slug>/ */}}
      {{ $.AddPage $pageData (printf "microblog/%s.md" $slug) }}
    {{ end }}
  {{ end }}
{{ end }}
```

#### Photo Gallery Adapter (`content/photos/_content.gotmpl`):

```gotmpl
{{/* Fetch public gallery photos directly from Next.js CMS API */}}
{{ $apiUrl := getenv "CMS_API_URL" | default site.Params.cms_api_url }}
{{ $endpoint := printf "%s/api/gallery" (strings.TrimSuffix "/" $apiUrl) }}

{{ with resources.GetRemote $endpoint }}
  {{ with .Err }}
    {{ errorf "Failed to fetch gallery photos from CMS API: %s" . }}
  {{ else }}
    {{ $json := .Content | transform.Unmarshal }}
    {{ $photos := $json.photos }}

    {{ range $photos }}
      {{ $slug := .slug }}
      {{ $pageData := dict
          "title" .title
          "description" .description
          "date" (time.AsTime .createdAt)
          "params" (dict
              "slug" $slug
              "original_url" .originalUrl
              "large_url" .largeUrl
              "medium_url" .mediumUrl
              "thumbnail_url" .thumbnailUrl
              "width" .width
              "height" .height
              "camera" .camera
              "lens" .lens
              "tags" .tags
              "album" .album
              "featured" .featured
              "location" .location
              "trip" .trip
          )
      }}

      {{/* Construct Hugo Page under /photos/<slug>/ */}}
      {{ $.AddPage $pageData (printf "photos/%s.md" $slug) }}
    {{ end }}
  {{ end }}
{{ end }}
```

---

## 4. Triggering Builds on Publish

1. Power user clicks **Publish Post** or **Trigger Hugo Rebuild** in the CMS.
2. The CMS updates the item status in Turso and fires a POST request to `VERCEL_DEPLOY_HOOK`.
3. Vercel triggers a new build of the Hugo site.
4. Hugo executes content adapters, fetching updated Microblogs, Gallery items, and Movies with their location/trip associations.
