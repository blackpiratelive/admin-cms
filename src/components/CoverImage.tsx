"use client";

import React, { useState } from "react";

interface CoverImageProps {
  src: string;
  alt: string;
  aspectRatio?: string;
  style?: React.CSSProperties;
  className?: string;
}

export function CoverImage({ src, alt, aspectRatio = "2/3", style, className }: CoverImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        aspectRatio,
        backgroundColor: "var(--surface-color-subtle, #1a1a1a)",
        overflow: "hidden",
        ...style,
      }}
      className={className}
    >
      {/* Animated Skeleton Loader while image is loading */}
      {!loaded && !error && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 75%)",
            backgroundSize: "200% 100%",
            animation: "shimmer 1.5s infinite ease-in-out",
            zIndex: 1,
          }}
        />
      )}

      <img
        src={error ? "https://placehold.co/300x450/1a1a1a/cccccc?text=No+Cover" : src}
        alt={alt}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        loading="lazy"
        decoding="async"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: loaded ? 1 : 0,
          transition: "opacity 0.3s ease",
        }}
      />

      <style jsx global>{`
        @keyframes shimmer {
          0% {
            background-position: -200% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }
      `}</style>
    </div>
  );
}
