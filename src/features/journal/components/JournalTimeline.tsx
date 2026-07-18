"use client";

import React from "react";
import { DecryptedEntryItem } from "../lib/journal-search";
import { ENTRY_TYPES, MOODS } from "../lib/journal-helpers";
import { Star, Clock, MapPin, Compass, Edit3, Trash2, Calendar, Lock } from "lucide-react";

interface JournalTimelineProps {
  items: DecryptedEntryItem[];
  onSelectEntry: (item: DecryptedEntryItem) => void;
  onToggleFavorite: (item: DecryptedEntryItem, e: React.MouseEvent) => void;
  onDeleteEntry: (item: DecryptedEntryItem, e: React.MouseEvent) => void;
}

export function JournalTimeline({
  items,
  onSelectEntry,
  onToggleFavorite,
  onDeleteEntry,
}: JournalTimelineProps) {
  if (items.length === 0) {
    return (
      <div
        style={{
          padding: "48px 24px",
          textAlign: "center",
          backgroundColor: "var(--bg-card, #141416)",
          border: "1px dashed var(--border-color, #27272a)",
          borderRadius: "8px",
          color: "var(--text-muted)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "10px",
        }}
      >
        <Calendar size={32} style={{ opacity: 0.5 }} />
        <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600, color: "var(--text-primary)" }}>
          No Journal Entries Found
        </h3>
        <p style={{ margin: 0, fontSize: "13px", maxWidth: "360px" }}>
          Start journaling your thoughts, memories, and daily reflections. All content is encrypted end-to-end.
        </p>
      </div>
    );
  }

  // Helper for grouping items
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayStr = yesterdayDate.toISOString().split("T")[0];
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const todayItems: DecryptedEntryItem[] = [];
  const yesterdayItems: DecryptedEntryItem[] = [];
  const thisWeekItems: DecryptedEntryItem[] = [];
  const thisMonthItems: DecryptedEntryItem[] = [];
  const olderItems: DecryptedEntryItem[] = [];

  for (const item of items) {
    const d = item.record.entryDate;
    if (d === todayStr) {
      todayItems.push(item);
    } else if (d === yesterdayStr) {
      yesterdayItems.push(item);
    } else if (d >= sevenDaysAgo) {
      thisWeekItems.push(item);
    } else if (d >= thirtyDaysAgo) {
      thisMonthItems.push(item);
    } else {
      olderItems.push(item);
    }
  }

  const sections = [
    { title: "Today", items: todayItems },
    { title: "Yesterday", items: yesterdayItems },
    { title: "This Week", items: thisWeekItems },
    { title: "This Month", items: thisMonthItems },
    { title: "Earlier Memories", items: olderItems },
  ].filter((s) => s.items.length > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {sections.map((section) => (
        <div key={section.title} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div
            style={{
              fontSize: "12px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              color: "var(--accent)",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span>{section.title}</span>
            <div style={{ flex: 1, height: "1px", backgroundColor: "var(--border-color)" }} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "12px" }}>
            {section.items.map((item) => {
              const rec = item.record;
              const content = item.content;
              const typeDef = ENTRY_TYPES.find((t) => t.id === rec.entryType);
              const moodDef = MOODS.find((m) => m.id === rec.mood);

              return (
                <div
                  key={rec.id}
                  onClick={() => onSelectEntry(item)}
                  style={{
                    padding: "16px 20px",
                    backgroundColor: "var(--bg-card)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "8px",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                    transition: "border-color 0.15s ease, transform 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--accent)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--border-color)";
                  }}
                >
                  {/* Top metadata line */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: "8px",
                      fontSize: "12px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: "4px",
                          backgroundColor: "rgba(249, 115, 22, 0.12)",
                          color: "var(--accent)",
                          fontWeight: 600,
                          fontSize: "11px",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        {typeDef?.icon || "📖"} {typeDef?.label || rec.entryType}
                      </span>

                      {moodDef && (
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: "4px",
                            backgroundColor: "var(--bg-input)",
                            border: "1px solid var(--border-color)",
                            fontSize: "11px",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          {moodDef.emoji} {moodDef.label}
                        </span>
                      )}

                      <span style={{ color: "var(--text-muted)" }}>{rec.entryDate}</span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px" }}>
                        <Clock size={12} />
                        {rec.wordCount} words ({rec.readingTime} min)
                      </span>

                      <button
                        onClick={(e) => onToggleFavorite(item, e)}
                        title={rec.favorite ? "Unstar" : "Star"}
                        style={{
                          background: "none",
                          border: "none",
                          color: rec.favorite ? "#eab308" : "var(--text-muted)",
                          cursor: "pointer",
                          display: "flex",
                        }}
                      >
                        <Star size={16} fill={rec.favorite ? "#eab308" : "none"} />
                      </button>

                      <button
                        onClick={(e) => onDeleteEntry(item, e)}
                        title="Delete entry"
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--text-muted)",
                          cursor: "pointer",
                          display: "flex",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "#f87171")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Title & snippet */}
                  <div>
                    <h3 style={{ margin: "0 0 6px 0", fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>
                      {content?.title || "Untitled Journal Entry"}
                    </h3>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "13px",
                        lineHeight: 1.6,
                        color: "var(--text-secondary)",
                        display: "-webkit-box",
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {item.plaintextBody || content?.privateNotes || "(Empty entry)"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
