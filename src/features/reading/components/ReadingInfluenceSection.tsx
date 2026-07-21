"use client";

import { useEffect, useState } from "react";
import { getReadingAroundTimeAction, ReadingArticleDTO } from "../actions";
import { BookOpen, ExternalLink, Sparkles, Star } from "lucide-react";

export function ReadingInfluenceSection({
  date,
  endDate,
  title = "Reading Around This Time",
}: {
  date: string;
  endDate?: string;
  title?: string;
}) {
  const [articles, setArticles] = useState<ReadingArticleDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!date) return;
      setLoading(true);
      try {
        const res = await getReadingAroundTimeAction(date, endDate);
        if (active) setArticles(res);
      } catch (err) {
        console.error("Reading influence load error:", err);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [date, endDate]);

  if (!loading && articles.length === 0) return null;

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-color)",
        borderRadius: "4px",
        padding: "16px",
        margin: "24px 0",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
        <Sparkles size={16} style={{ color: "var(--accent)" }} />
        <h3 style={{ fontSize: "14px", fontWeight: "bold", color: "var(--text-primary)" }}>{title}</h3>
      </div>
      <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "12px" }}>
        Articles read and starred around this timeframe that may have influenced thoughts or activities.
      </p>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ height: "16px", background: "var(--bg-hover)", borderRadius: "2px", width: "75%" }} />
          <div style={{ height: "16px", background: "var(--bg-hover)", borderRadius: "2px", width: "50%" }} />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {articles.map((art) => (
            <div
              key={art.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 10px",
                borderRadius: "2px",
                borderBottom: "1px solid var(--border-color)",
                fontSize: "13px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0, paddingRight: "12px" }}>
                <BookOpen size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                <a
                  href={art.originalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: "var(--text-primary)",
                    fontWeight: "500",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {art.title}
                </a>
                {art.isStarred && <Star size={13} style={{ fill: "#f59e0b", color: "#f59e0b", flexShrink: 0 }} />}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "11px", color: "var(--text-muted)", flexShrink: 0 }}>
                <span style={{ background: "var(--bg-sidebar)", padding: "2px 6px", borderRadius: "2px", border: "1px solid var(--border-color)" }}>
                  {art.feedName || art.category || "RSS"}
                </span>
                <a
                  href={art.originalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Open article in new tab"
                  style={{ color: "var(--text-muted)" }}
                >
                  <ExternalLink size={14} />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
