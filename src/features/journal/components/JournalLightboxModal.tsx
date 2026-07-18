"use client";

import React, { useState, useEffect, useCallback } from "react";
import { JournalAssetRecord } from "@/db/schema";
import { downloadAndDecryptJournalAssetBlob } from "../lib/crypto-assets";
import { useJournalAuth } from "../context/JournalAuthContext";
import {
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Download,
  Loader2,
  Lock,
  ImageIcon,
} from "lucide-react";

export interface LightboxItem {
  assetId: string;
  assetRecord?: JournalAssetRecord | null;
  cloudinaryOriginalPublicId: string;
  originalIv: string;
  mimeType?: string;
  caption?: string;
  width?: number;
  height?: number;
}

interface JournalLightboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: LightboxItem[];
  initialIndex?: number;
}

export function JournalLightboxModal({
  isOpen,
  onClose,
  items,
  initialIndex = 0,
}: JournalLightboxModalProps) {
  const { cryptoKey } = useJournalAuth();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [decryptedUrl, setDecryptedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Zoom and Pan states
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex, isOpen]);

  const currentItem = items[currentIndex];

  // Decrypt high-res original when item changes
  useEffect(() => {
    if (!isOpen || !currentItem || !cryptoKey) {
      setDecryptedUrl(null);
      return;
    }

    let isMounted = true;
    let createdUrl: string | null = null;

    const loadOriginal = async () => {
      setLoading(true);
      setError(null);
      setZoom(1);
      setPan({ x: 0, y: 0 });

      try {
        const url = await downloadAndDecryptJournalAssetBlob({
          cloudinaryPublicId: currentItem.cloudinaryOriginalPublicId,
          iv: currentItem.originalIv,
          dekKey: cryptoKey,
          mimeType: currentItem.mimeType || "image/jpeg",
        });

        if (isMounted) {
          createdUrl = url;
          setDecryptedUrl(url);
        } else {
          URL.revokeObjectURL(url);
        }
      } catch (err: any) {
        if (isMounted) {
          console.error("Lightbox decryption error:", err);
          setError("Failed to decrypt high-res original image.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadOriginal();

    return () => {
      isMounted = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [isOpen, currentItem, cryptoKey]);

  const handlePrev = useCallback(() => {
    if (items.length <= 1) return;
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1));
  }, [items.length]);

  const handleNext = useCallback(() => {
    if (items.length <= 1) return;
    setCurrentIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0));
  }, [items.length]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(z + 0.25, 4));
      if (e.key === "-") setZoom((z) => Math.max(z - 0.25, 0.5));
      if (e.key === "0") {
        setZoom(1);
        setPan({ x: 0, y: 0 });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, handlePrev, handleNext]);

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      setZoom((z) => Math.min(z + 0.2, 4));
    } else {
      setZoom((z) => Math.max(z - 0.2, 0.5));
    }
  };

  // Mouse pan dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleDownload = () => {
    if (!decryptedUrl) return;
    const a = document.createElement("a");
    a.href = decryptedUrl;
    a.download = `encrypted_journal_photo_${currentItem?.assetId || "download"}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (!isOpen || !currentItem) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.92)",
        backdropFilter: "blur(12px)",
        zIndex: 10000,
        display: "flex",
        flexDirection: "column",
        userSelect: "none",
      }}
      onMouseUp={handleMouseUp}
    >
      {/* Header Controls Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 24px",
          color: "#fff",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
          zIndex: 2,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px" }}>
          <Lock size={16} style={{ color: "var(--accent)" }} />
          <span style={{ fontWeight: 600 }}>End-to-End Encrypted Photo</span>
          {items.length > 1 && (
            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "13px" }}>
              ({currentIndex + 1} of {items.length})
            </span>
          )}
        </div>

        {/* Toolbar Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(z + 0.25, 4))}
            style={btnStyle}
            title="Zoom In (+)"
          >
            <ZoomIn size={18} />
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(z - 0.25, 0.5))}
            style={btnStyle}
            title="Zoom Out (-)"
          >
            <ZoomOut size={18} />
          </button>
          <button
            type="button"
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            style={btnStyle}
            title="Reset Zoom (0)"
          >
            <RotateCcw size={18} />
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={!decryptedUrl}
            style={{ ...btnStyle, opacity: decryptedUrl ? 1 : 0.4 }}
            title="Download Decrypted Original"
          >
            <Download size={18} />
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{ ...btnStyle, backgroundColor: "rgba(255,255,255,0.15)" }}
            title="Close (Esc)"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Main Image Container */}
      <div
        style={{
          flex: 1,
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          cursor: zoom > 1 ? (isDragging ? "grabbing" : "grab") : "default",
        }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
      >
        {/* Next / Previous Navigation Controls */}
        {items.length > 1 && (
          <>
            <button
              type="button"
              onClick={handlePrev}
              style={{ ...navBtnStyle, left: "20px" }}
              title="Previous Image (Left Arrow)"
            >
              <ChevronLeft size={28} />
            </button>
            <button
              type="button"
              onClick={handleNext}
              style={{ ...navBtnStyle, right: "20px" }}
              title="Next Image (Right Arrow)"
            >
              <ChevronRight size={28} />
            </button>
          </>
        )}

        {/* Loading Spinner */}
        {loading && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", color: "#fff" }}>
            <Loader2 size={36} className="spin" style={{ color: "var(--accent)" }} />
            <span style={{ fontSize: "14px" }}>Decrypting original image with Journal DEK...</span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div style={{ color: "#ef4444", fontSize: "14px", backgroundColor: "rgba(239, 68, 68, 0.15)", padding: "16px 24px", borderRadius: "8px", border: "1px solid rgba(239, 68, 68, 0.3)" }}>
            {error}
          </div>
        )}

        {/* Decrypted Original Image */}
        {!loading && !error && decryptedUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={decryptedUrl}
            alt={currentItem.caption || "Encrypted Journal Photo"}
            style={{
              maxWidth: "90vw",
              maxHeight: "82vh",
              objectFit: "contain",
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transition: isDragging ? "none" : "transform 0.15s ease-out",
              borderRadius: "4px",
              boxShadow: "0 20px 50px rgba(0,0,0,0.8)",
            }}
          />
        )}
      </div>

      {/* Footer Caption & Meta Bar */}
      {currentItem.caption && (
        <div
          style={{
            padding: "12px 24px",
            backgroundColor: "rgba(0,0,0,0.6)",
            borderTop: "1px solid rgba(255,255,255,0.1)",
            textAlign: "center",
            color: "rgba(255,255,255,0.9)",
            fontSize: "14px",
            zIndex: 2,
          }}
        >
          {currentItem.caption}
        </div>
      )}
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.1)",
  border: "none",
  color: "#fff",
  width: "36px",
  height: "36px",
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  transition: "background 0.2s",
};

const navBtnStyle: React.CSSProperties = {
  position: "absolute",
  top: "50%",
  transform: "translateY(-50%)",
  backgroundColor: "rgba(0, 0, 0, 0.6)",
  border: "1px solid rgba(255,255,255,0.2)",
  color: "#fff",
  width: "48px",
  height: "48px",
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  zIndex: 10,
};
