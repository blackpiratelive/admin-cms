"use client";

import React, { useEffect, useRef } from "react";
import { AlertTriangle, X } from "lucide-react";

interface DeleteTripDialogProps {
  isOpen: boolean;
  tripTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting?: boolean;
}

export function DeleteTripDialog({
  isOpen,
  tripTitle,
  onConfirm,
  onCancel,
  isDeleting = false,
}: DeleteTripDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const deleteBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    deleteBtnRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.72)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
    >
      <div
        ref={dialogRef}
        style={{
          width: "100%",
          maxWidth: "440px",
          backgroundColor: "var(--bg-card, #1c1c1c)",
          border: "1px solid var(--border-color, #383838)",
          borderRadius: "14px",
          boxShadow: "0 24px 60px rgba(0, 0, 0, 0.5)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: "20px",
            borderBottom: "1px solid var(--border-color, #2f2f2f)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                backgroundColor: "rgba(239, 68, 68, 0.15)",
                display: "grid",
                placeItems: "center",
                color: "#ef4444",
              }}
            >
              <AlertTriangle size={17} />
            </div>
            <h3
              id="delete-dialog-title"
              style={{ fontSize: "16px", fontWeight: 750, margin: 0, color: "var(--text-primary, #eee)" }}
            >
              Delete Trip
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted, #888)",
              cursor: "pointer",
              padding: "4px",
            }}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: "20px" }}>
          <p style={{ margin: "0 0 8px", fontSize: "15px", color: "var(--text-primary, #ddd)" }}>
            Delete <strong>&ldquo;{tripTitle}&rdquo;</strong>?
          </p>
          <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted, #888)" }}>
            This will permanently remove the trip itinerary, associated day notes, and travel records. This action cannot be undone.
          </p>
        </div>

        <div
          style={{
            padding: "16px 20px",
            borderTop: "1px solid var(--border-color, #2f2f2f)",
            display: "flex",
            justifyContent: "flex-end",
            gap: "10px",
            backgroundColor: "rgba(0,0,0,0.15)",
          }}
        >
          <button
            type="button"
            className="trip-ghost-btn"
            onClick={onCancel}
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            type="button"
            ref={deleteBtnRef}
            onClick={onConfirm}
            disabled={isDeleting}
            style={{
              backgroundColor: "#dc2626",
              color: "#ffffff",
              border: 0,
              borderRadius: "8px",
              padding: "10px 16px",
              fontSize: "14px",
              fontWeight: 700,
              cursor: isDeleting ? "not-allowed" : "pointer",
              opacity: isDeleting ? 0.7 : 1,
            }}
          >
            {isDeleting ? "Deleting..." : "Delete trip"}
          </button>
        </div>
      </div>
    </div>
  );
}
