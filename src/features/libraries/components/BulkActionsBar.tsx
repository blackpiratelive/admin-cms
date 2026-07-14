"use client";

import React, { useState } from "react";
import { Tag, Eye, Heart, Trash2, X } from "lucide-react";

interface BulkActionsBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onApplyBulkAction: (action: {
    type: "addTag" | "removeTag" | "visibility" | "favorite" | "unfavorite" | "deleteMetadata";
    payload?: string;
  }) => Promise<void>;
}

export function BulkActionsBar({
  selectedCount,
  onClearSelection,
  onApplyBulkAction,
}: BulkActionsBarProps) {
  const [tagInput, setTagInput] = useState("");
  const [showTagPop, setShowTagPop] = useState(false);
  const [loading, setLoading] = useState(false);

  if (selectedCount === 0) return null;

  const handleAction = async (action: any) => {
    setLoading(true);
    try {
      await onApplyBulkAction(action);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: "24px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        background: "var(--bg-card)",
        border: "1px solid var(--accent-color)",
        borderRadius: "8px",
        padding: "10px 18px",
        display: "flex",
        alignItems: "center",
        gap: "16px",
        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
      }}
    >
      <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--accent-color)" }}>
        {selectedCount} item{selectedCount > 1 ? "s" : ""} selected
      </div>

      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        <button
          className="btn btn-sm btn-secondary"
          onClick={() => handleAction({ type: "favorite" })}
          disabled={loading}
        >
          <Heart size={14} fill="currentColor" /> Favorite
        </button>

        <button
          className="btn btn-sm btn-secondary"
          onClick={() => handleAction({ type: "unfavorite" })}
          disabled={loading}
        >
          Unfavorite
        </button>

        <button
          className="btn btn-sm btn-secondary"
          onClick={() => setShowTagPop(!showTagPop)}
          disabled={loading}
        >
          <Tag size={14} /> Tag
        </button>

        <select
          className="select-input"
          style={{ padding: "4px 8px", fontSize: "12px", width: "auto" }}
          onChange={(e) => {
            if (e.target.value) handleAction({ type: "visibility", payload: e.target.value });
          }}
          defaultValue=""
          disabled={loading}
        >
          <option value="" disabled>
            Visibility...
          </option>
          <option value="public">Public</option>
          <option value="private">Private</option>
          <option value="unlisted">Unlisted</option>
        </select>

        <button
          className="btn btn-sm btn-danger"
          onClick={() => {
            if (confirm("Reset personal metadata for selected items? Provider data will NOT be deleted.")) {
              handleAction({ type: "deleteMetadata" });
            }
          }}
          disabled={loading}
          title="Reset CMS personal metadata for selected items (Never deletes provider data)"
        >
          <Trash2 size={14} /> Clear Metadata
        </button>
      </div>

      {showTagPop && (
        <div
          style={{
            position: "absolute",
            bottom: "50px",
            left: "140px",
            background: "var(--bg-card)",
            border: "1px solid var(--border-color)",
            borderRadius: "6px",
            padding: "10px",
            boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
            display: "flex",
            gap: "6px",
          }}
        >
          <input
            type="text"
            className="text-input"
            placeholder="Add tag name..."
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            style={{ fontSize: "12px", padding: "4px 8px" }}
          />
          <button
            className="btn btn-sm btn-primary"
            onClick={() => {
              if (tagInput.trim()) {
                handleAction({ type: "addTag", payload: tagInput.trim() });
                setTagInput("");
                setShowTagPop(false);
              }
            }}
          >
            Add
          </button>
        </div>
      )}

      <button className="btn btn-sm btn-icon" onClick={onClearSelection} title="Clear Selection">
        <X size={16} />
      </button>
    </div>
  );
}
