"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { saveMicroblog, deleteMicroblog } from "./actions";
import { type Microblog } from "@/db/schema";
import { Save, Eye, Trash2, Globe, FileEdit, Archive, Upload } from "lucide-react";

interface MicroblogEditorProps {
  initialData?: Microblog | null;
}

export function MicroblogEditor({ initialData }: MicroblogEditorProps) {
  const router = useRouter();
  const [id] = useState<string | undefined>(initialData?.id);
  const [contentMarkdown, setContentMarkdown] = useState<string>(initialData?.contentMarkdown || "");
  const [slug, setSlug] = useState<string>(initialData?.slug || "");
  const [status, setStatus] = useState<"draft" | "published" | "scheduled" | "archived">(
    (initialData?.status as any) || "draft"
  );
  const [tags, setTags] = useState<string>(
    initialData?.tags ? JSON.parse(initialData.tags).join(", ") : ""
  );
  const [coverImageUrl, setCoverImageUrl] = useState<string>(initialData?.coverImageUrl || "");
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"write" | "preview">("write");

  // Character & Word counts
  const charCount = contentMarkdown.length;
  const wordCount = contentMarkdown.trim() ? contentMarkdown.trim().split(/\s+/).length : 0;

  const handleSubmit = async (targetStatus?: "draft" | "published" | "archived") => {
    setIsSaving(true);
    const finalStatus = targetStatus || status;
    try {
      const result = await saveMicroblog({
        id,
        slug,
        contentMarkdown,
        status: finalStatus,
        tags,
        coverImageUrl: coverImageUrl || null,
      });

      if (result.success) {
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
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    if (!confirm("Are you sure you want to delete this microblog post?")) return;
    setIsSaving(true);
    await deleteMicroblog(id);
    router.push("/microblog");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Editor Top Bar Actions */}
      <div className="page-header">
        <h1 className="page-title">
          <FileEdit size={18} />
          {id ? "Edit Microblog" : "New Microblog"}
        </h1>
        <div style={{ display: "flex", gap: "8px" }}>
          {id && (
            <button type="button" onClick={handleDelete} className="btn btn-danger btn-sm" disabled={isSaving}>
              <Trash2 size={14} />
              <span>Delete</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => handleSubmit("draft")}
            className="btn btn-sm"
            disabled={isSaving}
          >
            <Save size={14} />
            <span>Save Draft</span>
          </button>
          <button
            type="button"
            onClick={() => handleSubmit("published")}
            className="btn btn-primary btn-sm"
            disabled={isSaving}
          >
            <Globe size={14} />
            <span>Publish Post</span>
          </button>
        </div>
      </div>

      {/* Settings Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", background: "var(--bg-card)", padding: "12px", border: "1px solid var(--border-color)" }}>
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
        {(activeTab === "write" || true) && (
          <div className="editor-pane">
            <textarea
              className="editor-textarea"
              placeholder="Write your microblog markdown here..."
              value={contentMarkdown}
              onChange={(e) => setContentMarkdown(e.target.value)}
            />
          </div>
        )}

        {(activeTab === "preview" || true) && (
          <div className="preview-pane">
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "8px", textTransform: "uppercase", fontWeight: "bold" }}>
              Live Preview
            </div>
            {contentMarkdown ? (
              <div style={{ whiteSpace: "pre-wrap", fontFamily: "var(--font-sans)", lineHeight: "1.6" }}>
                {contentMarkdown}
              </div>
            ) : (
              <em style={{ color: "var(--text-muted)" }}>Nothing to preview yet...</em>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
