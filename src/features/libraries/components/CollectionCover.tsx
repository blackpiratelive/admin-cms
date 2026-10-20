"use client";

import React, { useState } from "react";
import { Film, FolderOpen, Images, Layers } from "lucide-react";

interface CollectionCoverProps {
  src: string | null;
  color: string | null;
  kind: string;
  alt?: string;
  className?: string;
  eager?: boolean;
}

function KindIcon({ kind, size }: { kind: string; size: number }) {
  if (kind === "photo") return <Images size={size} />;
  if (kind === "media") return <Film size={size} />;
  if (kind === "mixed") return <Layers size={size} />;
  return <FolderOpen size={size} />;
}

export function CollectionCover({
  src,
  color,
  kind,
  alt = "",
  className = "",
  eager = false,
}: CollectionCoverProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = Boolean(src && failedSrc !== src);

  return (
    <div
      className={`collection-cover ${className}`.trim()}
      style={{ "--collection-color": color || "var(--accent)" } as React.CSSProperties}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src || ""}
          alt={alt}
          loading={eager ? "eager" : "lazy"}
          onError={() => setFailedSrc(src)}
        />
      ) : (
        <div className="collection-cover-fallback" aria-hidden="true">
          <span className="collection-cover-fallback-icon">
            <KindIcon kind={kind} size={30} />
          </span>
        </div>
      )}
    </div>
  );
}
