# Feature: End-to-End Encrypted Journal Image System

## Objective

Implement a complete image management system for the **Journal module**.

The Journal is end-to-end encrypted and already uses the **DEK/KEK encryption architecture**.

Every image associated with the Journal must also be end-to-end encrypted using the Journal DEK before leaving the browser.

The server, database and Cloudinary must never receive plaintext images.

The Journal supports **two completely different image types**.

These must be implemented as separate concepts with different UX and behaviour.

---

# Image Types

## 1. Inline Images (Inside Lexical)

These images are embedded inside the document flow.

Example:

```
Today I visited Darjeeling.

[ Inline Image ]

The sunrise was incredible.

[ Inline Image ]

We drove back after lunch.
```

Inline images are part of the writing experience.

They should behave similarly to:

* Notion
* Apple Notes
* Obsidian
* Google Docs

---

## 2. Journal Attachments

Attachments are independent from the document.

Example:

```
Journal Entry

↓

Attachments

• DSC001.jpg

• IMG_4212.jpg

• Voice Memo

• Receipt.pdf
```

Attachments are not rendered inside the Lexical document.

They belong to the journal entry itself.

Attachments should appear in a dedicated "Attachments" section below the editor.

Attachments support:

* Images
* Videos (future)
* Audio (future)
* PDFs (future)
* Documents (future)

Only image support is required now.

---

# Storage Backend

Use Cloudinary.

Do NOT use Cloudflare R2.

Cloudinary is only an encrypted blob store.

Cloudinary transformations must NOT be used.

Cloudinary never receives readable images.

---

# Upload Pipeline

Both inline images and attachments use the exact same upload pipeline.

```
User selects image

↓

Browser

↓

Read File

↓

Strip EXIF

↓

Compress

↓

Generate Thumbnail

↓

Encrypt Original (DEK)

↓

Encrypt Thumbnail (DEK)

↓

Upload both encrypted files

↓

Cloudinary

↓

Create Asset Record

↓

Return Asset ID
```

Only the UI behaviour differs.

---

# Browser Processing

Everything below happens locally.

## Read

Read the selected file as an ArrayBuffer.

Never upload the original file.

---

## EXIF Removal

Before encryption:

Strip all metadata.

Remove:

* GPS
* Orientation
* Camera serial number
* Embedded thumbnail
* Copyright
* Author
* Comments
* Maker Notes
* All unnecessary EXIF

Optionally extract camera information before removal.

Store only useful metadata:

* Camera Model
* Lens
* ISO
* Aperture
* Shutter Speed
* Focal Length

GPS should NOT be retained.

---

## Compression

Compress before encryption.

Never compress encrypted data.

Recommended quality:

JPEG

90–95%

WebP

90%

Maintain original dimensions.

Do not unnecessarily resize the original.

---

## Thumbnail Generation

Generate a thumbnail in the browser.

Longest side:

512px

Maintain aspect ratio.

Compress thumbnail.

Quality:

85–90%

---

# Encryption

Encrypt original and thumbnail independently.

Use:

AES-256-GCM

Encryption key:

Journal DEK

Generate a unique IV for every encrypted object.

Never reuse IVs.

Objects:

```
Original

↓

Encrypt

↓

original.enc
```

```
Thumbnail

↓

Encrypt

↓

thumbnail.enc
```

---

# Upload

Upload both encrypted blobs to Cloudinary.

Cloudinary stores opaque binary objects only.

No image transformations.

No resizing.

No optimization.

No public previews.

---

# Database

Create a reusable journal asset system.

```
journal_assets

id

asset_type

mime_type

width

height

original_size

compressed_size

thumbnail_size

cloudinary_original_public_id

cloudinary_thumbnail_public_id

original_iv

thumbnail_iv

encryption_version

created_at

updated_at
```

Do NOT store:

plaintext filename

captions

descriptions

EXIF blob

private notes

Captions belong inside encrypted Lexical content.

---

# Inline Images

Implement a custom Lexical node.

```
JournalImageNode
```

