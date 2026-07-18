"use client";

import React, { useState } from "react";
import { DecryptedEntryItem } from "../lib/journal-search";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, BookOpen } from "lucide-react";

interface JournalCalendarProps {
  items: DecryptedEntryItem[];
  onSelectEntry: (item: DecryptedEntryItem) => void;
  onSelectDate: (dateStr: string) => void;
}

export function JournalCalendar({ items, onSelectEntry, onSelectDate }: JournalCalendarProps) {
  const [currentDate, setCurrentDate] = useState(() => new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Map entries by dateStr YYYY-MM-DD
  const entriesByDate: Record<string, DecryptedEntryItem[]> = {};
  for (const item of items) {
    const d = item.record.entryDate;
    if (d) {
      if (!entriesByDate[d]) entriesByDate[d] = [];
      entriesByDate[d].push(item);
    }
  }

  const daysArray = [];
  // Padding for previous month
  for (let i = 0; i < firstDayIndex; i++) {
    daysArray.push(null);
  }
  // Days of current month
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    daysArray.push({ dayNumber: d, dateStr, entries: entriesByDate[dateStr] || [] });
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border-color)",
        borderRadius: "8px",
        padding: "20px",
        color: "var(--text-primary)",
      }}
    >
      {/* Month & Year header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <CalendarIcon size={18} style={{ color: "var(--accent)" }} />
          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700 }}>
            {monthNames[month]} {year}
          </h2>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <button
            onClick={prevMonth}
            style={{
              padding: "6px",
              backgroundColor: "var(--bg-input)",
              border: "1px solid var(--border-color)",
              borderRadius: "4px",
              color: "var(--text-primary)",
              cursor: "pointer",
              display: "flex",
            }}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={nextMonth}
            style={{
              padding: "6px",
              backgroundColor: "var(--bg-input)",
              border: "1px solid var(--border-color)",
              borderRadius: "4px",
              color: "var(--text-primary)",
              cursor: "pointer",
              display: "flex",
            }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Days of week header */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "6px", textAlign: "center", fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
        <span>Sun</span>
        <span>Mon</span>
        <span>Tue</span>
        <span>Wed</span>
        <span>Thu</span>
        <span>Fri</span>
        <span>Sat</span>
      </div>

      {/* Calendar Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "6px" }}>
        {daysArray.map((day, idx) => {
          if (!day) {
            return <div key={`empty_${idx}`} style={{ minHeight: "80px" }} />;
          }

          const hasEntries = day.entries.length > 0;
          const isToday = day.dateStr === new Date().toISOString().split("T")[0];

          return (
            <div
              key={day.dateStr}
              onClick={() => {
                if (hasEntries) {
                  onSelectEntry(day.entries[0]);
                } else {
                  onSelectDate(day.dateStr);
                }
              }}
              style={{
                minHeight: "80px",
                padding: "8px",
                backgroundColor: hasEntries ? "rgba(249, 115, 22, 0.08)" : "var(--bg-input)",
                border: isToday ? "2px solid var(--accent)" : "1px solid var(--border-color)",
                borderRadius: "6px",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--accent)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = isToday ? "var(--accent)" : "var(--border-color)";
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: isToday ? "var(--accent)" : "var(--text-primary)" }}>
                  {day.dayNumber}
                </span>
                {hasEntries && (
                  <span style={{ fontSize: "10px", padding: "1px 5px", borderRadius: "10px", backgroundColor: "var(--accent)", color: "var(--accent-text)", fontWeight: 700 }}>
                    {day.entries.length}
                  </span>
                )}
              </div>

              {hasEntries ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginTop: "4px" }}>
                  {day.entries.map((item) => (
                    <div
                      key={item.record.id}
                      style={{
                        fontSize: "10px",
                        fontWeight: 600,
                        color: "var(--accent)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.content?.title || "Entry"}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
