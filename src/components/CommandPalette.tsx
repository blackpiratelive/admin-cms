"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { searchEverything, SearchResultItem } from "@/features/search/actions";
import {
  Search,
  MessageSquareText,
  Upload,
  RefreshCw,
  Rocket,
  MapPin,
  Compass,
  FolderPlus,
  Settings,
  X,
  Command,
} from "lucide-react";

export function CommandPalette({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          // Open palette
          window.dispatchEvent(new CustomEvent("open-command-palette"));
        }
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await searchEverything(query);
        setResults(res);
      } finally {
        setLoading(false);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  const navigateTo = (url: string) => {
    onClose();
    router.push(url);
  };

  const quickActions = [
    {
      label: "New Microblog",
      icon: MessageSquareText,
      action: () => navigateTo("/microblog/new"),
    },
    {
      label: "Upload Photos",
      icon: Upload,
      action: () => navigateTo("/gallery"),
    },
    {
      label: "Open Locations",
      icon: MapPin,
      action: () => navigateTo("/locations"),
    },
    {
      label: "Open Trips",
      icon: Compass,
      action: () => navigateTo("/trips"),
    },
    {
      label: "Create Project / Task",
      icon: FolderPlus,
      action: () => navigateTo("/todos"),
    },
    {
      label: "Sync Providers",
      icon: RefreshCw,
      action: () => navigateTo("/sync"),
    },
    {
      label: "System Settings",
      icon: Settings,
      action: () => navigateTo("/settings"),
    },
  ];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "10vh",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "640px",
          backgroundColor: "var(--card-bg, #1a1a1a)",
          border: "1px solid var(--border-color, #333)",
          borderRadius: "12px",
          boxShadow: "0 20px 25px -5px rgba(0,0,0,0.5)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "14px 16px",
            borderBottom: "1px solid var(--border-color, #333)",
            gap: "12px",
          }}
        >
          <Search size={18} style={{ color: "var(--text-muted, #888)" }} />
          <input
            type="text"
            placeholder="Type a command or search everything (Ctrl+K)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            style={{
              flex: 1,
              background: "none",
              border: "none",
              outline: "none",
              color: "var(--text-main, #eee)",
              fontSize: "15px",
            }}
          />
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted, #888)",
              cursor: "pointer",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Search Results or Quick Actions */}
        <div style={{ maxHeight: "380px", overflowY: "auto", padding: "8px 0" }}>
          {query.trim().length > 0 ? (
            <div>
              <div
                style={{
                  padding: "6px 16px",
                  fontSize: "12px",
                  color: "var(--text-muted, #888)",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  fontWeight: 600,
                }}
              >
                Search Results {loading && "(searching...)"}
              </div>
              {results.length === 0 && !loading ? (
                <div style={{ padding: "16px", textAlign: "center", color: "var(--text-muted, #888)" }}>
                  No matching entities found
                </div>
              ) : (
                results.map((res) => (
                  <button
                    key={`${res.type}_${res.id}`}
                    onClick={() => navigateTo(res.url)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 16px",
                      display: "flex",
                      flexDirection: "column",
                      background: "none",
                      border: "none",
                      color: "var(--text-main, #eee)",
                      cursor: "pointer",
                      gap: "2px",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.05)")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 500 }}>
                      <span
                        style={{
                          fontSize: "10px",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          backgroundColor: "var(--accent-color, #ff6600)",
                          color: "#fff",
                          textTransform: "uppercase",
                        }}
                      >
                        {res.type}
                      </span>
                      <span>{res.title}</span>
                    </div>
                    {res.subtitle && (
                      <span style={{ fontSize: "12px", color: "var(--text-muted, #888)", paddingLeft: "42px" }}>
                        {res.subtitle}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          ) : (
            <div>
              <div
                style={{
                  padding: "6px 16px",
                  fontSize: "12px",
                  color: "var(--text-muted, #888)",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  fontWeight: 600,
                }}
              >
                Quick Actions & Navigation
              </div>
              {quickActions.map((qa, index) => {
                const IconComponent = qa.icon;
                return (
                  <button
                    key={index}
                    onClick={qa.action}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 16px",
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      background: "none",
                      border: "none",
                      color: "var(--text-main, #eee)",
                      cursor: "pointer",
                      fontSize: "14px",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.05)")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    <IconComponent size={16} style={{ color: "var(--accent-color, #ff6600)" }} />
                    <span>{qa.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
