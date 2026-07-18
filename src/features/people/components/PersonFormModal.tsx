"use client";

import { useState, useEffect, useRef } from "react";
import { PersonRecord } from "@/db/schema";
import {
  createPersonAction,
  updatePersonAction,
} from "@/features/people/actions";
import { notify } from "@/lib/notifications";
import {
  DEFAULT_RELATIONSHIP_TYPES,
  DEFAULT_IMPORTANT_DATE_TYPES,
  ImportantDate,
  SocialLinks,
} from "@/features/people/schema";
import { uploadDirectToCloudinary } from "@/lib/cloudinary";
import { getCloudinaryResources, CloudinaryResource } from "@/features/media/cloudinaryActions";
import { X, Plus, Trash2, Calendar, Lock, Globe, EyeOff, Star, Tag, Link2, Upload, Image as ImageIcon, Facebook, Check } from "lucide-react";

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
    facebook: "",
    github: "",
    linkedin: "",
    website: "",
  });

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [isCloudinaryPickerOpen, setIsCloudinaryPickerOpen] = useState(false);
  const [cloudinaryResources, setCloudinaryResources] = useState<CloudinaryResource[]>([]);
  const [loadingCloudinary, setLoadingCloudinary] = useState(false);
  const [showManualUrl, setShowManualUrl] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setSocialLinks({ instagram: "", facebook: "", github: "", linkedin: "", website: "" });
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

  const handleAvatarFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    try {
      const res = await uploadDirectToCloudinary(file);
      if (res.secure_url) {
        setAvatarUrl(res.secure_url);
        notify.show({
          type: "success",
          title: "Avatar Uploaded",
          message: "New avatar uploaded to Cloudinary successfully!",
        });
      }
    } catch (err: any) {
      notify.show({
        type: "error",
        title: "Upload Failed",
        message: err?.message || "Failed to upload avatar to Cloudinary",
      });
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleOpenCloudinaryPicker = async () => {
    setIsCloudinaryPickerOpen(!isCloudinaryPickerOpen);
    if (!isCloudinaryPickerOpen && cloudinaryResources.length === 0) {
      setLoadingCloudinary(true);
      const res = await getCloudinaryResources();
      if (res.success && res.resources) {
        setCloudinaryResources(res.resources);
      } else if (res.error) {
        notify.show({
          type: "error",
          title: "Cloudinary Error",
          message: res.error,
        });
      }
      setLoadingCloudinary(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setError("Display name is required");
      return;
    }

    const personName = displayName.trim();
    const finalRelationship =
      relationshipType === "Custom" ? customRelationship.trim() || "Contact" : relationshipType;

    const payload = {
      displayName: personName,
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

    onClose();

    notify.bg({
      title: personToEdit ? "Update Person" : "Create Person",
      loadingMessage: `Saving person '${personName}' in background...`,
      successMessage: `Person '${personName}' saved successfully!`,
      errorMessage: (err) => `Failed to save person: ${err?.message || String(err)}`,
      task: async () => {
        if (personToEdit) {
          return await updatePersonAction(personToEdit.id, payload);
        } else {
          return await createPersonAction(payload);
        }
      },
      onSuccess: (result) => {
        if (result.success) {
          onSuccess?.();
        } else {
          notify.show({
            type: "error",
            title: "Save Failed",
            message: result.error || "Failed to save person.",
          });
        }
      },
    });
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
            <label className="form-label" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Profile Avatar (Cloudinary)</span>
              <button
                type="button"
                onClick={() => setShowManualUrl(!showManualUrl)}
                style={{ background: "none", border: "none", color: "var(--accent)", fontSize: "11px", cursor: "pointer", textDecoration: "underline" }}
              >
                {showManualUrl ? "Hide URL Input" : "Edit URL Manually"}
              </button>
            </label>

            <div style={{ display: "flex", gap: "14px", alignItems: "center", backgroundColor: "var(--bg-hover)", padding: "14px", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
              {/* Avatar Preview */}
              <div
                style={{
                  width: "60px",
                  height: "60px",
                  borderRadius: "50%",
                  overflow: "hidden",
                  border: "2px solid var(--accent)",
                  backgroundColor: "var(--bg-card)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  fontSize: "20px",
                  fontWeight: "bold",
                  color: "var(--text-muted)",
                }}
              >
                {avatarUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={avatarUrl}
                    alt="Avatar preview"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                ) : (
                  (displayName.trim().charAt(0) || "P").toUpperCase()
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1 }}>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarFileUpload}
                    style={{ display: "none" }}
                    id="person-avatar-upload"
                  />
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    style={{ fontSize: "12px", padding: "6px 12px" }}
                  >
                    <Upload size={14} />
                    <span>{uploadingAvatar ? "Uploading..." : "Upload to Cloudinary"}</span>
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleOpenCloudinaryPicker}
                    style={{ fontSize: "12px", padding: "6px 12px" }}
                  >
                    <ImageIcon size={14} />
                    <span>{isCloudinaryPickerOpen ? "Close Media Library" : "Choose from Cloudinary"}</span>
                  </button>

                  {avatarUrl && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setAvatarUrl("")}
                      style={{ fontSize: "12px", padding: "6px 10px", color: "#ef4444" }}
                    >
                      <Trash2 size={13} />
                      <span>Remove</span>
                    </button>
                  )}
                </div>

                <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                  Upload a photo directly to Cloudinary or select an existing photo from your Cloudinary library.
                </div>
              </div>
            </div>

            {/* Cloudinary Media Library Grid Picker */}
            {isCloudinaryPickerOpen && (
              <div
                style={{
                  marginTop: "12px",
                  padding: "12px",
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "8px",
                  maxHeight: "220px",
                  overflowY: "auto",
                }}
              >
                <div style={{ fontSize: "12px", fontWeight: 600, marginBottom: "8px", display: "flex", justifyContent: "space-between" }}>
                  <span>Select Avatar from Cloudinary:</span>
                  <span>{cloudinaryResources.length} images</span>
                </div>

                {loadingCloudinary ? (
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", padding: "16px", textAlign: "center" }}>
                    Loading Cloudinary media library...
                  </div>
                ) : cloudinaryResources.length === 0 ? (
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", padding: "16px", textAlign: "center" }}>
                    No Cloudinary images found. Upload a new photo above!
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(60px, 1fr))", gap: "8px" }}>
                    {cloudinaryResources.map((res) => {
                      const isSelected = avatarUrl === res.secure_url;
                      return (
                        <div
                          key={res.public_id}
                          onClick={() => {
                            setAvatarUrl(res.secure_url);
                            setIsCloudinaryPickerOpen(false);
                          }}
                          style={{
                            aspectRatio: "1",
                            borderRadius: "6px",
                            overflow: "hidden",
                            border: isSelected ? "2px solid var(--accent)" : "1px solid var(--border-color)",
                            cursor: "pointer",
                            position: "relative",
                            backgroundColor: "var(--bg-hover)",
                          }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={res.secure_url}
                            alt={res.public_id}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                          {isSelected && (
                            <div
                              style={{
                                position: "absolute",
                                inset: 0,
                                backgroundColor: "rgba(0,0,0,0.4)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "#fff",
                              }}
                            >
                              <Check size={16} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Manual URL Input */}
            {showManualUrl && (
              <div style={{ marginTop: "10px" }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="https://res.cloudinary.com/..."
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                />
              </div>
            )}
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
                <label className="form-label">Facebook</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="username or profile URL"
                  value={socialLinks.facebook || ""}
                  onChange={(e) => setSocialLinks({ ...socialLinks, facebook: e.target.value })}
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
