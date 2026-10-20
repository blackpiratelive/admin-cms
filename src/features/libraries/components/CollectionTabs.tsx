"use client";

import React from "react";
import {
  BarChart3,
  Images,
  Settings2,
  Share2,
} from "lucide-react";

export type CollectionTab = "content" | "sharing" | "insights" | "settings";

interface CollectionTabsProps {
  activeTab: CollectionTab;
  onChange: (tab: CollectionTab) => void;
  contentCount: number;
}

const TABS: Array<{
  id: CollectionTab;
  label: string;
  icon: React.ReactNode;
}> = [
  { id: "content", label: "Content", icon: <Images size={15} /> },
  { id: "sharing", label: "Sharing", icon: <Share2 size={15} /> },
  { id: "insights", label: "Insights", icon: <BarChart3 size={15} /> },
  { id: "settings", label: "Settings", icon: <Settings2 size={15} /> },
];

export function CollectionTabs({
  activeTab,
  onChange,
  contentCount,
}: CollectionTabsProps) {
  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number
  ) => {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % TABS.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + TABS.length) % TABS.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = TABS.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    const next = TABS[nextIndex];
    onChange(next.id);
    window.requestAnimationFrame(() => {
      document.getElementById(`collection-tab-${next.id}`)?.focus();
    });
  };

  return (
    <div className="collection-tabs-wrap">
      <nav className="collection-tabs" role="tablist" aria-label="Collection sections">
        {TABS.map((tab, index) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`collection-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`collection-panel-${tab.id}`}
              tabIndex={active ? 0 : -1}
              className={`collection-tab ${active ? "is-active" : ""}`}
              onClick={() => onChange(tab.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.id === "content" && (
                <span className="collection-tab-count">{contentCount}</span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
