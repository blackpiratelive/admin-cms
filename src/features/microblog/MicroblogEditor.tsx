"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { saveMicroblog, deleteMicroblog, recalculateRelatedAction } from "./actions";
import { getLocations } from "@/features/locations/actions";
import { getTrips } from "@/features/trips/actions";
import { type LocationRecord, type TripRecord, type Microblog } from "@/db/schema";
import { CloudinaryImageUploader } from "@/features/media/CloudinaryImageUploader";
import {
  Save,
  Eye,
  Trash2,
  Globe,
  FileEdit,
  Upload,
  Image as ImageIcon,
  RefreshCw,
  Loader2,
  MapPin,
  Compass,
  Sliders,
  ChevronDown,
  ChevronUp,
  Link as LinkIcon,
  Tag,
  Calendar,
  Layers,
  Check,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Play,
} from "lucide-react";

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
  const [locationId, setLocationId] = useState<string>(initialData?.locationId || "");
  const [tripId, setTripId] = useState<string>(initialData?.tripId || "");
  const [locationsList, setLocationsList] = useState<LocationRecord[]>([]);
  const [tripsList, setTripsList] = useState<TripRecord[]>([]);
  const [isLoadingEntities, setIsLoadingEntities] = useState(true);
  const [images, setImages] = useState<string[]>(
    initialData?.images ? JSON.parse(initialData.images) : []
  );

  // Collapsible Sections State (Defaults to collapsed so the editor is immediately visible)
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [openSection, setOpenSection] = useState<"metadata" | "media" | "shortlink" | "related" | null>("metadata");

  useEffect(() => {
    async function loadEntities() {
      setIsLoadingEntities(true);
      try {
        const [locs, trps] = await Promise.all([getLocations(), getTrips()]);
        setLocationsList(locs);
        setTripsList(trps);
      } catch (err) {
        console.error("Failed to load locations or trips:", err);
      } finally {
        setIsLoadingEntities(false);
      }
    }
    loadEntities();
  }, []);

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

  // RapidLink state
  const [shortUrl, setShortUrl] = useState<string>(initialData?.shortUrl || "");
  const [shortSlugInput, setShortSlugInput] = useState<string>("");
  const [isShortening, setIsShortening] = useState(false);
  const [copiedShortUrl, setCopiedShortUrl] = useState(false);

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
        locationId: locationId || null,
        tripId: tripId || null,
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
          locationId: locationId || null,
          tripId: tripId || null,
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
  }, [contentMarkdown, slug, tags, coverImageUrl, images, createdAt, publishedAt, id, status, isSaving, router, locationId, tripId]);

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
        await saveMicroblog({
          id,
          slug,
          contentMarkdown,
          status,
          createdAt: toIsoDateTime(createdAt),
          publishedAt: toIsoDateTime(publishedAt),
          tags,
          coverImageUrl: coverImageUrl || null,
          locationId: locationId || null,
          tripId: tripId || null,
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
        locationId: locationId || null,
        tripId: tripId || null,
        shortUrl: null,
        images,
      });
    } catch (err: any) {
      alert("Error deleting short URL: " + (err.message || String(err)));
    } finally {
      setIsShortening(false);
    }
  };

  const selectedLocation = locationsList.find((l) => l.id === locationId);
  const selectedTrip = tripsList.find((t) => t.id === tripId);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxWidth: "1400px", margin: "0 auto", width: "100%" }}>
      {/* 1. Top Action & Navigation Header */}
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-color)",
          borderRadius: "6px",
          padding: "12px 16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <h1 style={{ fontSize: "18px", fontWeight: "bold", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
            <FileEdit size={18} style={{ color: "var(--accent)" }} />
            <span>{id ? "Edit Microblog" : "New Microblog"}</span>
          </h1>

          <span className={`status-badge status-${status}`} style={{ fontSize: "11px", textTransform: "capitalize" }}>
            {status}
          </span>

          {lastAutosavedTime && (
            <span
              style={{
                fontSize: "11px",
                color: "var(--text-muted)",
                background: "var(--bg-sidebar)",
                padding: "2px 8px",
                borderRadius: "4px",
                border: "1px solid var(--border-color)",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <Check size={12} style={{ color: "#2e7d32" }} />
              Autosaved {lastAutosavedTime}
            </span>
          )}
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
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
            className="btn btn-sm btn-secondary"
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

      {/* 2. Sleek Collapsible Post Options & Metadata Bar */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "6px", overflow: "hidden" }}>
        {/* Toggle Bar Header */}
        <button
          type="button"
          onClick={() => setShowSettingsPanel(!showSettingsPanel)}
          style={{
            width: "100%",
            padding: "12px 16px",
            background: "var(--bg-sidebar)",
            border: "none",
            borderBottom: showSettingsPanel ? "1px solid var(--border-color)" : "none",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <Sliders size={16} style={{ color: "var(--accent)" }} />
            <span style={{ fontWeight: 600, fontSize: "13px", color: "var(--text-primary)" }}>
              Post Metadata & Extra Settings
            </span>

            {/* Quick summary pills when collapsed */}
            {!showSettingsPanel && (
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                {slug && (
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", background: "var(--bg-card)", padding: "1px 6px", borderRadius: "3px", border: "1px solid var(--border-color)" }}>
                    /{slug}
                  </span>
                )}
                {selectedLocation && (
                  <span style={{ fontSize: "11px", color: "var(--accent)", background: "var(--bg-card)", padding: "1px 6px", borderRadius: "3px", border: "1px solid var(--border-color)", display: "inline-flex", alignItems: "center", gap: "3px" }}>
                    <MapPin size={10} /> {selectedLocation.name}
                  </span>
                )}
                {selectedTrip && (
                  <span style={{ fontSize: "11px", color: "var(--text-secondary)", background: "var(--bg-card)", padding: "1px 6px", borderRadius: "3px", border: "1px solid var(--border-color)", display: "inline-flex", alignItems: "center", gap: "3px" }}>
                    <Compass size={10} /> {selectedTrip.title}
                  </span>
                )}
                {images.length > 0 && (
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", background: "var(--bg-card)", padding: "1px 6px", borderRadius: "3px", border: "1px solid var(--border-color)" }}>
                    🖼️ {images.length} media
                  </span>
                )}
              </div>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--text-muted)" }}>
            <span>{showSettingsPanel ? "Collapse Settings" : "Configure Settings"}</span>
            {showSettingsPanel ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </button>

        {/* Expanded Collapsible Panel with Sub-Tabs */}
        {showSettingsPanel && (
          <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Section Tab Buttons */}
            <div style={{ display: "flex", gap: "6px", borderBottom: "1px solid var(--border-color)", paddingBottom: "10px", flexWrap: "wrap" }}>
              <button
                type="button"
                className={`btn btn-sm ${openSection === "metadata" ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setOpenSection("metadata")}
                style={{ fontSize: "12px", gap: "4px" }}
              >
                <Sliders size={13} /> General & Locations
              </button>

              <button
                type="button"
                className={`btn btn-sm ${openSection === "media" ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setOpenSection("media")}
                style={{ fontSize: "12px", gap: "4px" }}
              >
                <ImageIcon size={13} /> Cover & Media ({images.length})
              </button>

              <button
                type="button"
                className={`btn btn-sm ${openSection === "shortlink" ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setOpenSection("shortlink")}
                style={{ fontSize: "12px", gap: "4px" }}
              >
                <Globe size={13} /> RapidLink Short URL
              </button>

              <button
                type="button"
                className={`btn btn-sm ${openSection === "related" ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setOpenSection("related")}
                style={{ fontSize: "12px", gap: "4px" }}
              >
                <LinkIcon size={13} /> Related Posts ({relatedPosts.length})
              </button>
            </div>

            {/* Section 1: General Metadata, Slug, Status, Dates, Locations */}
            {openSection === "metadata" && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" }}>
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
                  <label className="form-label" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <MapPin size={13} style={{ color: "var(--accent)" }} />
                    <span>Associated Location</span>
                    {isLoadingEntities && <Loader2 size={12} className="animate-spin" />}
                  </label>
                  <select
                    className="select-input"
                    value={locationId}
                    onChange={(e) => setLocationId(e.target.value)}
                  >
                    <option value="">-- None (No Location) --</option>
                    {locationsList.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name} {[loc.city, loc.country].filter(Boolean).length ? `(${[loc.city, loc.country].filter(Boolean).join(", ")})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Compass size={13} style={{ color: "var(--accent)" }} />
                    <span>Associated Trip</span>
                    {isLoadingEntities && <Loader2 size={12} className="animate-spin" />}
                  </label>
                  <select
                    className="select-input"
                    value={tripId}
                    onChange={(e) => setTripId(e.target.value)}
                  >
                    <option value="">-- None (No Trip) --</option>
                    {tripsList.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title} ({t.status})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Created Date & Time</label>
                  <input
                    type="datetime-local"
                    className="text-input"
                    value={createdAt}
                    onChange={(e) => setCreatedAt(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Published Date & Time</label>
                  <input
                    type="datetime-local"
                    className="text-input"
                    value={publishedAt}
                    onChange={(e) => setPublishedAt(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ gridColumn: "1 / -1" }}>
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
            )}

            {/* Section 2: Media & Cover Image */}
            {openSection === "media" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{ background: "var(--bg-sidebar)", padding: "12px", border: "1px solid var(--border-color)", borderRadius: "4px", display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                    <label className="form-label" style={{ margin: 0, display: "flex", alignItems: "center", gap: "6px" }}>
                      <ImageIcon size={14} style={{ color: "var(--accent)" }} />
                      <span>Cover Image URL & Media Uploader</span>
                    </label>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      onClick={() => setShowUploader(!showUploader)}
                    >
                      <Upload size={14} />
                      <span>{showUploader ? "Hide Cloudinary Uploader" : "Upload Image to Cloudinary"}</span>
                    </button>
                  </div>

                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <input
                      type="text"
                      className="text-input"
                      style={{ flex: 1 }}
                      value={coverImageUrl}
                      onChange={(e) => setCoverImageUrl(e.target.value)}
                      placeholder="https://res.cloudinary.com/... or cover image URL"
                    />
                    {coverImageUrl && (
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", border: "1px solid var(--border-color)", padding: "2px 6px", borderRadius: "3px" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={coverImageUrl} alt="Cover preview" style={{ width: "32px", height: "32px", objectFit: "cover" }} />
                        <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Cover</span>
                      </div>
                    )}
                  </div>

                  {showUploader && (
                    <CloudinaryImageUploader
                      onImageUploaded={handleImageUploaded}
                      onInsertMarkdown={handleInsertMarkdown}
                    />
                  )}
                </div>

                {/* Attached Images Grid */}
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <label className="form-label" style={{ fontWeight: "bold" }}>
                    Post Images Gallery ({images.length})
                  </label>
                  {images.length === 0 ? (
                    <div style={{ color: "var(--text-muted)", fontSize: "12px", fontStyle: "italic" }}>
                      No images attached yet. Click "Upload Image to Cloudinary" above to add images.
                    </div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: "10px" }}>
                      {images.map((url, idx) => {
                        const isCover = coverImageUrl === url;
                        return (
                          <div
                            key={idx}
                            style={{
                              border: isCover ? "2px solid var(--accent)" : "1px solid var(--border-color)",
                              padding: "4px",
                              background: "var(--bg-sidebar)",
                              display: "flex",
                              flexDirection: "column",
                              gap: "4px",
                              position: "relative",
                              borderRadius: "4px",
                            }}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={url}
                              alt={`Gallery ${idx}`}
                              style={{ width: "100%", height: "70px", objectFit: "cover", borderRadius: "2px" }}
                            />
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "2px", justifyContent: "space-between" }}>
                              <button
                                type="button"
                                className="btn btn-sm btn-secondary"
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
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Section 3: RapidLink Short URL */}
            {openSection === "shortlink" && (
              <div style={{ background: "var(--bg-sidebar)", border: "1px solid var(--border-color)", padding: "12px", borderRadius: "4px", display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                  <label className="form-label" style={{ margin: 0, fontWeight: "bold", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Globe size={14} style={{ color: "var(--accent)" }} />
                    <span>RapidLink Short URL Management</span>
                  </label>

                  {shortUrl && (
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ fontSize: "12px", fontFamily: "var(--font-mono)", color: "var(--accent)", fontWeight: "bold" }}>
                        {shortUrl}
                      </span>
                      <button
                        type="button"
                        className="btn btn-sm btn-secondary"
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
            )}

            {/* Section 4: Related Posts */}
            {openSection === "related" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontWeight: "bold", fontSize: "13px" }}>
                    Related Posts ({relatedPosts.length})
                  </div>
                  {id && (
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      onClick={handleRefreshRelated}
                      disabled={isRefreshingRelated}
                      style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 8px" }}
                    >
                      <RefreshCw size={12} style={{ animation: isRefreshingRelated ? "spin 1s linear infinite" : "none" }} />
                      <span>{isRefreshingRelated ? "Refreshing..." : "Refresh"}</span>
                    </button>
                  )}
                </div>

                {relatedPosts.length === 0 ? (
                  <div style={{ color: "var(--text-muted)", fontSize: "12px", fontStyle: "italic" }}>
                    No related posts identified yet. (Calculated automatically based on shared keywords/tags when you save).
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {relatedPosts.map((post) => (
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
                          borderRadius: "4px",
                        }}
                      >
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px", flex: 1 }}>
                          <div style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-primary)" }}>
                            {post.contentMarkdown.slice(0, 70)}...
                          </div>
                          <div style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                            /{post.slug} • Match Score: {post.score}
                          </div>
                        </div>
                        <a href={`/microblog/${post.id}`} className="btn btn-sm btn-secondary">
                          Edit
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Main Markdown Editor & Live Preview (Front and Center) */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "6px", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
        {/* Editor Mode Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
          <div style={{ display: "flex", gap: "4px" }}>
            <button
              type="button"
              className={`btn btn-sm ${activeTab === "write" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setActiveTab("write")}
              style={{ minHeight: "36px", px: "12px" }}
            >
              <FileEdit size={14} /> Write Content
            </button>
            <button
              type="button"
              className={`btn btn-sm ${activeTab === "preview" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setActiveTab("preview")}
              style={{ minHeight: "36px", px: "12px" }}
            >
              <Eye size={14} /> Live Preview
            </button>
          </div>

          <div style={{ fontSize: "12px", color: "var(--text-muted)", fontFamily: "var(--font-mono)", display: "flex", gap: "12px" }}>
            <span>Words: <strong>{wordCount}</strong></span>
            <span>Chars: <strong>{charCount}</strong></span>
          </div>
        </div>

        {/* Writing & Live Preview Layout */}
        <div className="editor-layout" style={{ display: "grid", gridTemplateColumns: activeTab === "preview" ? "1fr" : "1fr 1fr", gap: "16px", minHeight: "450px" }}>
          {/* Editor Input Pane */}
          <div style={{ display: activeTab === "preview" ? "none" : "flex", flexDirection: "column", height: "100%" }}>
            <textarea
              className="editor-textarea"
              style={{
                width: "100%",
                height: "100%",
                minHeight: "450px",
                padding: "14px",
                fontSize: "14px",
                lineHeight: "1.6",
                fontFamily: "var(--font-mono)",
                background: "var(--bg-sidebar)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-color)",
                borderRadius: "4px",
                resize: "vertical",
                outline: "none",
              }}
              placeholder="Write your microblog markdown here..."
              value={contentMarkdown}
              onChange={(e) => setContentMarkdown(e.target.value)}
            />
          </div>

          {/* Live Preview Pane */}
          <div
            style={{
              display: activeTab === "write" ? "flex" : "flex",
              flexDirection: "column",
              height: "100%",
              minHeight: "450px",
              padding: "16px",
              background: "var(--bg-sidebar)",
              border: "1px solid var(--border-color)",
              borderRadius: "4px",
              overflowY: "auto",
            }}
          >
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "10px", textTransform: "uppercase", fontWeight: "bold", letterSpacing: "0.5px" }}>
              Live Markdown Preview
            </div>

            {coverImageUrl && (
              <div style={{ marginBottom: "12px" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={coverImageUrl} alt="Cover" style={{ maxWidth: "100%", maxHeight: "220px", borderRadius: "4px", objectFit: "cover" }} />
              </div>
            )}

            {contentMarkdown ? (
              <div style={{ whiteSpace: "pre-wrap", fontFamily: "var(--font-sans)", lineHeight: "1.6", fontSize: "14px", color: "var(--text-primary)" }}>
                {contentMarkdown}
              </div>
            ) : (
              <em style={{ color: "var(--text-muted)", fontSize: "13px" }}>Nothing to preview yet... Start writing in the editor.</em>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 768px) {
          .editor-layout {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