Do NOT use normal ImageNode.

---

# JournalImageNode

Store only:

```
assetId

width

height

alignment

caption

displayMode
```

Do NOT store Cloudinary URLs.

Do NOT store decrypted image data.

The assetId resolves the image.

---

# Insert Image

Support all insertion methods.

Toolbar

Slash command

Drag & Drop

Clipboard Paste

File Picker

Context Menu

---

# Upload Behaviour

Uploading must be asynchronous.

The editor should never freeze.

Immediately insert a placeholder node.

```
Uploading...

↓

Spinner

↓

Progress

↓

Completed

↓

Real Image Node
```

The user should continue typing while uploads occur.

---

# Image Editing

Support:

Resize

Alignment

Left

Center

Right

Full Width

Caption

Replace Image

Delete Image

Copy

Cut

Paste

Drag Reorder

Keyboard Selection

---

# Rendering

Rendering pipeline:

```
JournalImageNode

↓

assetId

↓

Download encrypted thumbnail

↓

Decrypt

↓

Blob

↓

createObjectURL()

↓

Render
```

Clicking image:

```
Download encrypted original

↓

Decrypt

↓

Fullscreen Lightbox
```

---

# Lazy Loading

Do not decrypt every image immediately.

Use IntersectionObserver.

Only decrypt visible images.

When image leaves viewport:

Optionally revoke Blob URL.

---

# Attachments

Attachments use the same encrypted asset pipeline.

Difference:

They are NOT inserted into Lexical.

Instead:

```
Journal Entry

↓

Attachment Gallery
```

Support:

Grid View

List View

Preview

Download

Delete

Reorder

Future:

Videos

PDFs

Audio

---

# Attachment Viewer

Images should open in:

Fullscreen Lightbox

Support:

Zoom

Pan

Keyboard Navigation

Previous

Next

Download

Close

---

# Upload Queue

Support multiple uploads.

Each upload has its own progress.

```
Image 1

██████████

Complete

Image 2

██████░░░░

Uploading

Image 3

Waiting
```

---

# Performance

Move expensive operations into Web Workers.

Run inside workers:

Compression

Thumbnail Generation

EXIF Removal

Encryption

Hash Calculation (if implemented)

The editor must remain responsive.

---

# Memory Management

Process images sequentially.

Pipeline:

Read

↓

Process

↓

Encrypt

↓

Upload

↓

Release Memory

↓

Next Image

Revoke Blob URLs after use.

Destroy temporary buffers.

---

# Error Handling

Handle:

Compression failure

Encryption failure

Cloudinary upload failure

Worker failure

Network timeout

Cancelled upload

Retry failed uploads.

Never lose editor state.

---

# Security

Never upload plaintext.

Never upload unencrypted thumbnails.

Never store decrypted images.

Never log binary image data.

Never log encryption keys.

Never expose Cloudinary URLs directly in the editor.

Destroy decrypted blobs after viewing.

Destroy temporary encryption buffers.

---

# Future Compatibility

The asset system should support future encrypted assets.

Design the architecture for:

Videos

Audio

Voice Notes

PDFs

Documents

Only preprocessing changes.

Encryption remains identical.

---

# Deliverables

Implement:

* Reusable encrypted Journal Asset Manager
* Browser-side image pipeline
* EXIF removal
* Compression
* Thumbnail generation
* AES-256-GCM encryption using the Journal DEK
* Cloudinary upload
* Journal Asset database model
* Custom `JournalImageNode` for Lexical
* Inline image uploads
* Journal attachments
* Async placeholder uploads
* Progress indicators
* Lazy loading
* Browser-side decryption
* Fullscreen lightbox
* Image resize and alignment
* Clipboard image paste
* Drag-and-drop upload
* Web Worker processing
* Secure memory cleanup
* Future-ready encrypted asset architecture

The final implementation should provide a writing experience comparable to Notion or Apple Notes while ensuring that every Journal image remains fully end-to-end encrypted and unreadable to the server, Cloudinary, or any intermediary.
