"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Camera,
  Film,
  Images,
  Layers,
  Loader2,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import { notify } from "@/lib/notifications";
import {
  deleteCollectionAction,
  updateCollectionAction,
} from "../actions/collections";
import {
  collectionKindLabel,
  type CollectionKind,
} from "../collection-helpers";
import type { CollectionDetail } from "../collection-types";
import { CollectionCover } from "./CollectionCover";
import { ConfirmDialog } from "./CollectionsModal";

interface CollectionSettingsTabProps {
  detail: CollectionDetail;
  onRefresh: () => Promise<CollectionDetail | null>;
  onOpenCoverPicker: () => void;
  onResetCover: () => Promise<{ success: boolean; error?: string }>;
  onDeleted: () => void;
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
    description: "Photographs only.",
  },
  {
    id: "media",
    icon: <Film size={18} />,
    title: "Media collection",
    description: "Films, shows, music, and people.",
  },
  {
    id: "mixed",
    icon: <Layers size={18} />,
    title: "Mixed collection",
    description: "Photos and media together.",
  },
];

export function CollectionSettingsTab({
  detail,
  onRefresh,
  onOpenCoverPicker,
  onResetCover,
  onDeleted,
}: CollectionSettingsTabProps) {
  const { collection } = detail;
  const [name, setName] = useState(collection.name);
  const [description, setDescription] = useState(collection.description || "");
  const [kind, setKind] = useState<CollectionKind>(collection.kind);
  const [color, setColor] = useState(collection.color || "#ff6600");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingKind, setPendingKind] = useState<CollectionKind | null>(null);
  const [resetBusy, setResetBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    setName(collection.name);
    setDescription(collection.description || "");
    setKind(collection.kind);
    setColor(collection.color || "#ff6600");
  }, [
    collection.name,
    collection.description,
    collection.kind,
    collection.color,
  ]);

  const mediaCount = useMemo(
    () =>
      detail.movies.length +
      detail.shows.length +
      detail.artists.length +
      detail.albums.length +
      detail.tracks.length +
      detail.people.length,
    [detail]
  );

  const incompatibleForKind = (next: CollectionKind) => {
    if (next === "photo") return mediaCount;
    if (next === "media") return detail.photos.length;
    return 0;
  };

  const initialColor = collection.color || "#ff6600";
  const dirty =
    name.trim() !== collection.name ||
    description.trim() !== (collection.description || "") ||
    kind !== collection.kind ||
    color.toLowerCase() !== initialColor.toLowerCase();

  const chooseKind = (next: CollectionKind) => {
    if (next === kind) return;
    if (incompatibleForKind(next) > 0) {
      setPendingKind(next);
      return;
    }
    setKind(next);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const result = await updateCollectionAction(collection.id, {
        name,
        description,
        color,
        kind,
      });
      if (!result.success) {
        setError("error" in result && result.error ? result.error : "Could not save changes.");
        return;
      }
      notify.show({ type: "success", message: "Collection settings saved." });
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save changes.");
    } finally {
      setSaving(false);
    }
  };

  const resetCover = async () => {
    setResetBusy(true);
    setError(null);
    try {
      const result = await onResetCover();
      if (!result.success) {
        setError(result.error || "Could not reset the cover.");
        return;
      }
      notify.show({ type: "success", message: "Cover set to automatic." });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset the cover.");
    } finally {
      setResetBusy(false);
    }
  };

  const confirmDelete = async () => {
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const result = await deleteCollectionAction(collection.id);
      if (!result.success) {
        setDeleteError("Could not delete the collection.");
        return;
      }
      notify.show({ type: "success", message: "Collection deleted." });
      onDeleted();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Could not delete the collection.");
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div
      className="collection-panel"
      role="tabpanel"
      id="collection-panel-settings"
      aria-labelledby="collection-tab-settings"
    >
      <div className="collection-panel-head">
        <div>
          <h2>Settings</h2>
          <p>Update the collection details, cover, or remove it permanently.</p>
        </div>
      </div>

      {error && <div className="collections-form-error">{error}</div>}

      <form className="collection-settings-form" onSubmit={save}>
        <section className="collection-settings-card">
          <div className="collection-settings-card-head">
            <h3>General</h3>
            <p>The name and description appear on the shared page.</p>
          </div>

          <div className="collections-form collections-form-grid">
            <label className="collections-field">
              <span className="collections-label">Name</span>
              <input
                className="collections-input"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={120}
                required
              />
            </label>

            <label className="collections-field collections-field-full">
              <span className="collections-label">Description <em>optional</em></span>
              <textarea
                className="collections-input collections-textarea"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
                maxLength={600}
                placeholder="Give this collection a little context."
              />
            </label>

            <fieldset className="collections-fieldset collections-field-full">
              <legend className="collections-label">Collection type</legend>
              <div className="collections-kind-options">
                {KIND_OPTIONS.map((option) => {
                  const active = kind === option.id;
                  const incompatible = active ? 0 : incompatibleForKind(option.id);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      className={`collections-kind-option ${active ? "is-active" : ""}`}
                      onClick={() => chooseKind(option.id)}
                      aria-pressed={active}
                    >
                      <span className="collections-kind-icon">{option.icon}</span>
                      <span>
                        <strong>{collectionKindLabel(option.id)}</strong>
                        <small>{option.description}</small>
                        {incompatible > 0 && (
                          <small className="collections-kind-warning">
                            {incompatible} incompatible {incompatible === 1 ? "item" : "items"}
                          </small>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <fieldset className="collections-fieldset collections-field-full">
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
          </div>

          <div className="collection-settings-actions">
            <button
              type="submit"
              className="collections-btn collections-btn-primary"
              disabled={!dirty || !name.trim() || saving}
            >
              {saving ? <Loader2 size={15} className="spin" /> : <Save size={15} />}
              {saving ? "Saving…" : "Save changes"}
            </button>
            {!dirty && <span className="collection-settings-hint">Everything is up to date.</span>}
          </div>
        </section>
      </form>

      <section className="collection-settings-card">
        <div className="collection-settings-card-head">
          <h3>Appearance</h3>
          <p>
            The cover is shown at the top of this page and on collection cards. It
            must be a photo already in this collection.
          </p>
        </div>

        <div className="collection-cover-settings">
          <CollectionCover
            src={detail.coverUrl}
            color={collection.color}
            kind={collection.kind}
            alt=""
            className="collection-settings-cover"
          />
          <div className="collection-cover-settings-copy">
            <strong>
              {collection.coverPhotoId ? "Manual photo cover" : "Automatic cover"}
            </strong>
            <p>
              {collection.coverPhotoId
                ? "This photo is used as the cover. If it becomes private or is removed, the shared page falls back automatically."
                : "Collections uses the earliest photo, then the first available poster or avatar."}
            </p>
            <div className="collection-cover-settings-actions">
              <button
                type="button"
                className="collections-btn collections-btn-primary collections-btn-sm"
                onClick={onOpenCoverPicker}
              >
                <Camera size={14} /> Choose cover
              </button>
              {collection.coverPhotoId && (
                <button
                  type="button"
                  className="collections-btn collections-btn-ghost collections-btn-sm"
                  onClick={resetCover}
                  disabled={resetBusy}
                >
                  {resetBusy ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
                  Use automatic
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="collection-settings-card is-danger">
        <div className="collection-settings-card-head">
          <h3><Trash2 size={15} /> Danger zone</h3>
          <p>
            Deleting a collection removes its item links, share token, cover choice,
            and analytics. The photos and media themselves are not deleted.
          </p>
        </div>
        <div className="collection-danger-row">
          <div>
            <strong>Delete this collection</strong>
            <span>This cannot be undone.</span>
          </div>
          <button
            type="button"
            className="collections-btn collections-btn-danger"
            onClick={() => {
              setDeleteError(null);
              setDeleteOpen(true);
            }}
          >
            <Trash2 size={15} /> Delete collection
          </button>
        </div>
      </section>

      <ConfirmDialog
        isOpen={Boolean(pendingKind)}
        title={`Switch to ${pendingKind ? collectionKindLabel(pendingKind) : "this type"}?`}
        description={
          <>
            <strong>
              {pendingKind ? incompatibleForKind(pendingKind) : 0} item
              {pendingKind && incompatibleForKind(pendingKind) === 1 ? "" : "s"}
            </strong>{" "}
            will not appear on the shared page after this change. They will remain
            in the collection and be flagged in the Content tab, so you can remove
            them or switch the type back. A manual photo cover may also fall back
            automatically on the shared page.
          </>
        }
        confirmLabel="Change type"
        tone="danger"
        onConfirm={() => {
          if (pendingKind) setKind(pendingKind);
          setPendingKind(null);
        }}
        onCancel={() => setPendingKind(null)}
      />

      <ConfirmDialog
        isOpen={deleteOpen}
        title="Delete this collection?"
        description={
          <>
            <strong>{collection.name}</strong> and its analytics will be deleted.
            Items inside it will stay in your library. This cannot be undone.
            {deleteError && <span className="collections-form-error">{deleteError}</span>}
          </>
        }
        confirmLabel="Delete permanently"
        tone="danger"
        busy={deleteBusy}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  );
}
