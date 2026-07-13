"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { saveMicroblog, deleteMicroblog, recalculateRelatedAction } from "./actions";
import { type Microblog } from "@/db/schema";
import { CloudinaryImageUploader } from "@/features/media/CloudinaryImageUploader";
import { Save, Eye, Trash2, Globe, FileEdit, Archive, Upload, Image as ImageIcon, RefreshCw, Loader2 } from "lucide-react";

interface MicroblogEditorProps {
  initialData?: Microblog | null;
  initialRelatedPosts?: any[];
}

function toDateTimeLocal(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function toIsoDateTime(value: string) {
  return value ? new Date(value).toISOString() : null;
}

export function MicroblogEditor({ initialData, initialRelatedPosts = [] }: MicroblogEditorProps) {
  const router = useRouter();
  const [id, setId] = useState<string | undefined>(initialData?.id);
  const [contentMarkdown, setContentMarkdown] = useState<string>(initialData?.contentMarkdown || "");
  const [slug, setSlug] = useState<string>(initialData?.slug || "");
  const [status, setStatus] = useState<"draft" | "published" | "scheduled" | "archived">(
    (initialData?.status as any) || "draft"
  );
  const [createdAt, setCreatedAt] = useState(toDateTimeLocal(initialData?.createdAt));
  const [publishedAt, setPublishedAt] = useState(toDateTimeLocal(initialData?.publishedAt));
  const [tags, setTags] = useState<string>(
    initialData?.tags ? JSON.parse(initialData.tags).join(", ") : ""
  );
  const [coverImageUrl, setCoverImageUrl] = useState<string>(initialData?.coverImageUrl || "");
  const [images, setImages] = useState<string[]>(
    initialData?.images ? JSON.parse(initialData.images) : []
  );
  const [relatedPosts, setRelatedPosts] = useState<any[]>(initialRelatedPosts);
  const [lastSavedState, setLastSavedState] = useState({
    contentMarkdown: initialData?.contentMarkdown || "",
    slug: initialData?.slug || "",
    tags: initialData?.tags ? JSON.parse(initialData.tags).join(", ") : "",
    coverImageUrl: initialData?.coverImageUrl || "",
    images: initialData?.images ? JSON.parse(initialData.images) : [],
    createdAt: toDateTimeLocal(initialData?.createdAt),
    publishedAt: toDateTimeLocal(initialData?.publishedAt),
  });
  const [lastAutosavedTime, setLastAutosavedTime] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savingAction, setSavingAction] = useState<"draft" | "published" | "delete" | null>(null);
  const [isRefreshingRelated, setIsRefreshingRelated] = useState(false);
  const [activeTab, setActiveTab] = useState<"write" | "preview">("write");
  const [showUploader, setShowUploader] = useState(false);

  // Character & Word counts
  const charCount = contentMarkdown.length;
  const wordCount = contentMarkdown.trim() ? contentMarkdown.trim().split(/\s+/).length : 0;

  const handleSubmit = async (targetStatus?: "draft" | "published" | "archived") => {
    const finalStatus = targetStatus || status;
    setIsSaving(true);
    setSavingAction(finalStatus === "published" ? "published" : "draft");
    try {
      const result = await saveMicroblog({
        id,
        slug,
        contentMarkdown,
        status: finalStatus,
        createdAt: toIsoDateTime(createdAt),
        publishedAt: toIsoDateTime(publishedAt),
        tags,
        coverImageUrl: coverImageUrl || null,
        images,
      });

      if (result.success) {
        setId(result.id);
        setLastSavedState({
          contentMarkdown,
          slug,
          tags,
          coverImageUrl,
          images,
          createdAt,
          publishedAt,
        });
        if (result.relatedPosts) {
          setRelatedPosts(result.relatedPosts);
        }
        if (!id) {
          router.push(`/microblog/${result.id}`);
        } else {
          router.refresh();
        }
      }
    } catch (err) {
      alert("Error saving microblog post.");
    } finally {
      setIsSaving(false);
      setSavingAction(null);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    if (!confirm("Are you sure you want to delete this microblog post?")) return;
    setIsSaving(true);
    setSavingAction("delete");
    try {
      await deleteMicroblog(id);
      router.push("/microblog");
    } finally {
      setIsSaving(false);
      setSavingAction(null);
    }
  };

  const handleImageUploaded = (url: string) => {
    setImages((prev) => [...prev, url]);
    if (!coverImageUrl) {
      setCoverImageUrl(url);
    }
  };

  const handleRefreshRelated = async () => {
    if (!id) {
      alert("Save the post first before refreshing related posts.");
      return;
    }
    setIsRefreshingRelated(true);
    try {
      const result = await recalculateRelatedAction(id, tags, contentMarkdown);
      if (result.success && result.relatedPosts) {
        setRelatedPosts(result.relatedPosts);
      } else {
        alert(result.error || "Failed to recalculate related posts.");
      }
    } catch (err) {
      alert("An error occurred while refreshing related posts.");
    } finally {
      setIsRefreshingRelated(false);
    }
  };

  const handleInsertMarkdown = (snippet: string) => {
    setContentMarkdown((prev) => (prev ? `${prev}\n\n${snippet}` : snippet));
  };

  // Autosave handler
  useEffect(() => {
    if (typeof window === "undefined") return;
    const autosaveEnabled = localStorage.getItem("cms_autosave_enabled") !== "false";
    if (!autosaveEnabled) return;

    const interval = setInterval(async () => {
      let changed = false;
      setLastSavedState((last) => {
        if (
          contentMarkdown !== last.contentMarkdown ||
          slug !== last.slug ||
          tags !== last.tags ||
          coverImageUrl !== last.coverImageUrl ||
          JSON.stringify(images) !== JSON.stringify(last.images) ||
          createdAt !== last.createdAt ||
          publishedAt !== last.publishedAt
        ) {
          changed = true;
        }
        return last;
      });

      if (!changed || isSaving) return;

      const autosaveStatus = status === "published" ? "published" : "draft";

      try {
        const result = await saveMicroblog({
          id,
          slug,
          contentMarkdown,
          status: autosaveStatus,
          createdAt: toIsoDateTime(createdAt),
          publishedAt: toIsoDateTime(publishedAt),
          tags,
          coverImageUrl: coverImageUrl || null,
          images,
        });

        if (result.success) {
          setId(result.id);
          setLastSavedState({
            contentMarkdown,
            slug,
            tags,
            coverImageUrl,
            images,
            createdAt,
            publishedAt,
          });
          setLastAutosavedTime(new Date().toLocaleTimeString());
          if (result.relatedPosts) {
            setRelatedPosts(result.relatedPosts);
          }
          if (!id) {
            router.replace(`/microblog/${result.id}`);
          }
        }
      } catch (err) {
        console.error("Autosave error:", err);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [contentMarkdown, slug, tags, coverImageUrl, images, createdAt, publishedAt, id, status, isSaving, router]);

  const [shortUrl, setShortUrl] = useState<string>(initialData?.shortUrl || "");
  const [shortSlugInput, setShortSlugInput] = useState<string>("");
  const [isShortening, setIsShortening] = useState(false);
  const [copiedShortUrl, setCopiedShortUrl] = useState(false);

  const handleGenerateShortUrl = async () => {
    setIsShortening(true);
    try {
      const { createShortLink } = await import("@/features/links/actions");
      const postTargetUrl = `${window.location.origin}/microblog/${slug || id || "post"}`;
      const res = await createShortLink({
        url: postTargetUrl,
        slug: shortSlugInput.trim() || undefined,
      });

      if (res.success && res.shortUrl) {
        setShortUrl(res.shortUrl);
        // Save shortUrl to microblog record in DB
        await saveMicroblog({
          id,
          slug,
          contentMarkdown,
          status,
          createdAt: toIsoDateTime(createdAt),
          publishedAt: toIsoDateTime(publishedAt),
          tags,
          coverImageUrl: coverImageUrl || null,
          shortUrl: res.shortUrl,
          images,
        });
      } else {
        alert(res.error || "Failed to generate short link via RapidLink.");
      }
    } catch (err: any) {
      alert("Error generating short link: " + (err.message || String(err)));
    } finally {
      setIsShortening(false);
    }
  };

  const handleCopyShortUrl = () => {
    if (!shortUrl) return;
    navigator.clipboard.writeText(shortUrl);
    setCopiedShortUrl(true);
    setTimeout(() => setCopiedShortUrl(false), 2000);
  };

  const handleDeleteShortUrl = async () => {
    if (!shortUrl) return;
    if (!confirm("Delete this short URL from RapidLink API?")) return;

    setIsShortening(true);
    try {
      const { deleteShortLink } = await import("@/features/links/actions");
      const urlSlug = shortUrl.split("/").filter(Boolean).pop();
      if (urlSlug) {
        await deleteShortLink(urlSlug);
      }

      setShortUrl("");
      setShortSlugInput("");

      await saveMicroblog({
        id,
        slug,
        contentMarkdown,
        status,
        createdAt: toIsoDateTime(createdAt),
        publishedAt: toIsoDateTime(publishedAt),
        tags,
        coverImageUrl: coverImageUrl || null,
        shortUrl: null,
        images,
      });
    } catch (err: any) {
      alert("Error deleting short URL: " + (err.message || String(err)));
    } finally {
      setIsShortening(false);
    }
  };

  // Settings Grid
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Editor Top Bar Actions */}
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <h1 className="page-title" style={{ margin: 0 }}>
            <FileEdit size={18} />
            {id ? "Edit Microblog" : "New Microblog"}
          </h1>
          {lastAutosavedTime && (
            <span style={{ fontSize: "11px", color: "var(--text-muted)", background: "var(--bg-sidebar)", padding: "2px 6px", borderRadius: "2px", border: "1px solid var(--border-color)" }}>
              Autosaved at {lastAutosavedTime}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          {id && (
            <button type="button" onClick={handleDelete} className="btn btn-danger btn-sm" disabled={isSaving}>
              {isSaving && savingAction === "delete" ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Trash2 size={14} />
              )}
              <span>{isSaving && savingAction === "delete" ? "Deleting..." : "Delete"}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => handleSubmit("draft")}
            className="btn btn-sm"
            disabled={isSaving}
          >
            {isSaving && savingAction === "draft" ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Save size={14} />
            )}
            <span>{isSaving && savingAction === "draft" ? "Saving..." : "Save Draft"}</span>
          </button>
          <button
            type="button"
            onClick={() => handleSubmit("published")}
            className="btn btn-primary btn-sm"
            disabled={isSaving}
          >
            {isSaving && savingAction === "published" ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Globe size={14} />
            )}
            <span>{isSaving && savingAction === "published" ? "Publishing..." : "Publish Post"}</span>
          </button>
        </div>
      </div>

      {/* Settings Grid */}
      <div className="editor-settings-grid">
        <div className="form-group">
          <label className="form-label">Slug (auto-generated if empty)</label>
          <input
            type="text"
            className="text-input"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="e.g. hello-world"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Status</label>
          <select
            className="select-input"
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="scheduled">Scheduled</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Created date and time</label>
          <input
            type="datetime-local"
            className="text-input"
            value={createdAt}
            onChange={(e) => setCreatedAt(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Published date and time</label>
          <input
            type="datetime-local"
            className="text-input"
            value={publishedAt}
            onChange={(e) => setPublishedAt(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Tags (comma-separated)</label>
          <input
            type="text"
            className="text-input"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="hugo, thoughts, dev"
          />
        </div>
      </div>

      {/* RapidLink Short URL Widget */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
          <label className="form-label" style={{ margin: 0, fontWeight: "bold", display: "flex", alignItems: "center", gap: "6px" }}>
            <Globe size={14} style={{ color: "var(--accent)" }} />
            <span>RapidLink Short URL</span>
          </label>

          {shortUrl && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "12px", fontFamily: "var(--font-mono)", color: "var(--accent)", fontWeight: "bold" }}>
                {shortUrl}
              </span>
              <button
                type="button"
                className="btn btn-sm"
                onClick={handleCopyShortUrl}
                style={{ padding: "2px 6px" }}
              >
                {copiedShortUrl ? <span style={{ color: "#2e7d32", fontSize: "11px" }}>Copied!</span> : "Copy"}
              </button>
              <button
                type="button"
                className="btn btn-sm btn-danger"
                onClick={handleDeleteShortUrl}
                disabled={isShortening}
                style={{ padding: "2px 6px" }}
                title="Delete short link from RapidLink API"
              >
                Delete Link
              </button>
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="text"
            className="text-input"
            style={{ flex: 1, minWidth: "180px" }}
            placeholder="Custom slug (optional)..."
            value={shortSlugInput}
            onChange={(e) => setShortSlugInput(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={handleGenerateShortUrl}
            disabled={isShortening}
            style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}
          >
            {isShortening ? <Loader2 size={12} className="animate-spin" /> : <Globe size={12} />}
            <span>{isShortening ? "Generating..." : shortUrl ? "Regenerate Short URL" : "Generate Short URL"}</span>
          </button>
        </div>
      </div>

      {/* Cover Image URL & Media Upload Controls */}
      <div style={{ background: "var(--bg-card)", padding: "12px", border: "1px solid var(--border-color)", display: "flex", flexDirection: "column", gap: "10px" }}>
        <div className="media-header">
          <label className="form-label" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <ImageIcon size={14} />
            <span>Cover Image URL & Media</span>
          </label>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setShowUploader(!showUploader)}
          >
            <Upload size={14} />
            <span>{showUploader ? "Hide Cloudinary Direct Uploader" : "Upload Image to Cloudinary"}</span>
          </button>
        </div>

        <div className="media-input-group">
          <input
            type="text"
            className="text-input"
            style={{ flex: 1, width: "100%" }}
            value={coverImageUrl}
            onChange={(e) => setCoverImageUrl(e.target.value)}
            placeholder="https://res.cloudinary.com/... or cover image URL"
          />
          {coverImageUrl && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", border: "1px solid var(--border-color)", padding: "2px 6px", flexShrink: 0 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={coverImageUrl} alt="Cover preview" style={{ width: "32px", height: "32px", objectFit: "cover" }} />
              <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Cover Preview</span>
            </div>
          )}
        </div>

        {/* Embedded Cloudinary Direct Upload Component */}
        {showUploader && (
          <CloudinaryImageUploader
            onImageUploaded={handleImageUploaded}
            onInsertMarkdown={handleInsertMarkdown}
          />
        )}
      </div>

      {/* Images Gallery */}
      <div style={{ background: "var(--bg-card)", padding: "12px", border: "1px solid var(--border-color)", display: "flex", flexDirection: "column", gap: "10px" }}>
        <label className="form-label" style={{ fontWeight: "bold" }}>
          Post Images Gallery ({images.length})
        </label>
        
        {images.length === 0 ? (
          <div style={{ color: "var(--text-muted)", fontSize: "12px", fontStyle: "italic" }}>
            No images attached to this post yet. Upload an image above to add it to the gallery.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "10px" }}>
            {images.map((url, idx) => {
              const isCover = coverImageUrl === url;
              return (
                <div
                  key={idx}
                  style={{
                    border: isCover ? "2px solid var(--accent)" : "1px solid var(--border-color)",
                    padding: "6px",
                    background: "var(--bg-sidebar)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    position: "relative",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`Gallery ${idx}`}
                    style={{ width: "100%", height: "80px", objectFit: "cover" }}
                  />
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", justifyContent: "space-between" }}>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => handleInsertMarkdown(`![image](${url})`)}
                      title="Insert into Markdown Editor"
                      style={{ padding: "2px 4px", fontSize: "10px", flex: 1, justifyContent: "center" }}
                    >
                      Insert
                    </button>
                    {!isCover && (
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={() => setCoverImageUrl(url)}
                        title="Set as Cover Image"
                        style={{ padding: "2px 4px", fontSize: "10px", flex: 1, justifyContent: "center" }}
                      >
                        Cover
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      onClick={() => setImages((prev) => prev.filter((_, i) => i !== idx))}
                      title="Remove from Gallery"
                      style={{ padding: "2px 4px", fontSize: "10px", width: "100%", justifyContent: "center" }}
                    >
                      Remove
                    </button>
                  </div>
                  {isCover && (
                    <span
                      style={{
                        position: "absolute",
                        top: "4px",
                        right: "4px",
                        background: "var(--accent)",
                        color: "var(--accent-text)",
                        fontSize: "8px",
                        fontWeight: "bold",
                        padding: "1px 4px",
                        borderRadius: "2px",
                      }}
                    >
                      COVER
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Related Posts */}
      <div style={{ background: "var(--bg-card)", padding: "12px", border: "1px solid var(--border-color)", display: "flex", flexDirection: "column", gap: "10px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: "bold", fontSize: "13px" }}>
            Related Posts ({relatedPosts.length})
          </div>
          {id && (
            <button
              type="button"
              className="btn btn-sm"
              onClick={handleRefreshRelated}
              disabled={isRefreshingRelated}
              style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 8px" }}
              title="Recalculate related posts based on current content and tags"
            >
              <RefreshCw size={12} style={{ animation: isRefreshingRelated ? "spin 1s linear infinite" : "none" }} />
              <span>{isRefreshingRelated ? "Refreshing..." : "Refresh"}</span>
            </button>
          )}
        </div>
        {relatedPosts.length === 0 ? (
          <div style={{ color: "var(--text-muted)", fontSize: "12px", fontStyle: "italic" }}>
            No related posts identified yet. (Links will build automatically based on shared keywords/tags when you save).
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {relatedPosts.map((post) => {
              const snippet = post.contentMarkdown.length > 80
                ? post.contentMarkdown.slice(0, 80) + "..."
                : post.contentMarkdown;
              return (
                <div
                  key={post.id}
                  style={{
                    background: "var(--bg-sidebar)",
                    border: "1px solid var(--border-color)",
                    padding: "8px 12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "12px",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px", flex: 1 }}>
                    <div style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-primary)" }}>
                      {snippet}
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                      /{post.slug} • Match Score: {post.score}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span className={`status-badge status-${post.status}`}>
                      {post.status}
                    </span>
                    <a
                      href={`/microblog/${post.id}`}
                      className="btn btn-sm"
                      title="Edit Related Post"
                    >
                      Edit
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Editor & Live Preview Switcher Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: "4px" }}>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === "write" ? "btn-primary" : ""}`}
            onClick={() => setActiveTab("write")}
          >
            <FileEdit size={14} /> Write
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === "preview" ? "btn-primary" : ""}`}
            onClick={() => setActiveTab("preview")}
          >
            <Eye size={14} /> Live Preview
          </button>
        </div>

        <div className="meta-stats">
          <span>Words: {wordCount}</span>
          <span>Chars: {charCount}</span>
        </div>
      </div>

      {/* Main Split / Toggle View */}
      <div className="editor-layout">
        <div className={`editor-pane ${activeTab !== "write" ? "hide-on-mobile-tab" : ""}`}>
          <textarea
            className="editor-textarea"
            placeholder="Write your microblog markdown here..."
            value={contentMarkdown}
            onChange={(e) => setContentMarkdown(e.target.value)}
          />
        </div>

        <div className={`preview-pane ${activeTab !== "preview" ? "hide-on-mobile-tab" : ""}`}>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "8px", textTransform: "uppercase", fontWeight: "bold" }}>
            Live Preview
          </div>
          {coverImageUrl && (
            <div style={{ marginBottom: "12px" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={coverImageUrl} alt="Cover" style={{ maxWidth: "100%", maxHeight: "200px", borderRadius: "2px" }} />
            </div>
          )}
          {contentMarkdown ? (
            <div style={{ whiteSpace: "pre-wrap", fontFamily: "var(--font-sans)", lineHeight: "1.6" }}>
              {contentMarkdown}
            </div>
          ) : (
            <em style={{ color: "var(--text-muted)" }}>Nothing to preview yet...</em>
          )}
        </div>
      </div>
      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
