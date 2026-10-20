"use client";

import React, { useEffect, useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  EyeOff,
  Globe,
  Link2,
  Lock,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { notify } from "@/lib/notifications";
import {
  getCollectionPreviewPath,
  type CollectionVisibility,
} from "../collection-helpers";
import type { CollectionDetail } from "../collection-types";
import { ConfirmDialog } from "./CollectionsModal";

interface CollectionSharingTabProps {
  detail: CollectionDetail;
  onVisibilityChange: (
    visibility: CollectionVisibility
  ) => Promise<{ success: boolean; error?: string; sharePath?: string | null }>;
  onRegenerate: () => Promise<{
    success: boolean;
    error?: string;
    sharePath?: string | null;
  }>;
}

const VISIBILITY_OPTIONS: Array<{
  id: CollectionVisibility;
  title: string;
  description: string;
  icon: React.ReactNode;
}> = [
  {
    id: "private",
    title: "Private",
    description: "Only you can open this collection in the admin.",
    icon: <Lock size={18} />,
  },
  {
    id: "unlisted",
    title: "Unlisted",
    description: "Anyone with the secret link can view it. It is not listed publicly.",
    icon: <EyeOff size={18} />,
  },
  {
    id: "public",
    title: "Public",
    description: "Listed on the public Collections page and reachable without a token.",
    icon: <Globe size={18} />,
  },
];

export function CollectionSharingTab({
  detail,
  onVisibilityChange,
  onRegenerate,
}: CollectionSharingTabProps) {
  const [origin, setOrigin] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"private" | "regenerate" | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const shareUrl = detail.sharePath
    ? `${origin}${detail.sharePath}`
    : null;
  const current = detail.collection.visibility;

  const copySharePath = async (path: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
      notify.show({ type: "success", message: "Share link copied." });
      return true;
    } catch {
      notify.show({ type: "error", message: "Could not copy the link." });
      return false;
    }
  };

  const changeVisibility = async (visibility: CollectionVisibility) => {
    setBusy(visibility);
    setError(null);
    try {
      const result = await onVisibilityChange(visibility);
      if (!result.success) {
        setError(result.error || "Could not change the collection visibility.");
        return;
      }
      if (visibility === "private") {
        notify.show({ type: "success", message: "Collection is private again." });
      } else {
        notify.show({
          type: "success",
          message:
            visibility === "public"
              ? "Collection is now public."
              : "Unlisted link is ready.",
        });
        if (result.sharePath) await copySharePath(result.sharePath);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change visibility.");
    } finally {
      setBusy(null);
    }
  };

  const chooseVisibility = (visibility: CollectionVisibility) => {
    if (visibility === current) return;
    if (visibility === "private") {
      setConfirm("private");
      return;
    }
    void changeVisibility(visibility);
  };

  const regenerate = async () => {
    setBusy("regenerate");
    setError(null);
    try {
      const result = await onRegenerate();
      if (!result.success) {
        setError(result.error || "Could not regenerate the share link.");
        return;
      }
      notify.show({ type: "success", message: "A new share link has been created." });
      if (result.sharePath) await copySharePath(result.sharePath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not regenerate the link.");
    } finally {
      setBusy(null);
      setConfirm(null);
    }
  };

  return (
    <div
      className="collection-panel"
      role="tabpanel"
      id="collection-panel-sharing"
      aria-labelledby="collection-tab-sharing"
    >
      <div className="collection-panel-head">
        <div>
          <h2>Sharing</h2>
          <p>Decide who can open this collection, then share its link.</p>
        </div>
      </div>

      {error && <div className="collections-form-error">{error}</div>}

      <div className="collection-visibility-grid">
        {VISIBILITY_OPTIONS.map((option) => {
          const active = current === option.id;
          return (
            <button
              key={option.id}
              type="button"
              className={`collection-visibility-card ${active ? "is-active" : ""}`}
              onClick={() => chooseVisibility(option.id)}
              disabled={Boolean(busy)}
              aria-pressed={active}
            >
              <span className="collection-visibility-icon">{option.icon}</span>
              <span className="collection-visibility-copy">
                <strong>
                  {option.title}
                  {active && <span className="collection-visibility-active">Active</span>}
                </strong>
                <small>{option.description}</small>
              </span>
              <span
                className={`collection-visibility-radio ${active ? "is-active" : ""}`}
                aria-hidden="true"
              >
                {active && <Check size={12} />}
              </span>
            </button>
          );
        })}
      </div>

      <section className="collection-share-link-card">
        <div className="collection-share-link-head">
          <div>
            <h3>
              <Link2 size={15} /> Share link
            </h3>
            <p>
              {detail.sharePath
                ? "This is the exact URL visitors will open."
                : "Create an unlisted link to share this collection without listing it publicly."}
            </p>
          </div>
          {detail.sharePath && (
            <span className="collections-badge collections-visibility is-unlisted">
              {current === "public" ? "Public" : "Secret link"}
            </span>
          )}
        </div>

        {detail.sharePath ? (
          <>
            <div className="collection-share-link-row">
              <code>{shareUrl || detail.sharePath}</code>
              <button
                type="button"
                className="collections-btn collections-btn-primary collections-btn-sm"
                onClick={() => detail.sharePath && copySharePath(detail.sharePath)}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <div className="collection-share-link-actions">
              <a
                href={getCollectionPreviewPath(detail.sharePath)}
                target="_blank"
                rel="noreferrer"
                className="collections-btn collections-btn-ghost collections-btn-sm"
              >
                <ExternalLink size={14} /> Preview without counting a view
              </a>
              {current === "unlisted" && (
                <button
                  type="button"
                  className="collections-btn collections-btn-ghost collections-btn-sm"
                  onClick={() => setConfirm("regenerate")}
                  disabled={Boolean(busy)}
                >
                  <RefreshCw size={14} /> Regenerate link
                </button>
              )}
            </div>
          </>
        ) : (
          <button
            type="button"
            className="collections-btn collections-btn-primary"
            onClick={() => chooseVisibility("unlisted")}
            disabled={Boolean(busy)}
          >
            <EyeOff size={15} /> Create unlisted link
          </button>
        )}
      </section>

      <div className="collections-notice">
        <ShieldAlert size={16} />
        <span>
          Regenerating the link immediately invalidates the old URL. The collection
          itself, its items, and its analytics stay intact.
        </span>
      </div>

      <ConfirmDialog
        isOpen={confirm === "private"}
        title="Make this collection private?"
        description={
          <>
            The current share link will stop working. Changing it back to unlisted will
            use the same token, and regenerating will always create a fresh one.
          </>
        }
        confirmLabel="Make private"
        tone="danger"
        busy={busy === "private"}
        onConfirm={async () => {
          await changeVisibility("private");
          setConfirm(null);
        }}
        onCancel={() => setConfirm(null)}
      />

      <ConfirmDialog
        isOpen={confirm === "regenerate"}
        title="Regenerate the share link?"
        description={
          <>
            Anyone using the old link will lose access immediately. You will get a new
            URL, and the current one cannot be restored.
          </>
        }
        confirmLabel="Generate new link"
        tone="danger"
        busy={busy === "regenerate"}
        onConfirm={regenerate}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
