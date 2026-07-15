"use client";

import Link from "next/link";
import { UpcomingBirthdayItem } from "@/features/people/actions";
import { Calendar, Gift, ChevronRight, User } from "lucide-react";

interface UpcomingBirthdaysWidgetProps {
  items: UpcomingBirthdayItem[];
}

export function UpcomingBirthdaysWidget({ items }: UpcomingBirthdaysWidgetProps) {
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border-color)",
        borderRadius: "8px",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Gift size={16} style={{ color: "var(--accent)" }} />
          <h2 style={{ fontSize: "14px", fontWeight: 700, margin: 0 }}>
            Upcoming Important Dates & Birthdays
          </h2>
        </div>
        <Link
          href="/people"
          style={{
            fontSize: "12px",
            color: "var(--accent)",
            display: "flex",
            alignItems: "center",
            gap: "2px",
            textDecoration: "none",
          }}
        >
          <span>View All</span>
          <ChevronRight size={14} />
        </Link>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
        {items.map((item, idx) => (
          <Link
            key={`${item.personId}_${idx}`}
            href={`/people/${item.slug}`}
            style={{
              textDecoration: "none",
              color: "inherit",
              flex: "1 1 200px",
              minWidth: "180px",
              backgroundColor: "var(--bg-hover)",
              border: "1px solid var(--border-color)",
              borderRadius: "6px",
              padding: "10px 12px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              transition: "transform 0.15s ease, border-color 0.15s ease",
            }}
          >
            {item.avatarUrl ? (
              <img
                src={item.avatarUrl}
                alt={item.displayName}
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: "1px solid var(--border-color)",
                  flexShrink: 0,
                }}
              />
            ) : (
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  backgroundColor: "var(--accent)",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: "13px",
                  flexShrink: 0,
                }}
              >
                {item.displayName.charAt(0).toUpperCase()}
              </div>
            )}

            <div style={{ flex: 1, overflow: "hidden" }}>
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {item.displayName}
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", display: "flex", gap: "6px" }}>
                <span>{item.title}</span>
                <span>•</span>
                <span style={{ fontWeight: 600, color: item.daysRemaining === 0 ? "#ef4444" : "var(--accent)" }}>
                  {item.daysRemaining === 0
                    ? "Today!"
                    : item.daysRemaining === 1
                    ? "Tomorrow"
                    : `in ${item.daysRemaining} days`}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
