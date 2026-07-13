"use client";

import React, { useState } from "react";
import { type CloudinaryResource } from "@/features/media/cloudinaryActions";
import { importMicroblogBatch } from "@/features/microblog/actions";
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
} from "lucide-react";

interface SettingsDashboardProps {
  cloudinaryImages: CloudinaryResource[];
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

export function SettingsDashboard({ cloudinaryImages }: SettingsDashboardProps) {
  const [activeTab, setActiveTab] = useState<"system" | "import">("system");
  const [parsedPosts, setParsedPosts] = useState<ParsedImportPost[]>([]);
  const [isReading, setIsReading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    current: number;
    total: number;
    status: string;
  } | null>(null);
  const [importResult, setImportResult] = useState<string | null>(null);

  // Helper to extract image names from content
  const extractImageNames = (content: string): string[] => {
    const filenames: string[] = [];

    // Match {{< image src="filename" >}} or {{< img src="filename" >}} or {{< figure src="filename" >}}
    const regex1 = /\{\{<\s*(?:image|img|figure)\s+[^>]*src="([^"]+)"/gi;
    let match;
    while ((match = regex1.exec(content)) !== null) {
      filenames.push(match[1]);
    }

    // Match {{% img "filename" %}} or {{< img "filename" >}} (anonymous positional parameter)
    const regex2 = /\{\{[<%]\s*img\s+"([^"]+)"/gi;
    while ((match = regex2.exec(content)) !== null) {
      filenames.push(match[1]);
    }

    // Match markdown images ![alt](filename)
    const regex3 = /!\[.*?\]\(([^)]+)\)/gi;
    while ((match = regex3.exec(content)) !== null) {
      const url = match[1];
      if (!url.startsWith("http://") && !url.startsWith("https://") && !url.startsWith("/")) {
        filenames.push(url);
      }
    }

    // Clean filenames: get basename (preserve extension)
    return filenames.map((f) => {
      return f.split("/").pop()?.trim() || f.trim();
    });
  };

  // HTML5 FileReader Markdown Parser
  const parseMarkdownContent = (filename: string, text: string): ParsedImportPost => {
    const yamlMatch = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    const tomlMatch = text.match(/^\+\+\+\r?\n([\s\S]*?)\r?\n\+\+\+/);

    let frontMatterRaw = "";
    let contentMarkdown = text;
    let isYaml = true;

    if (yamlMatch) {
      frontMatterRaw = yamlMatch[1];
      contentMarkdown = text.substring(yamlMatch[0].length).trim();
    } else if (tomlMatch) {
      frontMatterRaw = tomlMatch[1];
      contentMarkdown = text.substring(tomlMatch[0].length).trim();
      isYaml = false;
    }

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
              try {
                tags = JSON.parse(value.replace(/'/g, '"'));
              } catch (e) {}
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
              try {
                tags = JSON.parse(value.replace(/'/g, '"'));
              } catch (e) {}
            } else {
              tags = value.split(",").map((t) => t.trim()).filter(Boolean);
            }
          }
        }
      }
    }

    // Default dates if missing
    const nowIso = new Date().toISOString();
    const createdAt = dateStr ? new Date(dateStr).toISOString() : nowIso;
    const updatedAt = lastmodStr ? new Date(lastmodStr).toISOString() : createdAt;
    
    const status = draft ? "draft" : "published";
    const publishedAt = status === "published" ? createdAt : null;

    // Generate slug from filename
    const slug = filename
      .replace(/\.md$/, "")
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-");

    // Extract and validate images
    const rawImageNames = extractImageNames(contentMarkdown);
    const uniqueImageNames = Array.from(new Set(rawImageNames));
    
    const detectedImages: ParsedImportPost["detectedImages"] = [];
    const images: string[] = [];
    const errorMessages: string[] = [];

