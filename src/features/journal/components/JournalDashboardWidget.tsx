"use client";

import React from "react";
import { JournalStats } from "../lib/journal-stats";
import { ENTRY_TYPES, MOODS } from "../lib/journal-helpers";
import { Flame, BookOpen, FileText, Calendar, Star, Smile } from "lucide-react";

export function JournalDashboardWidget({ stats }: { stats: JournalStats }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: "12px",
        marginBottom: "16px",
      }}
    >
      {/* Streak */}
      <div
        style={{
          padding: "14px 16px",
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-color)",
          borderRadius: "8px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <div
          style={{
            padding: "10px",
            borderRadius: "50%",
            backgroundColor: "rgba(249, 115, 22, 0.15)",
            color: "var(--accent)",
          }}
        >
          <Flame size={20} />
        </div>
        <div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>
            Writing Streak
          </div>
          <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--text-primary)" }}>
            {stats.currentStreak} {stats.currentStreak === 1 ? "Day" : "Days"}
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            Best: {stats.longestStreak} days
          </div>
        </div>
      </div>

      {/* Total Entries */}
      <div
        style={{
          padding: "14px 16px",
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-color)",
          borderRadius: "8px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <div
          style={{
            padding: "10px",
            borderRadius: "50%",
            backgroundColor: "rgba(59, 130, 246, 0.15)",
            color: "#3b82f6",
          }}
        >
          <BookOpen size={20} />
        </div>
        <div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>
            Total Entries
          </div>
          <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--text-primary)" }}>
            {stats.totalEntries}
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            {stats.entriesThisMonth} this month
          </div>
        </div>
      </div>

      {/* Total Words */}
      <div
        style={{
          padding: "14px 16px",
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-color)",
          borderRadius: "8px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <div
          style={{
            padding: "10px",
            borderRadius: "50%",
            backgroundColor: "rgba(168, 85, 247, 0.15)",
            color: "#a855f7",
          }}
        >
          <FileText size={20} />
        </div>
        <div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>
            Words Written
          </div>
          <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--text-primary)" }}>
            {stats.totalWords.toLocaleString()}
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            Avg {stats.avgWordsPerEntry} words/entry
          </div>
        </div>
      </div>

      {/* Favorites */}
      <div
        style={{
          padding: "14px 16px",
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-color)",
          borderRadius: "8px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <div
          style={{
            padding: "10px",
            borderRadius: "50%",
            backgroundColor: "rgba(234, 179, 8, 0.15)",
            color: "#eab308",
          }}
        >
          <Star size={20} />
        </div>
        <div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>
            Favorites
          </div>
          <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--text-primary)" }}>
            {stats.favoriteCount}
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            Starred memories
          </div>
        </div>
      </div>
    </div>
  );
}
