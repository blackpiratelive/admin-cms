"use client";

import React, { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

interface CollectionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "md" | "lg" | "xl";
}

export function CollectionsModal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: CollectionsModalProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="collections-modal-overlay"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={`collections-modal collections-modal-${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="collections-modal-head">
          <div>
            <h2 id={titleId} className="collections-modal-title">
              {title}
            </h2>
            {description && <p className="collections-modal-desc">{description}</p>}
          </div>
          <button
            ref={closeRef}
            type="button"
            className="collections-icon-btn"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={17} />
          </button>
        </header>

        <div className="collections-modal-body">{children}</div>

        {footer && <footer className="collections-modal-footer">{footer}</footer>}
      </div>
    </div>
  );
}

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <CollectionsModal
      isOpen={isOpen}
      onClose={busy ? () => undefined : onCancel}
      title={title}
      size="md"
      footer={
        <>
          <button
            type="button"
            className="collections-btn collections-btn-ghost"
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`collections-btn ${
              tone === "danger" ? "collections-btn-danger" : "collections-btn-primary"
            }`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </>
      }
    >
      <div className="collections-confirm-copy">{description}</div>
    </CollectionsModal>
  );
}
