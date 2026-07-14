"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { searchEverything, SearchResultItem } from "@/features/search/actions";
import {
  Search,
  MessageSquareText,
  Upload,
  RefreshCw,
  MapPin,
  Compass,
  FolderPlus,
  Settings,
  X,
} from "lucide-react";

export function CommandPalette({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!query.trim()) {
      requestId.current += 1;
      setLoading(false);
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      const currentRequest = ++requestId.current;
      setLoading(true);
      try {
        const res = await searchEverything(query);
        if (currentRequest === requestId.current) setResults(res);
      } finally {
        if (currentRequest === requestId.current) setLoading(false);
      }
    }, 250);

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
        backgroundColor: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(2px)",
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
          maxWidth: "600px",
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-color)",
          borderRadius: "4px",
          boxShadow: "0 10px 25px -5px rgba(0,0,0,0.3)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          color: "var(--text-primary)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "12px 16px",
            borderBottom: "1px solid var(--border-color)",
            gap: "12px",
          }}
        >
          <Search size={16} style={{ color: "var(--text-muted)" }} />
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
              color: "var(--text-primary)",
              fontSize: "14px",
            }}
          />
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Search Results or Quick Actions */}
        <div style={{ maxHeight: "360px", overflowY: "auto", padding: "6px 0" }}>
          {query.trim().length > 0 ? (
            <div>
              <div
                style={{
                  padding: "6px 16px",
                  fontSize: "11px",
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  fontWeight: 700,
                }}
              >
                Search Results {loading && "(searching...)"}
              </div>
              {results.length === 0 && !loading ? (
                <div style={{ padding: "16px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
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
                      padding: "8px 16px",
                      display: "flex",
                      flexDirection: "column",
                      background: "none",
                      border: "none",
                      color: "var(--text-primary)",
                      cursor: "pointer",
                      gap: "2px",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-hover)")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 500, fontSize: "13px" }}>
                      <span
                        className="status-badge"
                        style={{
                          backgroundColor: "var(--accent)",
                          color: "var(--accent-text)",
                          fontSize: "9px",
                        }}
                      >
                        {res.type}
                      </span>
                      <span>{res.title}</span>
                    </div>
                    {res.subtitle && (
                      <span style={{ fontSize: "12px", color: "var(--text-muted)", paddingLeft: "42px" }}>
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
                  fontSize: "11px",
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  fontWeight: 700,
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
                      padding: "8px 16px",
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      background: "none",
                      border: "none",
                      color: "var(--text-primary)",
                      cursor: "pointer",
                      fontSize: "13px",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-hover)")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    <IconComponent size={15} style={{ color: "var(--accent)" }} />
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
