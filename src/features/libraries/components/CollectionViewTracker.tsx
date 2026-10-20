"use client";

import { useEffect, useRef } from "react";
import { recordCollectionViewAction } from "../actions/collections";

interface CollectionViewTrackerProps {
  slug: string;
  token?: string | null;
  preview?: boolean;
}

/**
 * Records a view after the shared page mounts. Keeping this out of the server
 * render prevents metadata generation, prefetching, and crawler requests from
 * inflating collection analytics.
 */
export function CollectionViewTracker({
  slug,
  token,
  preview = false,
}: CollectionViewTrackerProps) {
  const recordedKey = useRef<string | null>(null);

  useEffect(() => {
    if (preview) return;
    const key = `${slug}:${token || ""}`;
    if (recordedKey.current === key) return;
    recordedKey.current = key;
    void recordCollectionViewAction(slug, token, false).catch(() => {
      // Analytics should never interrupt the public page.
    });
  }, [preview, slug, token]);

  return null;
}
