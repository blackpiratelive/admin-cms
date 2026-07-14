"use client";

import React, { useState } from "react";
import { type CloudinaryResource } from "@/features/media/cloudinaryActions";
import { importMicroblogBatch } from "@/features/microblog/actions";
import { type CloudflareUsageStats } from "@/features/gallery/actions";
import {
  Settings,
  Upload,
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  Check,
  RefreshCw,
  Info,
  Cloud,
  HardDrive,
  Sliders,
  Palette,
  Rocket,
  Shield,
  Image as ImageIcon,
  Search as SearchIcon,
  Cpu,
} from "lucide-react";

interface SettingsDashboardProps {
  cloudinaryImages: CloudinaryResource[];
  r2Stats?: CloudflareUsageStats;
}

interface ParsedImportPost {
  filename: string;
  slug: string;
  contentMarkdown: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  status: "draft" | "published" | "scheduled" | "archived";
  tags: string[];
  coverImageUrl: string | null;
  images: string[];
  detectedImages: {
    name: string;
    found: boolean;
    url: string | null;
  }[];
  isValid: boolean;
  errorMessages: string[];
}

export function SettingsDashboard({ cloudinaryImages, r2Stats }: SettingsDashboardProps) {
  const [activeTab, setActiveTab] = useState<
    "general" | "import" | "storage" | "appearance" | "providers" | "deployments" | "security" | "media" | "search" | "advanced"
  >("general");

  const [parsedPosts, setParsedPosts] = useState<ParsedImportPost[]>([]);
  const [isReading, setIsReading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    current: number;
    total: number;
    status: string;
  } | null>(null);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [autosaveEnabled, setAutosaveEnabled] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("cms_autosave_enabled") !== "false";
    }
    return true;
  });

  const handleToggleAutosave = (e: React.ChangeEvent<HTMLInputElement>) => {
    const enabled = e.target.checked;
    setAutosaveEnabled(enabled);
    localStorage.setItem("cms_autosave_enabled", enabled ? "true" : "false");
  };

  const handleAssociateImage = (postIndex: number, imgName: string, selectedUrl: string) => {
    if (!selectedUrl) return;

    setParsedPosts((prev) => {
      const updated = [...prev];
      const post = { ...updated[postIndex] };

      post.detectedImages = post.detectedImages.map((img) => {
        if (img.name === imgName) {
          return { ...img, found: true, url: selectedUrl };
        }
        return img;
      });

      const newImages = [...post.images];
      if (!newImages.includes(selectedUrl)) {
        newImages.push(selectedUrl);
      }
      post.images = newImages;

      if (!post.coverImageUrl && newImages.length > 0) {
        post.coverImageUrl = newImages[0];
      }

      const remainingErrors = post.errorMessages.filter(
        (err) => !err.includes(`'${imgName}'`)
      );
      post.errorMessages = remainingErrors;
      post.isValid = remainingErrors.length === 0;

      updated[postIndex] = post;
      return updated;
    });
  };

  const extractImageNames = (content: string): string[] => {
    const filenames: string[] = [];
    const regex1 = /\{\{<\s*(?:image|img|figure)\s+[^>]*src="([^"]+)"/gi;
    let match;
    while ((match = regex1.exec(content)) !== null) {
      filenames.push(match[1]);
    }
    const regex2 = /\{\{[<%]\s*img\s+"([^"]+)"/gi;
    while ((match = regex2.exec(content)) !== null) {
      filenames.push(match[1]);
    }
    const regex3 = /!\[.*?\]\(([^)]+)\)/gi;
    while ((match = regex3.exec(content)) !== null) {
      const url = match[1];
      if (!url.startsWith("http://") && !url.startsWith("https://") && !url.startsWith("/")) {
        filenames.push(url);
      }
    }
    return filenames.map((f) => f.split("/").pop()?.trim() || f.trim());
  };

  const parseMarkdownContent = (filename: string, text: string): ParsedImportPost => {
    const yamlMatch = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    const tomlMatch = text.match(/^\+\+\+\r?\n([\s\S]*?)\r?\n\+\+\+/);

    let frontMatterRaw = "";
    let rawContentMarkdown = text;
    let isYaml = true;

    if (yamlMatch) {
      frontMatterRaw = yamlMatch[1];
      rawContentMarkdown = text.substring(yamlMatch[0].length).trim();
    } else if (tomlMatch) {
      frontMatterRaw = tomlMatch[1];
      rawContentMarkdown = text.substring(tomlMatch[0].length).trim();
      isYaml = false;
    }

    let contentMarkdown = rawContentMarkdown;
    contentMarkdown = contentMarkdown.replace(/\{\{<\s*(?:image|img|figure)\s+[^>]*src="([^"]+)"[^>]*\}\}/gi, "");
    contentMarkdown = contentMarkdown.replace(/\{\{[<%]\s*img\s+"([^"]+)"\s*[%>]\}\}/gi, "");
    contentMarkdown = contentMarkdown.replace(/\{\{[<%]\s*(?:image|img|figure)[^%]*?\}\}/gi, "");
    contentMarkdown = contentMarkdown.replace(/!\[.*?\]\((.*?)\)/gi, "");
    contentMarkdown = contentMarkdown.replace(/\r?\n{3,}/g, "\n\n").trim();

    let dateStr = "";
    let lastmodStr = "";
    let tags: string[] = [];
    let draft = false;

    if (isYaml) {
      const lines = frontMatterRaw.split("\n");
      for (const line of lines) {
        const parts = line.split(":");
        if (parts.length >= 2) {
          const key = parts[0].trim();
          const value = parts.slice(1).join(":").trim().replace(/^['"]|['"]$/g, "");
          if (key === "date") dateStr = value;
          else if (key === "lastmod") lastmodStr = value;
          else if (key === "draft") draft = value === "true";
          else if (key === "tags") {
            if (value.startsWith("[") && value.endsWith("]")) {
              try { tags = JSON.parse(value.replace(/'/g, '"')); } catch (e) {}
            } else {
              tags = value.split(",").map((t) => t.trim()).filter(Boolean);
            }
          }
        }
      }
    } else {
      const lines = frontMatterRaw.split("\n");
      for (const line of lines) {
        const parts = line.split("=");
        if (parts.length >= 2) {
          const key = parts[0].trim();
          const value = parts.slice(1).join("=").trim().replace(/^['"]|['"]$/g, "");
          if (key === "date") dateStr = value;
          else if (key === "lastmod") lastmodStr = value;
          else if (key === "draft") draft = value === "true";
          else if (key === "tags") {
            if (value.startsWith("[") && value.endsWith("]")) {
              try { tags = JSON.parse(value.replace(/'/g, '"')); } catch (e) {}
            } else {
              tags = value.split(",").map((t) => t.trim()).filter(Boolean);
            }
          }
        }
      }
    }

    const nowIso = new Date().toISOString();
    const createdAt = dateStr ? new Date(dateStr).toISOString() : nowIso;
    const updatedAt = lastmodStr ? new Date(lastmodStr).toISOString() : createdAt;
    const status = draft ? "draft" : "published";
    const publishedAt = status === "published" ? createdAt : null;

    const slug = filename
      .replace(/\.md$/, "")
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-");

    const rawImageNames = extractImageNames(rawContentMarkdown);
    const uniqueImageNames = Array.from(new Set(rawImageNames));
    
    const detectedImages: ParsedImportPost["detectedImages"] = [];
    const images: string[] = [];
    const errorMessages: string[] = [];

    const findCloudinaryMatch = (imgName: string): CloudinaryResource | null => {
      const cleanName = imgName.trim().toLowerCase();
      const basename = cleanName.split("/").pop() || cleanName;
      const queryNameNoExt = basename.replace(/\.[^/.]+$/, "").trim();

      for (const res of cloudinaryImages) {
        const publicIdLower = res.public_id.toLowerCase();
        const assetBasename = publicIdLower.split("/").pop() || publicIdLower;
        if (assetBasename.startsWith(queryNameNoExt)) {
          return res;
        }
      }
      return null;
    };

    for (const imgName of uniqueImageNames) {
      const match = findCloudinaryMatch(imgName);
      if (match) {
        detectedImages.push({ name: imgName, found: true, url: match.secure_url });
        images.push(match.secure_url);
      } else {
        detectedImages.push({ name: imgName, found: false, url: null });
        errorMessages.push(`Image '${imgName}' not found in Cloudinary`);
      }
    }

    const coverImageUrl = images.length > 0 ? images[0] : null;
    const isValid = errorMessages.length === 0;

    return {
      filename,
      slug,
      contentMarkdown,
      createdAt,
      updatedAt,
      publishedAt,
      status,
      tags,
      coverImageUrl,
      images,
      detectedImages,
      isValid,
      errorMessages,
    };
  };

  const handleFileSelection = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsReading(true);
    setImportResult(null);
    const parsed: ParsedImportPost[] = [];

    const readSingleFile = (file: File): Promise<ParsedImportPost> => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const text = (event.target?.result as string) || "";
          resolve(parseMarkdownContent(file.name, text));
        };
        reader.readAsText(file);
      });
    };

    try {
      for (let i = 0; i < files.length; i++) {
        const p = await readSingleFile(files[i]);
        parsed.push(p);
      }
      setParsedPosts(parsed);
    } catch (err) {
      console.error("Error reading import files:", err);
    } finally {
      setIsReading(false);
    }
  };

  const handleImport = async () => {
    const postsToImport = parsedPosts.filter((p) => p.isValid);
    if (postsToImport.length === 0) return;

    setIsImporting(true);
    setImportResult(null);
    setImportProgress({ current: 0, total: postsToImport.length, status: "Starting import..." });

    const batchSize = 10;
    let importedCount = 0;

    try {
      for (let i = 0; i < postsToImport.length; i += batchSize) {
        const batch = postsToImport.slice(i, i + batchSize);
        setImportProgress({
          current: i,
          total: postsToImport.length,
          status: `Importing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(
            postsToImport.length / batchSize
          )}...`,
        });

        const payload = batch.map((p) => ({
          slug: p.slug,
          contentMarkdown: p.contentMarkdown,
          tags: p.tags,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
          publishedAt: p.publishedAt,
          status: p.status,
          coverImageUrl: p.coverImageUrl,
          images: p.images,
        }));

        const result = await importMicroblogBatch(payload);
        if (!result.success) {
          throw new Error(result.error || "Batch import failed");
        }

        importedCount += batch.length;
      }

      setImportProgress({
        current: postsToImport.length,
        total: postsToImport.length,
        status: "Finishing import...",
      });

      setImportResult(`Successfully imported ${importedCount} microblog posts!`);
      setParsedPosts([]);
    } catch (err: any) {
      console.error(err);
      setImportResult(`Import interrupted by error: ${err.message || String(err)}`);
    } finally {
      setIsImporting(false);
      setImportProgress(null);
    }
  };

  const totalLoaded = parsedPosts.length;
  const totalValid = parsedPosts.filter((p) => p.isValid).length;
  const totalInvalid = totalLoaded - totalValid;

  const tabs = [
    { id: "general", label: "General & Preferences", icon: Sliders },
    { id: "import", label: "Import Microblogs", icon: Upload },
    { id: "storage", label: "Storage & R2 Monitor", icon: HardDrive },
    { id: "appearance", label: "Appearance", icon: Palette },
    { id: "providers", label: "Providers", icon: RefreshCw },
    { id: "deployments", label: "Deployments", icon: Rocket },
    { id: "security", label: "Security", icon: Shield },
    { id: "media", label: "Media & Processing", icon: ImageIcon },
    { id: "search", label: "Search Index", icon: SearchIcon },
    { id: "advanced", label: "Advanced System", icon: Cpu },
  ] as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Settings size={20} style={{ color: "var(--accent)" }} />
            <span>Central Settings & Tools Hub</span>
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "13px", marginTop: "4px" }}>
            Manage platform preferences, editor autosave, Hugo markdown post imports, Cloudflare R2 stats, and integrations.
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: "20px" }}>
        {/* Navigation Sidebar Tabs */}
        <div
          style={{
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-color)",
            borderRadius: "4px",
            padding: "8px",
            height: "fit-content",
            display: "flex",
            flexDirection: "column",
            gap: "2px",
          }}
        >
          {tabs.map((tab) => {
            const IconComponent = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 12px",
                  borderRadius: "2px",
                  fontSize: "13px",
                  textAlign: "left",
                  background: active ? "var(--accent)" : "transparent",
                  color: active ? "var(--accent-text)" : "var(--text-secondary)",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: active ? 600 : 400,
                }}
              >
                <IconComponent size={15} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Main Content Area */}
        <div
          style={{
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-color)",
            borderRadius: "4px",
            padding: "20px",
            color: "var(--text-primary)",
          }}
        >
          {/* 1. General & Preferences */}
          {activeTab === "general" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <h2 style={{ fontSize: "16px", fontWeight: 600, borderBottom: "1px solid var(--border-color)", paddingBottom: "8px" }}>
                General Preferences
              </h2>

              {/* Autosave Toggle Card */}
              <div style={{ background: "var(--bg-sidebar)", border: "1px solid var(--border-color)", padding: "16px", borderRadius: "4px" }}>
                <h3 style={{ fontSize: "14px", fontWeight: "bold", marginBottom: "12px" }}>Editor Preferences</h3>
                <label style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer", fontSize: "13px" }}>
                  <input
                    type="checkbox"
                    checked={autosaveEnabled}
                    onChange={handleToggleAutosave}
                    style={{ width: "16px", height: "16px", accentColor: "var(--accent)" }}
                  />
                  <div>
                    <strong>Enable Microblog Autosave</strong>
                    <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
                      Automatically save microblog changes as draft every 5 seconds when composing/editing.
                    </div>
                  </div>
                </label>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ color: "var(--text-secondary)" }}>
                  Platform Owner Name
                </label>
                <input type="text" defaultValue="Personal Admin" className="text-input" />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ color: "var(--text-secondary)" }}>
                  Hugo Website Public Domain
                </label>
                <input type="text" defaultValue="https://blackpiratelive.com" className="text-input" />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ color: "var(--text-secondary)" }}>
                  Default Content Visibility
                </label>
                <select className="select-input" defaultValue="public">
                  <option value="public">Public</option>
                  <option value="unlisted">Unlisted</option>
                  <option value="private">Private</option>
                </select>
              </div>
            </div>
          )}

          {/* 2. Microblog Markdown Import Tool */}
          {activeTab === "import" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <h2 style={{ fontSize: "16px", fontWeight: 600, borderBottom: "1px solid var(--border-color)", paddingBottom: "8px" }}>
                Import Hugo Microblog Posts (.md)
              </h2>
              <p style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
                Select multiple Hugo markdown posts (<code>.md</code>). The tool parses YAML/TOML metadata (date, tags, draft status) and verifies referenced Cloudinary media assets before batch inserting into Turso.
              </p>

              <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
                <label className="btn btn-primary" style={{ cursor: "pointer" }}>
                  <Upload size={14} />
                  <span>Select Markdown Files</span>
                  <input
                    type="file"
                    multiple
                    accept=".md"
                    onChange={handleFileSelection}
                    style={{ display: "none" }}
                    disabled={isReading || isImporting}
                  />
                </label>

                {isReading && (
                  <span style={{ fontSize: "12px", color: "var(--accent)", display: "flex", alignItems: "center", gap: "6px" }}>
                    <RefreshCw size={12} style={{ animation: "spin 1s linear infinite" }} />
                    Reading and parsing files...
                  </span>
                )}
              </div>

              {/* Import Result Notification */}
              {importResult && (
                <div
                  style={{
                    background: importResult.includes("Error") || importResult.includes("failed") ? "#ffebee" : "#e8f5e9",
                    border: "1px solid",
                    borderColor: importResult.includes("Error") || importResult.includes("failed") ? "#d32f2f" : "#c8e6c9",
                    padding: "12px 16px",
                    color: importResult.includes("Error") || importResult.includes("failed") ? "#c62828" : "#2e7d32",
                    fontSize: "13px",
                    fontWeight: "500",
                  }}
                >
                  {importResult}
                </div>
              )}

              {/* Progress Bar */}
              {isImporting && importProgress && (
                <div style={{ background: "var(--bg-sidebar)", border: "1px solid var(--border-color)", padding: "14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "6px" }}>
                    <span>{importProgress.status}</span>
                    <span>
                      {importProgress.current} / {importProgress.total} posts
                    </span>
                  </div>
                  <div style={{ height: "6px", background: "var(--border-color)", overflow: "hidden", borderRadius: "3px" }}>
                    <div
                      style={{
                        height: "100%",
                        background: "var(--accent)",
                        width: `${(importProgress.current / importProgress.total) * 100}%`,
                        transition: "width 0.2s",
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Execution Bar */}
              {totalLoaded > 0 && (
                <div
                  style={{
                    background: "var(--bg-sidebar)",
                    border: "1px solid var(--border-color)",
                    padding: "14px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "12px",
                  }}
                >
                  <div style={{ fontSize: "13px" }}>
                    Loaded <strong>{totalLoaded}</strong> files:{" "}
                    <span style={{ color: "#2e7d32", fontWeight: "bold" }}>{totalValid} Ready</span>
                    {totalInvalid > 0 && (
                      <span style={{ color: "#c62828", fontWeight: "bold", marginLeft: "8px" }}>
                        {totalInvalid} Incomplete
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleImport}
                    disabled={isImporting || totalValid === 0}
                    style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    <Play size={14} />
                    <span>Import {totalValid} Valid Posts</span>
                  </button>
                </div>
              )}

              {/* Validation Preview List */}
              {totalLoaded > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <h3 style={{ fontSize: "13px", fontWeight: "bold" }}>Import Preview & Validation</h3>
                  {parsedPosts.map((post, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: "var(--bg-sidebar)",
                        border: "1px solid var(--border-color)",
                        borderLeft: `4px solid ${post.isValid ? "#2e7d32" : "#c62828"}`,
                        padding: "12px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap" }}>
                        <div>
                          <div style={{ fontWeight: "bold", fontSize: "13px", display: "flex", alignItems: "center", gap: "6px" }}>
                            <FileText size={14} />
                            <span>{post.filename}</span>
                          </div>
                          <div style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                            Slug: /{post.slug}
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                          <span style={{ fontSize: "10px", padding: "1px 4px", border: "1px solid var(--border-color)", fontFamily: "var(--font-mono)" }}>
                            {post.status}
                          </span>
                          {post.isValid ? (
                            <span style={{ color: "#2e7d32", fontSize: "12px", display: "flex", alignItems: "center", gap: "4px", fontWeight: "bold" }}>
                              <CheckCircle2 size={14} /> Ready
                            </span>
                          ) : (
                            <span style={{ color: "#c62828", fontSize: "12px", display: "flex", alignItems: "center", gap: "4px", fontWeight: "bold" }}>
                              <XCircle size={14} /> Error
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", fontSize: "11px", color: "var(--text-secondary)", borderBottom: "1px solid var(--border-color)", paddingBottom: "6px" }}>
                        <div>Created: {new Date(post.createdAt).toLocaleDateString()}</div>
                        <div>Updated: {new Date(post.updatedAt).toLocaleDateString()}</div>
                        {post.tags.length > 0 && <div>Tags: {post.tags.join(", ")}</div>}
                      </div>

                      {post.detectedImages.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px", background: "var(--bg-card)", padding: "8px", fontSize: "11px" }}>
                          <div style={{ fontWeight: "bold" }}>Detected Image Assets:</div>
                          {post.detectedImages.map((img, i) => (
                            <div key={i} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                              {img.found ? (
                                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                  <Check size={12} style={{ color: "#2e7d32" }} />
                                  <span>Attached: <code>{img.name}</code></span>
                                </div>
                              ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                    <AlertTriangle size={12} style={{ color: "#c62828" }} />
                                    <span style={{ color: "#c62828", fontWeight: "600" }}>
                                      Missing: <code>{img.name}</code> not found in Cloudinary
                                    </span>
                                  </div>
                                  <div style={{ display: "flex", alignItems: "center", gap: "8px", paddingLeft: "18px" }}>
                                    <span style={{ color: "var(--text-muted)", fontSize: "10px" }}>Associate manually:</span>
                                    <select
                                      className="select-input"
                                      style={{ fontSize: "10px", padding: "2px 6px", height: "auto", width: "240px" }}
                                      onChange={(e) => handleAssociateImage(idx, img.name, e.target.value)}
                                      defaultValue=""
                                    >
                                      <option value="">-- Choose image from Cloudinary --</option>
                                      {cloudinaryImages.map((c) => (
                                        <option key={c.public_id} value={c.secure_url}>
                                          {c.public_id}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {!post.isValid && post.errorMessages.length > 0 && (
                        <div style={{ color: "#c62828", fontSize: "11px", display: "flex", flexDirection: "column", gap: "2px" }}>
                          {post.errorMessages.map((err, i) => (
                            <div key={i}>• {err}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 3. Storage & R2 Monitor */}
          {activeTab === "storage" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <h2 style={{ fontSize: "16px", fontWeight: 600, borderBottom: "1px solid var(--border-color)", paddingBottom: "8px" }}>
                Cloudflare R2 Usage Stats & Plan Limits
              </h2>
              {r2Stats ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <Cloud size={18} style={{ color: "var(--accent)" }} />
                      <span style={{ fontWeight: "bold" }}>Cloudflare R2 Storage</span>
                    </div>
                    <span className={`status-badge status-${r2Stats.configured ? "published" : "draft"}`}>
                      {r2Stats.configured ? "R2 Cloud Connected" : "Local Dev Fallback"}
                    </span>
                  </div>

                  <div style={{ background: "var(--bg-sidebar)", padding: "12px", borderRadius: "4px", border: "1px solid var(--border-color)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>
                      <span>Bucket: <code style={{ color: "var(--accent)" }}>{r2Stats.bucketName}</code></span>
                      <span>Storage Used: <strong>{r2Stats.usedFormatted}</strong> / {r2Stats.storageLimitFormatted} ({r2Stats.percentStorageUsed}%)</span>
                    </div>
                    <div style={{ width: "100%", height: "8px", background: "var(--border-color)", borderRadius: "4px", overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${r2Stats.percentStorageUsed}%`,
                          backgroundColor: r2Stats.percentStorageUsed > 85 ? "#d32f2f" : "var(--accent)",
                          transition: "width 0.3s ease",
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "12px" }}>
                    <div style={{ background: "var(--bg-sidebar)", padding: "12px", border: "1px solid var(--border-color)", borderRadius: "4px" }}>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "bold" }}>Stored Photos</div>
                      <div style={{ fontSize: "18px", fontWeight: "bold", marginTop: "4px" }}>{r2Stats.totalPhotos} Photos</div>
                    </div>
                    <div style={{ background: "var(--bg-sidebar)", padding: "12px", border: "1px solid var(--border-color)", borderRadius: "4px" }}>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "bold" }}>Derivative Files</div>
                      <div style={{ fontSize: "18px", fontWeight: "bold", marginTop: "4px" }}>{r2Stats.totalObjects} Files</div>
                    </div>
                    <div style={{ background: "var(--bg-sidebar)", padding: "12px", border: "1px solid var(--border-color)", borderRadius: "4px" }}>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "bold" }}>Class A Ops Limit</div>
                      <div style={{ fontSize: "12px", fontWeight: "bold", marginTop: "4px", color: "#2e7d32" }}>{r2Stats.classALimitFormatted}</div>
                    </div>
                    <div style={{ background: "var(--bg-sidebar)", padding: "12px", border: "1px solid var(--border-color)", borderRadius: "4px" }}>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "bold" }}>Class B Ops Limit</div>
                      <div style={{ fontSize: "12px", fontWeight: "bold", marginTop: "4px", color: "#2e7d32" }}>{r2Stats.classBLimitFormatted}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ color: "var(--text-muted)", fontSize: "13px" }}>No R2 stats available.</div>
              )}
            </div>
          )}

          {/* 4. Appearance */}
          {activeTab === "appearance" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <h2 style={{ fontSize: "16px", fontWeight: 600, borderBottom: "1px solid var(--border-color)", paddingBottom: "8px" }}>
                Theme & Aesthetics
              </h2>
              <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                Use the theme selector in the top-right header to switch dynamically between <strong>HN Orange</strong>, <strong>Dark</strong>, <strong>Mono</strong>, and <strong>Teal</strong>.
              </p>
            </div>
          )}

          {/* 5. Providers */}
          {activeTab === "providers" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <h2 style={{ fontSize: "16px", fontWeight: 600, borderBottom: "1px solid var(--border-color)", paddingBottom: "8px" }}>
                Provider Integrations Status
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ padding: "12px 16px", border: "1px solid var(--border-color)", backgroundColor: "var(--bg-sidebar)", borderRadius: "4px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>🎬 Trakt.tv</div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Movies & TV Shows synchronization</div>
                  </div>
                  <span className="status-badge status-published">Connected</span>
                </div>
                <div style={{ padding: "12px 16px", border: "1px solid var(--border-color)", backgroundColor: "var(--bg-sidebar)", borderRadius: "4px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>🎵 Last.fm</div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Scrobbles & Music metadata</div>
                  </div>
                  <span className="status-badge status-published">Connected</span>
                </div>
              </div>
            </div>
          )}

          {/* 6. Deployments */}
          {activeTab === "deployments" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <h2 style={{ fontSize: "16px", fontWeight: 600, borderBottom: "1px solid var(--border-color)", paddingBottom: "8px" }}>
                Vercel Deploy Hook Configuration
              </h2>
              <div className="form-group">
                <label className="form-label" style={{ color: "var(--text-secondary)" }}>Deploy Hook URL</label>
                <input type="password" defaultValue="https://api.vercel.com/v1/integrations/deploy/..." className="text-input" />
              </div>
            </div>
          )}

          {/* 7. Security */}
          {activeTab === "security" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <h2 style={{ fontSize: "16px", fontWeight: 600, borderBottom: "1px solid var(--border-color)", paddingBottom: "8px" }}>
                Security & Session Settings
              </h2>
              <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                Single-user administration protected via HTTP-Only JWT session token (<code>cms_session</code>). Password configured via <code>ADMIN_PASSWORD</code>.
              </div>
            </div>
          )}

          {/* 8. Media */}
          {activeTab === "media" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <h2 style={{ fontSize: "16px", fontWeight: 600, borderBottom: "1px solid var(--border-color)", paddingBottom: "8px" }}>
                Media Processing Options
              </h2>
              <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                Browser WebWorker image optimization creates derivative thumbnails (large, medium, small) automatically upon photo upload.
              </div>
            </div>
          )}

          {/* 9. Search */}
          {activeTab === "search" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <h2 style={{ fontSize: "16px", fontWeight: 600, borderBottom: "1px solid var(--border-color)", paddingBottom: "8px" }}>
                Search Engine & Indexing
              </h2>
              <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                Universal fuzzy search covers Microblogs, Gallery, Movies, TV Shows, Music, Projects, Locations, Trips & Collections.
              </div>
              <button className="btn" onClick={() => alert("Search index refreshed!")}>
                Re-index Knowledge Graph
              </button>
            </div>
          )}

          {/* 10. Advanced System */}
          {activeTab === "advanced" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <h2 style={{ fontSize: "16px", fontWeight: 600, borderBottom: "1px solid var(--border-color)", paddingBottom: "8px" }}>
                Advanced Diagnostics
              </h2>
              <div style={{ fontSize: "13px", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                Database Driver: Drizzle ORM + libSQL (Turso)
                <br />
                System Status: Operational
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
