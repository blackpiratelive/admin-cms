"use client";

import React, { useState } from "react";
import { CollectionRecord } from "@/db/schema";
import { createCollectionAction, deleteCollectionAction } from "../actions/collections";
import { Folder, Plus, Trash2, Tag, Check } from "lucide-react";

interface CollectionsManagerProps {
  collections: CollectionRecord[];
}

export function CollectionsManager({ collections: initialCollections }: CollectionsManagerProps) {
  const [collectionsList, setCollectionsList] = useState(initialCollections);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#ff6600");
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      const res = await createCollectionAction(name.trim(), description.trim() || undefined, color);
      if (res.success) {
        setName("");
        setDescription("");
        window.location.reload();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this collection? Media items will NOT be deleted.")) return;
    await deleteCollectionAction(id);
    window.location.reload();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Create Form */}
      <form className="card" onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <h2 style={{ fontSize: "16px", fontWeight: 600, margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
          <Plus size={16} /> Create New Media Collection
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "12px" }}>
          <div>
            <label className="label">Collection Name</label>
            <input
              type="text"
              className="text-input"
              placeholder="e.g. Christopher Nolan, Favorites 2026, Jazz"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="label">Color Badge</label>
            <input type="color" className="text-input" value={color} onChange={(e) => setColor(e.target.value)} style={{ padding: "2px", height: "38px" }} />
          </div>

          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={loading}>
              {loading ? "Creating..." : "Create Collection"}
            </button>
          </div>
        </div>

        <div>
          <label className="label">Description (Optional)</label>
          <input
            type="text"
            className="text-input"
            placeholder="e.g. Complete filmography of Christopher Nolan"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
      </form>

      {/* Existing Collections Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
        {collectionsList.length === 0 && (
          <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
            No media collections created yet.
          </div>
        )}
        {collectionsList.map((c) => (
          <div key={c.id} className="card" style={{ display: "flex", flexDirection: "column", gap: "12px", borderLeft: `4px solid ${c.color || "var(--accent-color)"}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 4px 0" }}>{c.name}</h3>
                <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{c.slug}</div>
              </div>
              <button className="btn btn-sm btn-icon btn-danger" onClick={() => handleDelete(c.id)} title="Delete Collection">
                <Trash2 size={14} />
              </button>
            </div>

            {c.description && <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>{c.description}</p>}

            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "auto" }}>
              Created: {new Date(c.createdAt).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