    const findCloudinaryMatch = (imgName: string): CloudinaryResource | null => {
      const cleanName = imgName.trim().toLowerCase();
      const basename = cleanName.split("/").pop() || cleanName;
      const hasExtension = basename.includes(".");

      for (const res of cloudinaryImages) {
        const secureUrlLower = res.secure_url.toLowerCase();
        const publicIdLower = res.public_id.toLowerCase();

        if (hasExtension) {
          // If the shortcode includes an extension, match it against the end of the secure URL path
          if (
            secureUrlLower.endsWith("/" + basename) ||
            secureUrlLower.includes("/" + basename + "/") ||
            secureUrlLower.includes("/" + basename + "?") ||
            secureUrlLower.includes("/" + basename)
          ) {
            return res;
          }
        } else {
          // Fallback if no extension, match public_id
          if (publicIdLower === basename || publicIdLower.endsWith("/" + basename)) {
            return res;
          }
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
    // Only import valid posts
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

        // Map client structures to expected server payload
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
      setParsedPosts([]); // clear on success
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div className="page-header">
        <h1 className="page-title">
          <Settings size={18} />
          <span>System Settings & Tools</span>
        </h1>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "4px", borderBottom: "1px solid var(--border-color)", paddingBottom: "1px" }}>
        <button
          type="button"
          className={`btn btn-sm ${activeTab === "system" ? "btn-primary" : ""}`}
          onClick={() => setActiveTab("system")}
          style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
        >
          Preferences
        </button>
        <button
          type="button"
          className={`btn btn-sm ${activeTab === "import" ? "btn-primary" : ""}`}
          onClick={() => setActiveTab("import")}
          style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
        >
          Import Markdown
        </button>
      </div>

      {/* Preferences Tab Content */}
      {activeTab === "system" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", padding: "16px" }}>
            <h3 style={{ fontSize: "14px", fontWeight: "bold", marginBottom: "8px" }}>System Information</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "12px", fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>
              <div>CMS Mode: Single-User Standalone</div>
              <div>Database Driver: Drizzle ORM + libSQL (Turso)</div>
              <div>Storage Provider: Cloudinary (Direct unsigned uploads)</div>
              <div>Static Rebuilds: Vercel Deploy Hook</div>
            </div>
          </div>

          <div style={{ border: "1px dashed var(--border-color)", padding: "20px", background: "var(--bg-card)", borderRadius: "2px" }}>
            <h3 style={{ fontSize: "14px", marginBottom: "8px", fontWeight: "bold" }}>System Settings Modules</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginBottom: "12px" }}>
              Configuration preferences (security tokens, deploy hooks, styling overrides) are loaded securely from environment variables.
            </p>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)", background: "var(--bg-code)", padding: "6px 12px" }}>
              <Info size={14} />
              <span>To change keys, update your environment variables or target files.</span>
            </div>
          </div>
        </div>
      )}

      {/* Import Tab Content */}
      {activeTab === "import" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
            <h3 style={{ fontSize: "14px", fontWeight: "bold" }}>Markdown Import Tool</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
              Select multiple Hugo markdown posts (<code>.md</code>). The tool will parse YAML/TOML metadata (date, tags, draft status) and verify that all referenced local shortcode image assets exist in your Cloudinary <code>microblog/</code> folder before batch inserting.
            </p>

            <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap", marginTop: "8px" }}>
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
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", padding: "14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "6px" }}>
                <span>{importProgress.status}</span>
                <span>
                  {importProgress.current} / {importProgress.total} posts
                </span>
              </div>
              <div style={{ height: "6px", background: "var(--bg-sidebar)", overflow: "hidden", borderRadius: "3px" }}>
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

          {/* Import Summary & Execution Panel */}
          {totalLoaded > 0 && (
            <div
              style={{
                background: "var(--bg-card)",
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

          {/* Preview Panel List */}
          {totalLoaded > 0 && (
            <div>
              <h3 style={{ fontSize: "13px", fontWeight: "bold", marginBottom: "10px" }}>Import Preview & Validation</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {parsedPosts.map((post, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: "var(--bg-card)",
                      border: "1px solid var(--border-color)",
                      borderLeft: `4px solid ${post.isValid ? "#2e7d32" : "#c62828"}`,
                      padding: "12px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    {/* Header */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
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

                    {/* Metadata summary */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", fontSize: "11px", color: "var(--text-secondary)", borderBottom: "1px solid var(--border-color)", paddingBottom: "6px" }}>
                      <div>Created: {new Date(post.createdAt).toLocaleDateString()}</div>
                      <div>Updated: {new Date(post.updatedAt).toLocaleDateString()}</div>
                      {post.tags.length > 0 && (
                        <div>Tags: {post.tags.join(", ")}</div>
                      )}
                    </div>

                    {/* Images Validation List */}
                    {post.detectedImages.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px", background: "var(--bg-sidebar)", padding: "8px", fontSize: "11px" }}>
                        <div style={{ fontWeight: "bold", marginBottom: "2px" }}>Detected Image Assets:</div>
                        {post.detectedImages.map((img, i) => (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            {img.found ? (
                              <>
                                <Check size={12} style={{ color: "#2e7d32" }} />
                                <span>Attached: <code>microblog/{img.name}</code></span>
                              </>
                            ) : (
                              <>
                                <AlertTriangle size={12} style={{ color: "#c62828" }} />
                                <span style={{ color: "#c62828" }}>
                                  Missing: <code>microblog/{img.name}</code> not found in Cloudinary
                                </span>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Error Messages list */}
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
            </div>
          )}
        </div>
      )}
      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
