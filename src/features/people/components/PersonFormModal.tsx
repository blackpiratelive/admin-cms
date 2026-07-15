"use client";

import { useState, useEffect } from "react";
import { PersonRecord } from "@/db/schema";
import {
  createPersonAction,
  updatePersonAction,
} from "@/features/people/actions";
import {
  DEFAULT_RELATIONSHIP_TYPES,
  DEFAULT_IMPORTANT_DATE_TYPES,
  ImportantDate,
  SocialLinks,
} from "@/features/people/schema";
import { X, Plus, Trash2, Calendar, Lock, Globe, EyeOff, Star, Tag, Link2 } from "lucide-react";

interface PersonFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  personToEdit?: PersonRecord | null;
  onSuccess?: () => void;
}

export function PersonFormModal({
  isOpen,
  onClose,
  personToEdit,
  onSuccess,
}: PersonFormModalProps) {
  const [displayName, setDisplayName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [nickname, setNickname] = useState("");
  const [slug, setSlug] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [relationshipType, setRelationshipType] = useState<string>("Friend");
  const [customRelationship, setCustomRelationship] = useState("");
  const [importantDates, setImportantDates] = useState<ImportantDate[]>([]);
  const [notesMarkdown, setNotesMarkdown] = useState("");
  const [interests, setInterests] = useState("");
  const [tags, setTags] = useState("");
  const [visibility, setVisibility] = useState<"private" | "unlisted" | "public">("private");
  const [favorite, setFavorite] = useState(false);

  const [socialLinks, setSocialLinks] = useState<SocialLinks>({
    instagram: "",
    github: "",
    linkedin: "",
    website: "",
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (personToEdit) {
      setDisplayName(personToEdit.displayName || "");
      setFirstName(personToEdit.firstName || "");
      setLastName(personToEdit.lastName || "");
      setNickname(personToEdit.nickname || "");
      setSlug(personToEdit.slug || "");
      setAvatarUrl(personToEdit.avatarUrl || "");
      
      const rel = personToEdit.relationshipType || "Friend";
      if ((DEFAULT_RELATIONSHIP_TYPES as readonly string[]).includes(rel)) {
        setRelationshipType(rel);
        setCustomRelationship("");
      } else {
        setRelationshipType("Custom");
        setCustomRelationship(rel);
      }

      try {
        setImportantDates(JSON.parse(personToEdit.importantDatesJson || "[]"));
      } catch {
        setImportantDates([]);
      }

      try {
        const parsedInterests = JSON.parse(personToEdit.interests || "[]");
        setInterests(Array.isArray(parsedInterests) ? parsedInterests.join(", ") : "");
      } catch {
        setInterests("");
      }

      try {
        const parsedTags = JSON.parse(personToEdit.tags || "[]");
        setTags(Array.isArray(parsedTags) ? parsedTags.join(", ") : "");
      } catch {
        setTags("");
      }

      try {
        setSocialLinks(JSON.parse(personToEdit.socialLinksJson || "{}"));
      } catch {
        setSocialLinks({});
      }

      setNotesMarkdown(personToEdit.notesMarkdown || "");
      setVisibility(personToEdit.visibility as any || "private");
      setFavorite(personToEdit.favorite === 1);
    } else {
      // Reset defaults
      setDisplayName("");
      setFirstName("");
      setLastName("");
      setNickname("");
      setSlug("");
      setAvatarUrl("");
      setRelationshipType("Friend");
      setCustomRelationship("");
      setImportantDates([]);
      setNotesMarkdown("");
      setInterests("");
      setTags("");
      setSocialLinks({ instagram: "", github: "", linkedin: "", website: "" });
      setVisibility("private");
      setFavorite(false);
    }
    setError(null);
  }, [personToEdit, isOpen]);

  if (!isOpen) return null;

  const handleAddImportantDate = () => {
    const newDate: ImportantDate = {
      id: `date_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: "Birthday",
      date: new Date().toISOString().split("T")[0],
      reminderEnabled: true,
      notes: "",
    };
    setImportantDates([...importantDates, newDate]);
  };

  const handleRemoveImportantDate = (id: string) => {
    setImportantDates(importantDates.filter((d) => d.id !== id));
  };

  const handleUpdateImportantDate = (id: string, updates: Partial<ImportantDate>) => {
    setImportantDates(
      importantDates.map((d) => (d.id === id ? { ...d, ...updates } : d))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setError("Display name is required");
      return;
    }

    setSaving(true);
    setError(null);

    const finalRelationship =
      relationshipType === "Custom" ? customRelationship.trim() || "Contact" : relationshipType;

    const payload = {
      displayName: displayName.trim(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      nickname: nickname.trim(),
      slug: slug.trim(),
      avatarUrl: avatarUrl.trim(),
      relationshipType: finalRelationship,
      importantDates,
      notesMarkdown,
      interests: interests.split(",").map((s) => s.trim()).filter(Boolean),
      tags: tags.split(",").map((s) => s.trim()).filter(Boolean),
      socialLinks,
      visibility,
      favorite,
    };

    let result;
    if (personToEdit) {
      result = await updatePersonAction(personToEdit.id, payload);
    } else {
      result = await createPersonAction(payload);
    }

    setSaving(false);

    if (result.success) {
      onSuccess?.();
      onClose();
    } else {
      setError(result.error || "Operation failed");
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        backdropFilter: "blur(4px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "680px",
          maxHeight: "90vh",
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-color)",
          borderRadius: "8px",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border-color)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h2 style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>
            {personToEdit ? `Edit Person: ${personToEdit.displayName}` : "Add New Person"}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: "4px",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Content Form */}
        <form onSubmit={handleSubmit} style={{ overflowY: "auto", flex: 1, padding: "20px" }}>
          {error && (
            <div
              style={{
                backgroundColor: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                color: "#ef4444",
                padding: "10px 14px",
                borderRadius: "6px",
                fontSize: "13px",
                marginBottom: "16px",
              }}
            >
              {error}
            </div>
          )}

          {/* Identity Section */}
          <div style={{ marginBottom: "20px" }}>
            <h3 style={{ fontSize: "13px", fontWeight: 600, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "12px" }}>
              Identity & Profile
            </h3>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
              <div>
                <label className="form-label">Display Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. John Doe"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="form-label">Nickname</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Johnny"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
              <div>
                <label className="form-label">First Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. John"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Last Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Doe"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
              <div>
                <label className="form-label">Relationship Type</label>
                <select
                  className="form-input"
                  value={relationshipType}
                  onChange={(e) => setRelationshipType(e.target.value)}
                >
                  {DEFAULT_RELATIONSHIP_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                  <option value="Custom">Custom...</option>
                </select>
                {relationshipType === "Custom" && (
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Enter custom relationship"
                    value={customRelationship}
                    onChange={(e) => setCustomRelationship(e.target.value)}
                    style={{ marginTop: "6px" }}
                  />
                )}
              </div>

              <div>
                <label className="form-label">Privacy & Visibility</label>
                <select
                  className="form-input"
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as any)}
                >
                  <option value="private">Private (Default)</option>
                  <option value="unlisted">Unlisted</option>
                  <option value="public">Public</option>
                </select>
              </div>
            </div>

            <div style={{ display: "flex", gap: "16px", alignItems: "center", marginTop: "8px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "13px" }}>
                <input
                  type="checkbox"
                  checked={favorite}
                  onChange={(e) => setFavorite(e.target.checked)}
                />
                <Star size={14} style={{ color: favorite ? "#f59e0b" : "var(--text-muted)" }} />
                <span>Mark as Favorite Person</span>
              </label>
            </div>
          </div>

          {/* Avatar Section */}
          <div style={{ marginBottom: "20px" }}>
            <label className="form-label">Avatar Image URL</label>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <input
                type="text"
                className="form-input"
                placeholder="https://... image URL or media path"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                style={{ flex: 1 }}
              />
              {avatarUrl && (
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    overflow: "hidden",
                    border: "1px solid var(--border-color)",
                    backgroundColor: "var(--bg-hover)",
                    flexShrink: 0,
                  }}
                >
                  <img
                    src={avatarUrl}
                    alt="Avatar preview"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Important Dates Section */}
          <div style={{ marginBottom: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <h3 style={{ fontSize: "13px", fontWeight: 600, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.5px", margin: 0 }}>
                Important Dates (Birthdays, Anniversaries, etc.)
              </h3>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleAddImportantDate}
                style={{ fontSize: "12px", padding: "4px 8px" }}
              >
                <Plus size={13} />
                <span>Add Date</span>
              </button>
            </div>

            {importantDates.length === 0 ? (
              <div style={{ fontSize: "12px", color: "var(--text-muted)", fontStyle: "italic", padding: "8px 0" }}>
                No important dates added yet.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {importantDates.map((d) => (
                  <div
                    key={d.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr auto auto",
                      gap: "8px",
                      alignItems: "center",
                      backgroundColor: "var(--bg-hover)",
                      padding: "8px 10px",
                      borderRadius: "6px",
                    }}
                  >
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Title (e.g. Birthday)"
                      value={d.title}
                      onChange={(e) => handleUpdateImportantDate(d.id, { title: e.target.value })}
                      style={{ fontSize: "12px", padding: "4px 8px" }}
                    />
                    <input
                      type="date"
                      className="form-input"
                      value={d.date}
                      onChange={(e) => handleUpdateImportantDate(d.id, { date: e.target.value })}
                      style={{ fontSize: "12px", padding: "4px 8px" }}
                    />
                    <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={d.reminderEnabled}
                        onChange={(e) => handleUpdateImportantDate(d.id, { reminderEnabled: e.target.checked })}
                      />
                      <span>Reminder</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => handleRemoveImportantDate(d.id)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#ef4444",
                        cursor: "pointer",
                        padding: "4px",
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Interests & Tags */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px" }}>
            <div>
              <label className="form-label">Interests (comma separated)</label>
              <input
                type="text"
                className="form-input"
                placeholder="Photography, Cycling, Gaming..."
                value={interests}
                onChange={(e) => setInterests(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">Tags (comma separated)</label>
              <input
                type="text"
                className="form-input"
                placeholder="college, travel, dev..."
                value={tags}
                onChange={(e) => setTags(e.target.value)}
              />
            </div>
          </div>

          {/* Social Links */}
          <div style={{ marginBottom: "20px" }}>
            <h3 style={{ fontSize: "13px", fontWeight: 600, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "10px" }}>
              Social & Web Links
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div>
                <label className="form-label">Instagram</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="username or URL"
                  value={socialLinks.instagram || ""}
                  onChange={(e) => setSocialLinks({ ...socialLinks, instagram: e.target.value })}
                />
              </div>
              <div>
                <label className="form-label">GitHub</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="username or URL"
                  value={socialLinks.github || ""}
                  onChange={(e) => setSocialLinks({ ...socialLinks, github: e.target.value })}
                />
              </div>
              <div>
                <label className="form-label">LinkedIn</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="username or URL"
                  value={socialLinks.linkedin || ""}
                  onChange={(e) => setSocialLinks({ ...socialLinks, linkedin: e.target.value })}
                />
              </div>
              <div>
                <label className="form-label">Website</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="https://..."
                  value={socialLinks.website || ""}
                  onChange={(e) => setSocialLinks({ ...socialLinks, website: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Markdown Notes */}
          <div style={{ marginBottom: "20px" }}>
            <label className="form-label">Personal Markdown Notes</label>
            <textarea
              className="form-input"
              rows={4}
              placeholder="Things they like, gift ideas, food preferences, funny stories, memory notes..."
              value={notesMarkdown}
              onChange={(e) => setNotesMarkdown(e.target.value)}
              style={{ fontFamily: "monospace", fontSize: "13px" }}
            />
          </div>
        </form>

        {/* Modal Footer Actions */}
        <div
          style={{
            padding: "16px 20px",
            borderTop: "1px solid var(--border-color)",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "10px",
          }}
        >
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? "Saving..." : personToEdit ? "Update Person" : "Create Person"}
          </button>
        </div>
      </div>
    </div>
  );
}
