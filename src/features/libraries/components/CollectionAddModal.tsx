"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Check, FolderPlus, Loader2, X } from "lucide-react";
import type { CollectionRecord } from "@/db/schema";
import {
  addItemToCollectionAction,
  getItemCollectionsAction,
  removeItemFromCollectionAction,
} from "../actions/collections";
import { collectionAllowsMedia, collectionVisibilityLabel } from "../collection-helpers";
import { notify } from "@/lib/notifications";

interface CollectionAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemType: "album" | "track" | "movie" | "show" | "artist" | "person";
  itemId: string;
  itemLabel: string;
  collections: CollectionRecord[];
}

export function CollectionAddModal({
  isOpen,
  onClose,
  itemType,
  itemId,
  itemLabel,
  collections,
}: CollectionAddModalProps) {
  const availableCollections = useMemo(
    () => collections.filter((collection) => collectionAllowsMedia(collection.kind)),
    [collections]
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setError(null);
    setSelectedIds(new Set());
    getItemCollectionsAction(itemType, itemId)
      .then((rows) => setSelectedIds(new Set(rows.map((row) => row.id))))
      .catch(() => setError("Could not load collection membership."))
      .finally(() => setLoading(false));
  }, [isOpen, itemType, itemId]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const toggle = async (collection: CollectionRecord) => {
    const isSelected = selectedIds.has(collection.id);
    setUpdatingId(collection.id);
    setError(null);
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (isSelected) next.delete(collection.id);
      else next.add(collection.id);
      return next;
    });

    try {
      const result = isSelected
        ? await removeItemFromCollectionAction(collection.id, itemType, itemId)
        : await addItemToCollectionAction(collection.id, itemType, itemId);
      if (!result.success) {
        setSelectedIds((previous) => {
          const next = new Set(previous);
          if (isSelected) next.add(collection.id);
          else next.delete(collection.id);
          return next;
        });
        let message = "Could not update the collection.";
        if ("error" in result && typeof result.error === "string") message = result.error;
        setError(message);
        return;
      }
      notify.show({
        type: "success",
        message: isSelected
          ? `Removed from '${collection.name}'.`
          : `Added to '${collection.name}'.`,
      });
    } catch (err: any) {
      setError(err?.message || "Could not update the collection.");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1150,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        background: "rgba(0,0,0,0.82)",
        backdropFilter: "blur(5px)",
      }}
    >
      <div
        className="card"
        style={{
          display: "flex",
          width: "min(440px, 100%)",
          maxHeight: "80vh",
          flexDirection: "column",
          padding: 0,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "12px",
            padding: "15px 16px",
            borderBottom: "1px solid var(--border-color)",
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 700 }}>Add to Collection</h2>
            <div style={{ marginTop: "3px", fontSize: "12px", color: "var(--text-muted)" }}>{itemLabel}</div>
          </div>
          <button type="button" className="btn btn-sm btn-icon" onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px" }}>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "34px", color: "var(--text-muted)" }}>
              <Loader2 size={20} className="spin" />
            </div>
          ) : availableCollections.length === 0 ? (
            <div style={{ padding: "28px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
              <FolderPlus size={24} style={{ marginBottom: "8px" }} />
              <div>No media collections yet.</div>
              <div style={{ marginTop: "4px", fontSize: "11px" }}>
                Create one in Libraries → Collections first.
              </div>
            </div>
          ) : (
            availableCollections.map((collection) => {
              const selected = selectedIds.has(collection.id);
              const updating = updatingId === collection.id;
              return (
                <button
                  key={collection.id}
                  type="button"
                  onClick={() => toggle(collection)}
                  disabled={updating}
                  style={{
                    display: "flex",
                    width: "100%",
                    alignItems: "center",
                    gap: "9px",
                    padding: "9px 10px",
                    marginBottom: "3px",
                    background: selected ? "var(--bg-card)" : "transparent",
                    border: selected ? "1px solid var(--accent-color)" : "1px solid transparent",
                    borderRadius: "5px",
                    color: "inherit",
                    cursor: updating ? "default" : "pointer",
                    textAlign: "left",
                  }}
                >
                  <span
                    style={{
                      display: "grid",
                      placeItems: "center",
                      width: "20px",
                      height: "20px",
                      flexShrink: 0,
                      borderRadius: "4px",
                      border: selected ? "1px solid var(--accent-color)" : "1px solid var(--border-color)",
                      background: selected ? "var(--accent-color)" : "transparent",
                      color: "#fff",
                    }}
                  >
                    {selected && <Check size={13} />}
                  </span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span
                      style={{
                        display: "block",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        fontSize: "12px",
                        fontWeight: 600,
                      }}
                    >
                      {collection.name}
                    </span>
                    <span style={{ display: "block", fontSize: "10px", color: "var(--text-muted)" }}>
                      {collectionVisibilityLabel(collection.visibility)}
                    </span>
                  </span>
                  {updating && <Loader2 size={14} className="spin" />}
                </button>
              );
            })
          )}
        </div>

        {error && (
          <div style={{ padding: "8px 14px", borderTop: "1px solid var(--border-color)", color: "#f87171", fontSize: "12px" }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
