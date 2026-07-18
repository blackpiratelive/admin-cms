"use client";

import React, { useState } from "react";
import {
  type ShortLink,
  type ShortDomain,
  type PasteItem,
} from "@/db/schema";
import {
  createShortLink,
  updateShortLink,
  deleteShortLink,
  createPaste,
  deletePaste,
  addDomain,
  deleteDomain,
} from "./actions";
import { notify } from "@/lib/notifications";
import {
  Link2,
  FileText,
  Globe,
  Plus,
  Search,
  Copy,
  Check,
  Trash2,
  Edit3,
  ExternalLink,
  Lock,
  Clock,
  Sparkles,
  Loader2,
  X,
} from "lucide-react";

interface LinksDashboardProps {
  initialLinks: ShortLink[];
  initialPastes: PasteItem[];
  initialDomains: ShortDomain[];
  apiStatus?: {
    isConfigured: boolean;
    baseUrl: string | null;
  };
}

export function LinksDashboard({
  initialLinks,
  initialPastes,
  initialDomains,
  apiStatus,
}: LinksDashboardProps) {
  const [activeTab, setActiveTab] = useState<"links" | "pastes" | "domains">("links");
  const [linksList, setLinksList] = useState<ShortLink[]>(initialLinks);
  const [pastesList, setPastesList] = useState<PasteItem[]>(initialPastes);
  const [domainsList, setDomainsList] = useState<ShortDomain[]>(initialDomains);

  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal control states
  const [showNewLinkModal, setShowNewLinkModal] = useState(false);
  const [editingLink, setEditingLink] = useState<ShortLink | null>(null);
  const [showNewPasteModal, setShowNewPasteModal] = useState(false);
  const [showAddDomainModal, setShowAddDomainModal] = useState(false);

  // Loading states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingSlug, setDeletingSlug] = useState<string | null>(null);
  const [deletingDomain, setDeletingDomain] = useState<string | null>(null);

  // Form states
  const [linkForm, setLinkForm] = useState({
    url: "",
    slug: "",
    hostname: initialDomains[0]?.hostname || "lnk.to",
    password: "",
  });

  const [editLinkForm, setEditLinkForm] = useState({
    url: "",
    slug: "",
    hostname: "",
    password: "",
    keepExistingPassword: true,
  });

  const [pasteForm, setPasteForm] = useState({
    content: "",
    slug: "",
    hostname: initialDomains[0]?.hostname || "lnk.to",
    password: "",
    expires: "never" as "never" | "1hour" | "1day" | "1week",
  });

  const [newDomainHost, setNewDomainHost] = useState("");

  // Metrics
  const totalClicks = linksList.reduce((acc, l) => acc + (l.clickCount || 0), 0);
  const activePastesCount = pastesList.filter((p) => {
    if (!p.expiresAt) return true;
    return new Date(p.expiresAt) > new Date();
  }).length;

  // Copy to clipboard helper
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Generate short slug helper
  const handleGenerateSlug = () => {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let gen = "";
    for (let i = 0; i < 7; i++) {
      gen += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setLinkForm((prev) => ({ ...prev, slug: gen }));
  };

  // Create Short Link handler
  const handleCreateLinkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const currentForm = { ...linkForm };
    setShowNewLinkModal(false);
    setLinkForm({
      url: "",
      slug: "",
      hostname: domainsList[0]?.hostname || "lnk.to",
      password: "",
    });

    notify.bg({
      title: "Create Short Link",
      loadingMessage: "Creating short link in background...",
      successMessage: (res: any) => `Short link /${res.slug || currentForm.slug} created successfully!`,
      errorMessage: (err) => `Failed to create short link: ${err?.message || String(err)}`,
      task: () => createShortLink(currentForm),
      onSuccess: (res) => {
        if (res.success && res.slug) {
          const newRecord: ShortLink = {
            slug: res.slug,
            url: currentForm.url.trim(),
            hostname: currentForm.hostname,
            clickCount: 0,
            password: currentForm.password.trim() ? "hashed" : null,
            createdAt: new Date().toISOString(),
          };
          setLinksList((prev) => [newRecord, ...prev]);
        } else {
          notify.show({
            type: "error",
            title: "Create Failed",
            message: res.error || "Failed to create short link.",
          });
        }
      },
    });
  };

  // Open Edit Link Modal
  const handleOpenEditLink = (link: ShortLink) => {
    setEditingLink(link);
    setEditLinkForm({
      url: link.url,
      slug: link.slug,
      hostname: link.hostname,
      password: "",
      keepExistingPassword: true,
    });
  };

  // Edit Link submit handler
  const handleEditLinkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLink) return;
    const currentLink = editingLink;
    const currentForm = { ...editLinkForm };

    setEditingLink(null);

    const passwordValue = currentForm.keepExistingPassword
      ? undefined
      : currentForm.password;

    notify.bg({
      title: "Update Short Link",
      loadingMessage: `Updating link /${currentLink.slug} in background...`,
      successMessage: `Short link /${currentForm.slug || currentLink.slug} updated successfully!`,
      errorMessage: (err) => `Failed to update short link: ${err?.message || String(err)}`,
      task: () =>
        updateShortLink({
          originalSlug: currentLink.slug,
          newSlug: currentForm.slug,
          url: currentForm.url,
          hostname: currentForm.hostname,
          password: passwordValue,
        }),
      onSuccess: (res) => {
        if (res.success && res.slug) {
          setLinksList((prev) =>
            prev.map((l) =>
              l.slug === currentLink.slug
                ? {
                    ...l,
                    slug: res.slug!,
                    url: currentForm.url.trim(),
                    hostname: currentForm.hostname,
                    password: passwordValue !== undefined
                      ? (passwordValue ? "hashed" : null)
                      : l.password,
                  }
                : l
            )
          );
        } else {
          notify.show({
            type: "error",
            title: "Update Failed",
            message: res.error || "Failed to update short link.",
          });
        }
      },
    });
  };

  // Delete Link handler
  const handleDeleteLink = (slug: string) => {
    if (!confirm(`Delete short link "/${slug}"?`)) return;
    setLinksList((prev) => prev.filter((l) => l.slug !== slug));

    notify.bg({
      title: "Delete Short Link",
      loadingMessage: `Deleting link /${slug}...`,
      successMessage: `Short link /${slug} deleted.`,
      errorMessage: "Failed to delete short link.",
      task: () => deleteShortLink(slug),
    });
  };

  // Create Paste handler
  const handleCreatePasteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const currentForm = { ...pasteForm };
    setShowNewPasteModal(false);
    setPasteForm({
      content: "",
      slug: "",
      hostname: domainsList[0]?.hostname || "lnk.to",
      password: "",
      expires: "never",
    });

    notify.bg({
      title: "Create Paste",
      loadingMessage: "Creating markdown paste in background...",
      successMessage: (res: any) => `Paste /p/${res.slug || currentForm.slug} created successfully!`,
      errorMessage: (err) => `Failed to create paste: ${err?.message || String(err)}`,
      task: () => createPaste(currentForm),
      onSuccess: (res) => {
        if (res.success && res.slug) {
          let expiresAt: string | null = null;
          if (currentForm.expires !== "never") {
            const now = new Date();
            if (currentForm.expires === "1hour") now.setHours(now.getHours() + 1);
            if (currentForm.expires === "1day") now.setDate(now.getDate() + 1);
            if (currentForm.expires === "1week") now.setDate(now.getDate() + 7);
            expiresAt = now.toISOString();
          }

          const newRecord: PasteItem = {
            slug: res.slug,
            content: currentForm.content,
            hostname: currentForm.hostname,
            password: currentForm.password ? "hashed" : null,
            expiresAt,
            createdAt: new Date().toISOString(),
          };

          setPastesList((prev) => [newRecord, ...prev]);
        } else {
          notify.show({
            type: "error",
            title: "Create Failed",
            message: res.error || "Failed to create paste.",
          });
        }
      },
    });
  };

  // Delete Paste handler
  const handleDeletePaste = (slug: string) => {
    if (!confirm(`Delete markdown paste "/p/${slug}"?`)) return;
    setPastesList((prev) => prev.filter((p) => p.slug !== slug));

    notify.bg({
      title: "Delete Paste",
      loadingMessage: `Deleting paste /p/${slug}...`,
      successMessage: `Paste /p/${slug} deleted.`,
      errorMessage: "Failed to delete paste.",
      task: () => deletePaste(slug),
    });
  };

  // Add Domain handler
  const handleAddDomainSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomainHost.trim()) return;
    const domainHost = newDomainHost.trim();
    setShowAddDomainModal(false);
    setNewDomainHost("");

    notify.bg({
      title: "Add Domain",
      loadingMessage: `Adding domain '${domainHost}'...`,
      successMessage: `Domain '${domainHost}' added successfully!`,
      errorMessage: (err) => `Failed to add domain: ${err?.message || String(err)}`,
      task: () => addDomain(domainHost),
      onSuccess: (res) => {
        if (res.success && res.hostname) {
          const newRecord: ShortDomain = {
            hostname: res.hostname,
            addedAt: new Date().toISOString(),
          };
          setDomainsList((prev) => [...prev, newRecord]);
        } else {
          notify.show({
            type: "error",
            title: "Add Failed",
            message: res.error || "Failed to add domain.",
          });
        }
      },
    });
  };

  // Delete Domain handler
  const handleDeleteDomain = (hostname: string) => {
    if (!confirm(`Delete domain "${hostname}"?`)) return;
    setDomainsList((prev) => prev.filter((d) => d.hostname !== hostname));

    notify.bg({
      title: "Delete Domain",
      loadingMessage: `Deleting domain '${hostname}'...`,
      successMessage: `Domain '${hostname}' deleted.`,
      errorMessage: "Failed to delete domain.",
      task: () => deleteDomain(hostname),
    });
  };

  // Filter lists
  const filteredLinks = linksList.filter(
    (l) =>
      !search.trim() ||
      l.slug.toLowerCase().includes(search.toLowerCase()) ||
      l.url.toLowerCase().includes(search.toLowerCase()) ||
      l.hostname.toLowerCase().includes(search.toLowerCase())
  );

  const filteredPastes = pastesList.filter(
    (p) =>
      !search.trim() ||
      p.slug.toLowerCase().includes(search.toLowerCase()) ||
      p.content.toLowerCase().includes(search.toLowerCase()) ||
      p.hostname.toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Header & Quick Action */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Link2 size={20} />
            <span>URL Shortener & Pastebin Manager</span>
          </h1>
          {apiStatus && (
            <div style={{ marginTop: "4px", fontSize: "12px" }}>
              {apiStatus.isConfigured ? (
                <span className="status-badge status-published" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <Globe size={12} /> Connected to Remote Service API: <code>{apiStatus.baseUrl}</code>
                </span>
              ) : (
                <span className="status-badge status-draft" style={{ background: "#fff3e0", color: "#e65100", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  Local DB Fallback (Set <code>RAPIDLINK_API_URL</code> & <code>RAPIDLINK_API_KEY</code> in Vercel to sync with your deployment)
                </span>
              )}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          {activeTab === "links" && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowNewLinkModal(true)}
            >
              <Plus size={16} />
              <span>Create Short Link</span>
            </button>
          )}

          {activeTab === "pastes" && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowNewPasteModal(true)}
            >
              <Plus size={16} />
              <span>New Markdown Paste</span>
            </button>
          )}

          {activeTab === "domains" && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowAddDomainModal(true)}
            >
              <Plus size={16} />
              <span>Add Custom Domain</span>
            </button>
          )}
        </div>
      </div>

      {/* Metrics Overview Cards */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="metric-label">Total Short Links</span>
            <Link2 size={16} style={{ color: "var(--accent)" }} />
          </div>
          <div className="metric-value">{linksList.length}</div>
        </div>

        <div className="metric-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="metric-label">Aggregated Clicks</span>
            <ExternalLink size={16} style={{ color: "var(--accent)" }} />
          </div>
          <div className="metric-value">{totalClicks.toLocaleString()}</div>
        </div>

        <div className="metric-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="metric-label">Active Pastes</span>
            <FileText size={16} style={{ color: "var(--accent)" }} />
          </div>
          <div className="metric-value">{activePastesCount}</div>
        </div>

        <div className="metric-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="metric-label">Custom Domains</span>
            <Globe size={16} style={{ color: "var(--accent)" }} />
          </div>
          <div className="metric-value">{domainsList.length}</div>
        </div>
      </div>

      {/* Navigation Tabs Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: "1px", flexWrap: "wrap", gap: "12px" }}>
        <div style={{ display: "flex", gap: "4px" }}>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === "links" ? "btn-primary" : ""}`}
            onClick={() => setActiveTab("links")}
          >
            <Link2 size={14} /> Short Links ({linksList.length})
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === "pastes" ? "btn-primary" : ""}`}
            onClick={() => setActiveTab("pastes")}
          >
            <FileText size={14} /> Markdown Pastes ({pastesList.length})
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === "domains" ? "btn-primary" : ""}`}
            onClick={() => setActiveTab("domains")}
          >
            <Globe size={14} /> Domains ({domainsList.length})
          </button>
        </div>

        {activeTab !== "domains" && (
          <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: "220px" }}>
            <Search size={14} style={{ color: "var(--text-muted)" }} />
            <input
              type="text"
              placeholder={`Search ${activeTab === "links" ? "links & slugs..." : "pastes & content..."}`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="search-input"
              style={{ width: "100%" }}
            />
          </div>
        )}
      </div>

      {/* TAB 1: SHORT LINKS */}
      {activeTab === "links" && (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Short URL & Destination</th>
                <th>Domain</th>
                <th>Clicks</th>
                <th className="hide-on-mobile">Protected</th>
                <th className="hide-on-mobile">Created</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLinks.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "32px", color: "var(--text-muted)" }}>
                    No short links found. Create your first short link above!
                  </td>
                </tr>
              ) : (
                filteredLinks.map((link) => {
                  const shortUrl = `https://${link.hostname}/${link.slug}`;
                  const isCopied = copiedId === link.slug;
                  const isDeleting = deletingSlug === link.slug;

                  return (
                    <tr key={link.slug}>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700 }}>
                            <span style={{ color: "var(--accent)" }}>/{link.slug}</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(shortUrl, link.slug)}
                              style={{ border: "none", background: "none", cursor: "pointer", color: "var(--text-muted)", padding: 0 }}
                              title="Copy Short URL"
                            >
                              {isCopied ? <Check size={13} style={{ color: "#2e7d32" }} /> : <Copy size={13} />}
                            </button>
                          </div>
                          <div
                            style={{
                              fontSize: "12px",
                              color: "var(--text-secondary)",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              maxWidth: "380px",
                            }}
                          >
                            <a href={link.url} target="_blank" rel="noreferrer" style={{ color: "inherit", textDecoration: "none" }}>
                              {link.url}
                            </a>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: "12px", fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>
                          {link.hostname}
                        </span>
                      </td>
                      <td>
                        <span className="badge" style={{ background: "var(--bg-sidebar)", border: "1px solid var(--border-color)" }}>
                          {link.clickCount} clicks
                        </span>
                      </td>
                      <td className="hide-on-mobile">
                        {link.password ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "var(--accent)" }}>
                            <Lock size={12} /> Password Required
                          </span>
                        ) : (
                          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Public</span>
                        )}
                      </td>
                      <td className="hide-on-mobile" style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                        {formatDate(link.createdAt)}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "6px" }}>
                          <button
                            type="button"
                            onClick={() => handleOpenEditLink(link)}
                            className="btn btn-sm"
                            title="Edit Link"
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteLink(link.slug)}
                            className="btn btn-sm btn-danger"
                            disabled={isDeleting}
                            title="Delete Link"
                          >
                            {isDeleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 2: MARKDOWN PASTES */}
      {activeTab === "pastes" && (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Paste Identifier & Excerpt</th>
                <th>Domain</th>
                <th className="hide-on-mobile">Expiration</th>
                <th className="hide-on-mobile">Protected</th>
                <th className="hide-on-mobile">Created</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPastes.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "32px", color: "var(--text-muted)" }}>
                    No pastes found. Create your first markdown paste above!
                  </td>
                </tr>
              ) : (
                filteredPastes.map((paste) => {
                  const pasteUrl = `https://${paste.hostname}/p/${paste.slug}`;
                  const isCopied = copiedId === paste.slug;
                  const isDeleting = deletingSlug === paste.slug;
                  const isExpired = paste.expiresAt ? new Date(paste.expiresAt) < new Date() : false;
                  const excerpt = paste.content.length > 50 ? paste.content.slice(0, 50) + "..." : paste.content;

                  return (
                    <tr key={paste.slug}>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700 }}>
                            <span style={{ color: "var(--accent)" }}>/p/{paste.slug}</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(pasteUrl, paste.slug)}
                              style={{ border: "none", background: "none", cursor: "pointer", color: "var(--text-muted)", padding: 0 }}
                              title="Copy Paste Link"
                            >
                              {isCopied ? <Check size={13} style={{ color: "#2e7d32" }} /> : <Copy size={13} />}
                            </button>
                          </div>
                          <div style={{ fontSize: "12px", color: "var(--text-secondary)", fontStyle: "italic" }}>
                            "{excerpt}"
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: "12px", fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>
                          {paste.hostname}
                        </span>
                      </td>
                      <td className="hide-on-mobile">
                        {isExpired ? (
                          <span className="status-badge status-draft" style={{ background: "#ffebee", color: "#c62828" }}>
                            Expired
                          </span>
                        ) : paste.expiresAt ? (
                          <span style={{ fontSize: "11px", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "4px" }}>
                            <Clock size={12} /> {formatDate(paste.expiresAt)}
                          </span>
                        ) : (
                          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Never</span>
                        )}
                      </td>
                      <td className="hide-on-mobile">
                        {paste.password ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "var(--accent)" }}>
                            <Lock size={12} /> Password Required
                          </span>
                        ) : (
                          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Public</span>
                        )}
                      </td>
                      <td className="hide-on-mobile" style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                        {formatDate(paste.createdAt)}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          type="button"
                          onClick={() => handleDeletePaste(paste.slug)}
                          className="btn btn-sm btn-danger"
                          disabled={isDeleting}
                          title="Delete Paste"
                        >
                          {isDeleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 3: CUSTOM DOMAINS */}
      {activeTab === "domains" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", padding: "16px", borderRadius: "4px" }}>
            <h3 style={{ fontSize: "14px", fontWeight: "bold", marginBottom: "4px" }}>Active Shortener Domains</h3>
            <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              Custom domains associated with your RapidLink deployment. When creating links or pastes, you can select which hostname to bind them to.
            </p>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Hostname Domain</th>
                  <th>Added On</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {domainsList.map((dom) => {
                  const isDeleting = deletingDomain === dom.hostname;
                  return (
                    <tr key={dom.hostname}>
                      <td style={{ fontWeight: 700, fontSize: "14px", fontFamily: "var(--font-mono)" }}>
                        {dom.hostname}
                      </td>
                      <td style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                        {formatDate(dom.addedAt)}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          type="button"
                          onClick={() => handleDeleteDomain(dom.hostname)}
                          className="btn btn-sm btn-danger"
                          disabled={isDeleting || domainsList.length <= 1}
                          title={domainsList.length <= 1 ? "Cannot delete last domain" : "Delete Domain"}
                        >
                          {isDeleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: CREATE SHORT LINK */}
      {showNewLinkModal && (
        <div
          onClick={() => setShowNewLinkModal(false)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.85)",
            backdropFilter: "blur(4px)",
            zIndex: 1010,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <form
            onSubmit={handleCreateLinkSubmit}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              borderRadius: "4px",
              maxWidth: "540px",
              width: "100%",
              display: "flex",
              flexDirection: "column",
              padding: "20px",
              gap: "16px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: "12px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: "bold", margin: 0 }}>Create Short Link</h3>
              <button type="button" onClick={() => setShowNewLinkModal(false)} className="btn btn-sm">
                <X size={16} />
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">Destination URL</label>
              <input
                type="url"
                className="text-input"
                placeholder="https://example.com/long-page-url..."
                value={linkForm.url}
                onChange={(e) => setLinkForm((prev) => ({ ...prev, url: e.target.value }))}
                required
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div className="form-group">
                <label className="form-label">Custom Slug (optional)</label>
                <div style={{ display: "flex", gap: "6px" }}>
                  <input
                    type="text"
                    className="text-input"
                    placeholder="e.g. my-link"
                    value={linkForm.slug}
                    onChange={(e) => setLinkForm((prev) => ({ ...prev, slug: e.target.value }))}
                  />
                  <button type="button" onClick={handleGenerateSlug} className="btn btn-sm" title="Auto-generate slug">
                    <Sparkles size={14} />
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Domain</label>
                <select
                  className="select-input"
                  value={linkForm.hostname}
                  onChange={(e) => setLinkForm((prev) => ({ ...prev, hostname: e.target.value }))}
                >
                  {domainsList.map((d) => (
                    <option key={d.hostname} value={d.hostname}>
                      {d.hostname}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Optional Password Protection</label>
              <input
                type="password"
                className="text-input"
                placeholder="Leave empty for public redirect..."
                value={linkForm.password}
                onChange={(e) => setLinkForm((prev) => ({ ...prev, password: e.target.value }))}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", paddingTop: "12px", borderTop: "1px solid var(--border-color)" }}>
              <button type="button" onClick={() => setShowNewLinkModal(false)} className="btn">
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                <span>{isSubmitting ? "Creating..." : "Create Short Link"}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 2: EDIT SHORT LINK */}
      {editingLink && (
        <div
          onClick={() => setEditingLink(null)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.85)",
            backdropFilter: "blur(4px)",
            zIndex: 1010,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <form
            onSubmit={handleEditLinkSubmit}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              borderRadius: "4px",
              maxWidth: "540px",
              width: "100%",
              display: "flex",
              flexDirection: "column",
              padding: "20px",
              gap: "16px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: "12px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: "bold", margin: 0 }}>Edit Link: /{editingLink.slug}</h3>
              <button type="button" onClick={() => setEditingLink(null)} className="btn btn-sm">
                <X size={16} />
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">Destination URL</label>
              <input
                type="url"
                className="text-input"
                value={editLinkForm.url}
                onChange={(e) => setEditLinkForm((prev) => ({ ...prev, url: e.target.value }))}
                required
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div className="form-group">
                <label className="form-label">Slug</label>
                <input
                  type="text"
                  className="text-input"
                  value={editLinkForm.slug}
                  onChange={(e) => setEditLinkForm((prev) => ({ ...prev, slug: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Domain</label>
                <select
                  className="select-input"
                  value={editLinkForm.hostname}
                  onChange={(e) => setEditLinkForm((prev) => ({ ...prev, hostname: e.target.value }))}
                >
                  {domainsList.map((d) => (
                    <option key={d.hostname} value={d.hostname}>
                      {d.hostname}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Password Protection</label>
              {editLinkForm.keepExistingPassword && editingLink.password ? (
                <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13px" }}>
                  <span style={{ color: "var(--accent)" }}>✓ Password set</span>
                  <button
                    type="button"
                    onClick={() => setEditLinkForm((prev) => ({ ...prev, keepExistingPassword: false }))}
                    className="btn btn-sm"
                  >
                    Change / Clear Password
                  </button>
                </div>
              ) : (
                <input
                  type="password"
                  className="text-input"
                  placeholder="Enter new password (leave empty to clear password)..."
                  value={editLinkForm.password}
                  onChange={(e) => setEditLinkForm((prev) => ({ ...prev, password: e.target.value }))}
                />
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", paddingTop: "12px", borderTop: "1px solid var(--border-color)" }}>
              <button type="button" onClick={() => setEditingLink(null)} className="btn">
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                <span>{isSubmitting ? "Saving..." : "Save Changes"}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 3: NEW MARKDOWN PASTE */}
      {showNewPasteModal && (
        <div
          onClick={() => setShowNewPasteModal(false)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.85)",
            backdropFilter: "blur(4px)",
            zIndex: 1010,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <form
            onSubmit={handleCreatePasteSubmit}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              borderRadius: "4px",
              maxWidth: "680px",
              width: "100%",
              display: "flex",
              flexDirection: "column",
              padding: "20px",
              gap: "16px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: "12px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: "bold", margin: 0 }}>New Markdown Paste</h3>
              <button type="button" onClick={() => setShowNewPasteModal(false)} className="btn btn-sm">
                <X size={16} />
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">Paste Content (Markdown Supported)</label>
              <textarea
                className="text-input"
                rows={8}
                placeholder="Paste code snippets, raw text, or markdown documentation here..."
                value={pasteForm.content}
                onChange={(e) => setPasteForm((prev) => ({ ...prev, content: e.target.value }))}
                required
                style={{ fontFamily: "var(--font-mono)", fontSize: "13px" }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
              <div className="form-group">
                <label className="form-label">Domain</label>
                <select
                  className="select-input"
                  value={pasteForm.hostname}
                  onChange={(e) => setPasteForm((prev) => ({ ...prev, hostname: e.target.value }))}
                >
                  {domainsList.map((d) => (
                    <option key={d.hostname} value={d.hostname}>
                      {d.hostname}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Expiration</label>
                <select
                  className="select-input"
                  value={pasteForm.expires}
                  onChange={(e) => setPasteForm((prev) => ({ ...prev, expires: e.target.value as any }))}
                >
                  <option value="never">Never Expire</option>
                  <option value="1hour">1 Hour</option>
                  <option value="1day">1 Day</option>
                  <option value="1week">1 Week</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Password Protection</label>
                <input
                  type="password"
                  className="text-input"
                  placeholder="Optional..."
                  value={pasteForm.password}
                  onChange={(e) => setPasteForm((prev) => ({ ...prev, password: e.target.value }))}
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", paddingTop: "12px", borderTop: "1px solid var(--border-color)" }}>
              <button type="button" onClick={() => setShowNewPasteModal(false)} className="btn">
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                <span>{isSubmitting ? "Creating..." : "Create Paste"}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 4: ADD CUSTOM DOMAIN */}
      {showAddDomainModal && (
        <div
          onClick={() => setShowAddDomainModal(false)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.85)",
            backdropFilter: "blur(4px)",
            zIndex: 1010,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <form
            onSubmit={handleAddDomainSubmit}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              borderRadius: "4px",
              maxWidth: "460px",
              width: "100%",
              display: "flex",
              flexDirection: "column",
              padding: "20px",
              gap: "16px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: "12px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: "bold", margin: 0 }}>Add Custom Domain</h3>
              <button type="button" onClick={() => setShowAddDomainModal(false)} className="btn btn-sm">
                <X size={16} />
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">Domain Hostname</label>
              <input
                type="text"
                className="text-input"
                placeholder="e.g. go.mywebsite.com or short.link"
                value={newDomainHost}
                onChange={(e) => setNewDomainHost(e.target.value)}
                required
              />
              <span style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "4px" }}>
                Make sure your DNS CNAME / Vercel domain alias points to your RapidLink backend service.
              </span>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", paddingTop: "12px", borderTop: "1px solid var(--border-color)" }}>
              <button type="button" onClick={() => setShowAddDomainModal(false)} className="btn">
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                <span>{isSubmitting ? "Adding..." : "Add Domain"}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
