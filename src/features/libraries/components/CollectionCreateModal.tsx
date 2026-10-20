"use client";

import React, { useEffect, useState } from "react";
import { Film, Images, Layers, Loader2 } from "lucide-react";
import { notify } from "@/lib/notifications";
import { createCollectionAction } from "../actions/collections";
import {
  collectionKindLabel,
  type CollectionKind,
} from "../collection-helpers";
import { CollectionsModal } from "./CollectionsModal";

interface CollectionCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (slug: string) => void;
}

const COLOR_SWATCHES = [
  "#ff6600",
  "#e11d48",
  "#8b5cf6",
  "#2563eb",
  "#0f9f6e",
  "#d97706",
];

const KIND_OPTIONS: Array<{
  id: CollectionKind;
  icon: React.ReactNode;
  title: string;
  description: string;
}> = [
  {
    id: "photo",
    icon: <Images size={18} />,
    title: "Photo album",
    description: "Share a set of photographs.",
  },
  {
    id: "media",
    icon: <Film size={18} />,
    title: "Media collection",
    description: "Gather films, shows, music, and people.",
  },
  {
    id: "mixed",
    icon: <Layers size={18} />,
    title: "Mixed collection",
    description: "Combine photos and media.",
  },
];

export function CollectionCreateModal({
  isOpen,
  onClose,
  onCreated,
}: CollectionCreateModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#ff6600");
  const [kind, setKind] = useState<CollectionKind>("media");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setName("");
    setDescription("");
    setColor("#ff6600");
    setKind("media");
    setError(null);
    setSubmitting(false);
  }, [isOpen]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const result = await createCollectionAction(
        name,
        description.trim() || undefined,
        color,
        "Folder",
        kind
      );
      if (!result.success || !("slug" in result) || !result.slug) {
        setError(
          "error" in result && result.error
            ? result.error
            : "Could not create the collection."
        );
        return;
      }
      notify.show({
        type: "success",
        message: "existing" in result && result.existing
          ? `Opening “${name.trim()}”.`
          : `Collection “${name.trim()}” created.`,
      });
      onClose();
      onCreated(result.slug);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the collection.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <CollectionsModal
      isOpen={isOpen}
      onClose={submitting ? () => undefined : onClose}
      title="New collection"
      description="Start a private collection, then choose who can see it."
      size="lg"
      footer={
        <>
          <button
            type="button"
            className="collections-btn collections-btn-ghost"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="collection-create-form"
            className="collections-btn collections-btn-primary"
            disabled={!name.trim() || submitting}
          >
            {submitting ? <Loader2 size={15} className="spin" /> : null}
            {submitting ? "Creating…" : "Create collection"}
          </button>
        </>
      }
    >
      <form id="collection-create-form" className="collections-form" onSubmit={handleSubmit}>
        <label className="collections-field">
          <span className="collections-label">Name</span>
          <input
            className="collections-input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Swiss Alps, Favorites 2026"
            autoFocus
            required
          />
        </label>

        <label className="collections-field">
          <span className="collections-label">Description <em>optional</em></span>
          <textarea
            className="collections-input collections-textarea"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="A short line that appears on the collection page."
            rows={3}
          />
        </label>

        <fieldset className="collections-fieldset">
          <legend className="collections-label">Type</legend>
          <div className="collections-kind-options">
            {KIND_OPTIONS.map((option) => {
              const active = kind === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  className={`collections-kind-option ${active ? "is-active" : ""}`}
                  onClick={() => setKind(option.id)}
                  aria-pressed={active}
                >
                  <span className="collections-kind-icon">{option.icon}</span>
                  <span>
                    <strong>{collectionKindLabel(option.id)}</strong>
                    <small>{option.description}</small>
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="collections-fieldset">
          <legend className="collections-label">Accent color</legend>
          <div className="collections-color-row">
            <input
              type="color"
              className="collections-color-input"
              value={color}
              onChange={(event) => setColor(event.target.value)}
              aria-label="Collection accent color"
            />
            <div className="collections-color-swatches">
              {COLOR_SWATCHES.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  className={`collections-color-swatch ${
                    color.toLowerCase() === swatch.toLowerCase() ? "is-active" : ""
                  }`}
                  style={{ background: swatch }}
                  onClick={() => setColor(swatch)}
                  aria-label={`Use ${swatch}`}
                  aria-pressed={color.toLowerCase() === swatch.toLowerCase()}
                />
              ))}
            </div>
            <code className="collections-color-value">{color.toUpperCase()}</code>
          </div>
        </fieldset>

        {error && <div className="collections-form-error">{error}</div>}
      </form>
    </CollectionsModal>
  );
}
