"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  ExternalLink,
  Folder,
  FolderOpen,
  Plus,
  Trash2,
} from "lucide-react";
import { createCollectionAction, deleteCollectionAction, getCollectionsOverviewAction } from "../actions/collections";
import { notify } from "@/lib/notifications";
import {
  collectionKindLabel,
  collectionVisibilityLabel,
  type CollectionKind,
} from "../collection-helpers";
import type { CollectionOverview } from "../collection-types";

interface CollectionsManagerProps {
  collections: CollectionOverview[];
}

function countLabel(collection: CollectionOverview): string {
  const { counts } = collection;
  const parts: string[] = [];
  if (counts.photos) parts.push(`${counts.photos} photo${counts.photos === 1 ? "" : "s"}`);
  const films = counts.movies + counts.shows;
  if (films) parts.push(`${films} film${films === 1 ? "" : "s"}`);
  const music = counts.artists + counts.albums + counts.tracks;
  if (music) parts.push(`${music} music`);
  if (counts.people) parts.push(`${counts.people} ${counts.people === 1 ? "person" : "people"}`);
  return parts.join(" · ") || "Empty";
}

export function CollectionsManager({ collections: initialCollections }: CollectionsManagerProps) {
  const router = useRouter();
  const [collectionsList, setCollectionsList] = useState(initialCollections);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#ff6600");
  const [kind, setKind] = useState<CollectionKind>("media");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const refreshCollections = async () => {
    try {
      setCollectionsList(await getCollectionsOverviewAction());
    } catch {
      // Keep the current list if the refresh fails.
    }
    router.refresh();
  };

  const handleCreate = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    const collectionName = name.trim();
    const collectionDescription = description.trim();
    const collectionColor = color;
    const collectionKind = kind;
    setName("");
    setDescription("");

    notify.bg({
      title: "Create Collection",
      loadingMessage: `Creating collection '${collectionName}' in background...`,
      successMessage: `Collection '${collectionName}' created successfully!`,
      errorMessage: (err) => `Failed to create collection: ${err?.message || String(err)}`,
      task: async () => {
        const result = await createCollectionAction(
          collectionName,
          collectionDescription || undefined,
          collectionColor,
          "Folder",
          collectionKind
        );
        if (!result.success) {
          const message =
            "error" in result && typeof result.error === "string"
              ? result.error
              : "Failed to create the collection.";
          throw new Error(message);
        }
        return result;
      },
      onSuccess: () => {
        void refreshCollections();
      },
    });
  };

  const handleCopy = async (collection: CollectionOverview) => {
    if (!collection.sharePath) return;
    const url = `${window.location.origin}${collection.sharePath}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(collection.id);
      setTimeout(() => setCopiedId(null), 2000);
      notify.show({ type: "success", message: "Share link copied." });
    } catch {
      notify.show({ type: "error", message: "Could not copy the link." });
    }
  };

  const handleDelete = (collection: CollectionOverview) => {
    if (!confirm("Delete this collection? Items will NOT be deleted from the CMS.")) return;
    setCollectionsList((previous) => previous.filter((item) => item.id !== collection.id));

    notify.bg({
      title: "Delete Collection",
      loadingMessage: `Deleting collection '${collection.name}'...`,
      successMessage: "Collection deleted.",
      errorMessage: "Failed to delete collection.",
      task: () => deleteCollectionAction(collection.id),
      onSuccess: () => {
        void refreshCollections();
      },
      onError: () => {
        void refreshCollections();
      },
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <form className="card" onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <h2 style={{ fontSize: "16px", fontWeight: 600, margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
          <Plus size={16} /> Create a Collection
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 1fr 1fr", gap: "12px" }}>
          <div>
            <label className="label">Collection Name</label>
            <input
              type="text"
              className="text-input"
              placeholder="e.g. Swiss Alps, Christopher Nolan, Favorites 2026"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </div>

          <div>
            <label className="label">Collection Type</label>
            <select
              className="text-input"
              value={kind}
              onChange={(event) => setKind(event.target.value as CollectionKind)}
            >
              <option value="photo">Photo album</option>
              <option value="media">Media collection</option>
              <option value="mixed">Mixed collection</option>
            </select>
          </div>

          <div>
            <label className="label">Color Badge</label>
            <input
              type="color"
              className="text-input"
              value={color}
              onChange={(event) => setColor(event.target.value)}
              style={{ padding: "2px", height: "38px" }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button type="submit" className="btn btn-primary" style={{ width: "100%" }}>
              Create Collection
            </button>
          </div>
        </div>

        <div>
          <label className="label">Description (Optional)</label>
          <input
            type="text"
            className="text-input"
            placeholder="A short line that will appear on the shared page"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
      </form>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
        {collectionsList.length === 0 && (
          <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
            No collections created yet.
          </div>
        )}

        {collectionsList.map((collection) => (
          <div
            key={collection.id}
            className="card"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 0,
              padding: 0,
              overflow: "hidden",
              borderLeft: `4px solid ${collection.color || "var(--accent-color)"}`,
            }}
          >
            <div style={{ height: "142px", background: "var(--bg-sidebar)", overflow: "hidden" }}>
              {collection.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={collection.coverUrl}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <div style={{ height: "100%", display: "grid", placeItems: "center", color: "var(--text-muted)" }}>
                  <FolderOpen size={30} />
                </div>
              )}
            </div>

            <div style={{ display: "flex", flex: 1, flexDirection: "column", gap: "10px", padding: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 4px" }}>{collection.name}</h3>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{countLabel(collection)}</div>
                </div>
                <button
                  className="btn btn-sm btn-icon btn-danger"
                  onClick={() => handleDelete(collection)}
                  title="Delete Collection"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                <span className="badge">{collectionKindLabel(collection.kind)}</span>
                <span
                  className="badge"
                  style={{
                    color:
                      collection.visibility === "public"
                        ? "#22c55e"
                        : collection.visibility === "unlisted"
                          ? "var(--accent-color)"
                          : "var(--text-muted)",
                  }}
                >
                  {collectionVisibilityLabel(collection.visibility)}
                </span>
              </div>

              {collection.description && (
                <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>{collection.description}</p>
              )}

              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "auto" }}>
                <Link
                  href={`/libraries/collections/${collection.slug}`}
                  className="btn btn-sm btn-primary"
                  style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}
                >
                  <Folder size={13} /> Manage
                </Link>

                {collection.sharePath && (
                  <>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => handleCopy(collection)}
                      style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}
                    >
                      {copiedId === collection.id ? <Check size={13} /> : <Copy size={13} />}
                      {copiedId === collection.id ? "Copied" : "Copy link"}
                    </button>
                    <a
                      href={collection.sharePath}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-sm"
                      style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}
                    >
                      <ExternalLink size={13} /> Open
                    </a>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
