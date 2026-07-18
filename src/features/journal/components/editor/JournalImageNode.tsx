"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  DecoratorNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
  $getNodeByKey,
} from "lexical";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useJournalAuth } from "../../context/JournalAuthContext";
import { downloadAndDecryptJournalAssetBlob } from "../../lib/crypto-assets";
import { getJournalAssetByIdAction, deleteJournalAssetAction } from "../../actions";
import { JournalAssetRecord } from "@/db/schema";
import { JournalLightboxModal, LightboxItem } from "../JournalLightboxModal";
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  Maximize2,
  Trash2,
  Lock,
  Loader2,
  ImageIcon,
} from "lucide-react";

export type ImageAlignment = "left" | "center" | "right" | "full";

export interface SerializedJournalImageNode extends SerializedLexicalNode {
  assetId: string;
  width?: number;
  height?: number;
  alignment: ImageAlignment;
  caption: string;
  displayMode?: string;
}

// Lexical Component for rendering the encrypted image node inside the editor
function JournalImageComponent({
  assetId,
  initialWidth,
  initialHeight,
  alignment,
  caption,
  nodeKey,
}: {
  assetId: string;
  initialWidth?: number;
  initialHeight?: number;
  alignment: ImageAlignment;
  caption: string;
  nodeKey: NodeKey;
}) {
  const [editor] = useLexicalComposerContext();
  const { cryptoKey } = useJournalAuth();

  const [assetRecord, setAssetRecord] = useState<JournalAssetRecord | null>(null);
  const [decryptedThumbUrl, setDecryptedThumbUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInViewport, setIsInViewport] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [captionText, setCaptionText] = useState(caption || "");
  const [isEditingCaption, setIsEditingCaption] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // 1. IntersectionObserver for Lazy Loading
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setIsInViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // 2. Fetch Asset Record & Decrypt Thumbnail when in viewport
  useEffect(() => {
    if (!isInViewport || !cryptoKey || !assetId) return;

    let isMounted = true;
    let createdUrl: string | null = null;

    const loadAndDecryptThumbnail = async () => {
      setLoading(true);
      setError(null);

      try {
        const record = await getJournalAssetByIdAction(assetId);
        if (!record) {
          throw new Error("Encrypted asset record not found.");
        }
        if (isMounted) setAssetRecord(record);

        const thumbUrl = await downloadAndDecryptJournalAssetBlob({
          cloudinaryPublicId: record.cloudinaryThumbnailPublicId,
          iv: record.thumbnailIv,
          dekKey: cryptoKey,
          mimeType: record.mimeType || "image/webp",
        });

        if (isMounted) {
          createdUrl = thumbUrl;
          setDecryptedThumbUrl(thumbUrl);
        } else {
          URL.revokeObjectURL(thumbUrl);
        }
      } catch (err: any) {
        if (isMounted) {
          console.error("JournalImageNode decryption error:", err);
          setError("Failed to decrypt image.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadAndDecryptThumbnail();

    return () => {
      isMounted = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [isInViewport, cryptoKey, assetId]);

  const handleUpdateAlignment = (newAlign: ImageAlignment) => {
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if ($isJournalImageNode(node)) {
        node.setAlignment(newAlign);
      }
    });
  };

  const handleUpdateCaption = (newCaption: string) => {
    setCaptionText(newCaption);
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if ($isJournalImageNode(node)) {
        node.setCaption(newCaption);
      }
    });
  };

  const handleDelete = () => {
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if (node) {
        node.remove();
      }
    });
    deleteJournalAssetAction(assetId).catch(() => {});
  };

  // Alignment container styles
  const alignmentStyles: Record<ImageAlignment, React.CSSProperties> = {
    left: { float: "left", marginRight: "16px", marginBottom: "12px", maxWidth: "45%" },
    center: { display: "flex", flexDirection: "column", alignItems: "center", margin: "16px auto" },
    right: { float: "right", marginLeft: "16px", marginBottom: "12px", maxWidth: "45%" },
    full: { width: "100%", margin: "16px 0" },
  };

  const lightboxItems: LightboxItem[] = assetRecord
    ? [
        {
          assetId,
          assetRecord,
          cloudinaryOriginalPublicId: assetRecord.cloudinaryOriginalPublicId,
          originalIv: assetRecord.originalIv,
          mimeType: assetRecord.mimeType,
          caption: captionText,
          width: assetRecord.width,
          height: assetRecord.height,
        },
      ]
    : [];

  return (
    <div
      ref={containerRef}
      style={{
        ...alignmentStyles[alignment],
        position: "relative",
      }}
      className="journal-image-node-container"
    >
      <div
        style={{
          position: "relative",
          borderRadius: "8px",
          overflow: "hidden",
          border: "1px solid var(--border-color)",
          backgroundColor: "var(--bg-hover)",
          minHeight: "120px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Loading Spinner */}
        {loading && (
          <div style={{ padding: "30px", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", color: "var(--text-muted)", fontSize: "12px" }}>
            <Loader2 size={20} className="spin" style={{ color: "var(--accent)" }} />
            <span>Decrypting Image (DEK)...</span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div style={{ padding: "20px", color: "#ef4444", fontSize: "12px", textAlign: "center" }}>
            <Lock size={18} style={{ marginBottom: "4px" }} />
            <div>{error}</div>
          </div>
        )}

        {/* Decrypted Image */}
        {!loading && !error && decryptedThumbUrl && (
          <div style={{ position: "relative", width: "100%", display: "flex", justifyContent: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={decryptedThumbUrl}
              alt={captionText || "Encrypted Journal Photo"}
              onClick={() => setIsLightboxOpen(true)}
              style={{
                maxWidth: alignment === "full" ? "100%" : "550px",
                maxHeight: "500px",
                width: "auto",
                height: "auto",
                borderRadius: "6px",
                cursor: "zoom-in",
                display: "block",
              }}
            />

            {/* E2EE Lock Badge Overlay */}
            <div
              style={{
                position: "absolute",
                top: "8px",
                left: "8px",
                backgroundColor: "rgba(0,0,0,0.65)",
                backdropFilter: "blur(4px)",
                color: "#fff",
                padding: "3px 8px",
                borderRadius: "4px",
                fontSize: "10px",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: "4px",
                pointerEvents: "none",
              }}
            >
              <Lock size={10} style={{ color: "var(--accent)" }} />
              <span>E2EE</span>
            </div>

            {/* Controls Bar on Hover */}
            <div
              style={{
                position: "absolute",
                top: "8px",
                right: "8px",
                display: "flex",
                gap: "4px",
                backgroundColor: "rgba(0,0,0,0.75)",
                padding: "4px",
                borderRadius: "6px",
                backdropFilter: "blur(4px)",
              }}
            >
              <button type="button" onClick={() => handleUpdateAlignment("left")} style={iconBtnStyle} title="Align Left">
                <AlignLeft size={13} />
              </button>
              <button type="button" onClick={() => handleUpdateAlignment("center")} style={iconBtnStyle} title="Align Center">
                <AlignCenter size={13} />
              </button>
              <button type="button" onClick={() => handleUpdateAlignment("right")} style={iconBtnStyle} title="Align Right">
                <AlignRight size={13} />
              </button>
              <button type="button" onClick={() => handleUpdateAlignment("full")} style={iconBtnStyle} title="Full Width">
                <Maximize2 size={13} />
              </button>
              <button type="button" onClick={() => setIsLightboxOpen(true)} style={iconBtnStyle} title="Fullscreen Lightbox">
                <ImageIcon size={13} />
              </button>
              <button type="button" onClick={handleDelete} style={{ ...iconBtnStyle, color: "#f87171" }} title="Delete Image">
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Caption Input / Display */}
      {(!loading && !error) && (
        <div style={{ marginTop: "6px", textAlign: "center" }}>
          <input
            type="text"
            placeholder="Add caption..."
            value={captionText}
            onChange={(e) => handleUpdateCaption(e.target.value)}
            style={{
              width: "100%",
              textAlign: "center",
              background: "transparent",
              border: "none",
              borderBottom: "1px dashed transparent",
              color: "var(--text-muted)",
              fontSize: "12px",
              fontStyle: "italic",
              outline: "none",
              padding: "2px 4px",
            }}
            onFocus={(e) => (e.target.style.borderBottomColor = "var(--border-color)")}
            onBlur={(e) => (e.target.style.borderBottomColor = "transparent")}
          />
        </div>
      )}

      {/* Lightbox Modal */}
      {isLightboxOpen && (
        <JournalLightboxModal
          isOpen={isLightboxOpen}
          onClose={() => setIsLightboxOpen(false)}
          items={lightboxItems}
          initialIndex={0}
        />
      )}
    </div>
  );
}

const iconBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "#fff",
  padding: "4px",
  borderRadius: "4px",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

// Custom Lexical DecoratorNode for E2EE Journal Images
export class JournalImageNode extends DecoratorNode<React.ReactElement> {
  __assetId: string;
  __width?: number;
  __height?: number;
  __alignment: ImageAlignment;
  __caption: string;
  __displayMode?: string;

  static getType(): string {
    return "journal-image";
  }

  static clone(node: JournalImageNode): JournalImageNode {
    return new JournalImageNode(
      node.__assetId,
      node.__width,
      node.__height,
      node.__alignment,
      node.__caption,
      node.__displayMode,
      node.__key
    );
  }

  constructor(
    assetId: string,
    width?: number,
    height?: number,
    alignment: ImageAlignment = "center",
    caption: string = "",
    displayMode: string = "inline",
    key?: NodeKey
  ) {
    super(key);
    this.__assetId = assetId;
    this.__width = width;
    this.__height = height;
    this.__alignment = alignment;
    this.__caption = caption;
    this.__displayMode = displayMode;
  }

  static importJSON(serializedNode: SerializedLexicalNode): JournalImageNode {
    const node = serializedNode as SerializedJournalImageNode;
    return $createJournalImageNode(
      node.assetId,
      node.width,
      node.height,
      node.alignment,
      node.caption,
      node.displayMode
    );
  }

  exportJSON(): SerializedJournalImageNode {
    return {
      type: "journal-image",
      assetId: this.__assetId,
      width: this.__width,
      height: this.__height,
      alignment: this.__alignment,
      caption: this.__caption,
      displayMode: this.__displayMode,
      version: 1,
    };
  }

  createDOM(): HTMLElement {
    const span = document.createElement("span");
    span.style.display = "inline-block";
    span.style.width = "100%";
    return span;
  }

  updateDOM(): boolean {
    return false;
  }

  setAlignment(alignment: ImageAlignment): void {
    const writable = this.getWritable();
    writable.__alignment = alignment;
  }

  setCaption(caption: string): void {
    const writable = this.getWritable();
    writable.__caption = caption;
  }

  decorate(): React.ReactElement {
    return (
      <JournalImageComponent
        assetId={this.__assetId}
        initialWidth={this.__width}
        initialHeight={this.__height}
        alignment={this.__alignment}
        caption={this.__caption}
        nodeKey={this.__key}
      />
    );
  }
}

export function $createJournalImageNode(
  assetId: string,
  width?: number,
  height?: number,
  alignment: ImageAlignment = "center",
  caption: string = "",
  displayMode: string = "inline"
): JournalImageNode {
  return new JournalImageNode(assetId, width, height, alignment, caption, displayMode);
}

export function $isJournalImageNode(node: unknown): node is JournalImageNode {
  return node instanceof JournalImageNode;
}
