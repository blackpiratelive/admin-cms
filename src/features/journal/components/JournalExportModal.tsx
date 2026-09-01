"use client";

import React, { useState } from "react";
import JSZip from "jszip";
import { DecryptedEntryItem } from "../lib/journal-search";
import { Download, FileText, Code, ShieldCheck, X, FileArchive, Loader2 } from "lucide-react";
import {
  extractPlaintextFromLexicalState,
  formatJournalEntryToMarkdownFile,
  extractAssetIdsFromLexicalState,
  getAssetFileExtension,
  JournalExportAttachment,
} from "../lib/journal-helpers";
import { useJournalAuth } from "../context/JournalAuthContext";
import {
  getJournalAssetsForEntriesAction,
  getJournalAssetsByIdsAction,
} from "../actions";
import { downloadAndDecryptJournalAssetBuffer } from "../lib/crypto-assets";
import { notify } from "@/lib/notifications";

interface JournalExportModalProps {
  items: DecryptedEntryItem[];
  isOpen: boolean;
  onClose: () => void;
}

export function JournalExportModal({ items, isOpen, onClose }: JournalExportModalProps) {
  const { cryptoKey } = useJournalAuth();
  const [exportFormat, setExportFormat] = useState<"markdown" | "json" | "html" | "encrypted_backup">("markdown");
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatusText, setExportStatusText] = useState<string>("");

  if (!isOpen) return null;

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    downloadBlob(blob, filename);
  };

  const handleExport = async () => {
    if (items.length === 0) {
      notify.show({ type: "error", message: "No journal entries found to export." });
      return;
    }

    const dateStr = new Date().toISOString().split("T")[0];
    setIsExporting(true);
    setExportStatusText("Initializing export bundle...");

    try {
      if (exportFormat === "markdown") {
        const zip = new JSZip();

        // 1. Gather all entry IDs and inline AST asset IDs
        const entryIds = items.map((i) => i.record.id);
        const allAstAssetIds = items.flatMap((i) =>
          extractAssetIdsFromLexicalState(i.content?.lexicalState || "")
        );

        setExportStatusText("Fetching attachments and image metadata...");
        const [entryAssets, astAssets] = await Promise.all([
          getJournalAssetsForEntriesAction(entryIds).catch(() => []),
          getJournalAssetsByIdsAction(allAstAssetIds).catch(() => []),
        ]);

        // Deduplicate all assets
        const allAssetsMap = new Map<string, any>();
        for (const a of entryAssets) {
          if (a && a.id) allAssetsMap.set(a.id, a);
        }
        for (const a of astAssets) {
          if (a && a.id && !allAssetsMap.has(a.id)) allAssetsMap.set(a.id, a);
        }
        const allAssets = Array.from(allAssetsMap.values());

        // Map asset IDs to relative zip paths: images/jasset_123.webp
        const assetFilenameMap = new Map<string, string>();
        for (const asset of allAssets) {
          const ext = getAssetFileExtension(asset.mimeType);
          const relativePath = `images/${asset.id}.${ext}`;
          assetFilenameMap.set(asset.id, relativePath);
        }

        // 2. Download and decrypt images
        if (cryptoKey && allAssets.length > 0) {
          let successCount = 0;
          for (let i = 0; i < allAssets.length; i++) {
            const asset = allAssets[i];
            const relativePath = assetFilenameMap.get(asset.id)!;
            setExportStatusText(`Decrypting asset ${i + 1} of ${allAssets.length} (${asset.id})...`);

            try {
              const pubId = asset.cloudinaryOriginalPublicId || asset.cloudinaryThumbnailPublicId;
              const iv = asset.originalIv || asset.thumbnailIv;
              if (pubId && iv) {
                const decryptedBuffer = await downloadAndDecryptJournalAssetBuffer({
                  cloudinaryPublicId: pubId,
                  iv,
                  dekKey: cryptoKey,
                });
                zip.file(relativePath, decryptedBuffer);
                successCount++;
              }
            } catch (imgErr) {
              console.warn(`Failed to export image "${asset.id}":`, imgErr);
            }
          }
        }

        // 3. Map attached assets per entry
        const entryAttachmentsMap = new Map<string, JournalExportAttachment[]>();
        for (const link of entryAssets) {
          if (!link || !link.entryId) continue;
          const list = entryAttachmentsMap.get(link.entryId) || [];
          const imagePath = assetFilenameMap.get(link.id) || `images/${link.id}.webp`;
          list.push({
            id: link.id,
            imagePath,
            assetRole: link.assetRole,
            caption: (link as any).caption,
          });
          entryAttachmentsMap.set(link.entryId, list);
        }

        // 4. Generate markdown files with frontmatter and local image references
        setExportStatusText("Formatting markdown files with YAML frontmatter...");
        const usedFilenames = new Set<string>();

        for (const item of items) {
          const entryAtts = entryAttachmentsMap.get(item.record.id) || [];
          const { filename: baseFilename, content } = formatJournalEntryToMarkdownFile(item, {
            attachments: entryAtts,
            assetFilenameMap,
          });

          let finalFilename = baseFilename;
          let counter = 1;
          while (usedFilenames.has(finalFilename)) {
            const dotIdx = baseFilename.lastIndexOf(".md");
            const nameWithoutExt = dotIdx !== -1 ? baseFilename.substring(0, dotIdx) : baseFilename;
            finalFilename = `${nameWithoutExt}-${counter}.md`;
            counter++;
          }
          usedFilenames.add(finalFilename);

          zip.file(finalFilename, content);
        }

        // 5. Generate and download zip
        setExportStatusText("Compiling zip archive...");
        const zipBlob = await zip.generateAsync({ type: "blob" });
        downloadBlob(zipBlob, `journal_markdown_bundle_${dateStr}.zip`);
        notify.show({
          type: "success",
          message: `Exported ${items.length} entries & ${allAssets.length} images/attachments as .zip bundle!`,
        });
      } else if (exportFormat === "json") {
        const jsonContent = JSON.stringify(
          items.map((i) => ({
            id: i.record.id,
            entryDate: i.record.entryDate,
            entryType: i.record.entryType,
            mood: i.record.mood,
            favorite: i.record.favorite,
            title: i.content?.title,
            content: extractPlaintextFromLexicalState(i.content?.lexicalState || "") || i.content?.markdown,
            tags: i.content?.tags,
          })),
          null,
          2
        );
        downloadFile(jsonContent, `journal_export_${dateStr}.json`, "application/json");
        notify.show({ type: "success", message: `Exported ${items.length} entries as JSON.` });
      } else if (exportFormat === "html") {
        let htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Journal Export ${dateStr}</title><style>body{font-family:sans-serif;max-width:800px;margin:2rem auto;padding:0 1rem;line-height:1.6}h2{border-bottom:1px solid #ddd;padding-bottom:.5rem}.entry{margin-bottom:2rem}</style></head><body><h1>Personal Memory Vault Export</h1>`;
        for (const item of items) {
          if (!item.content) continue;
          const body = extractPlaintextFromLexicalState(item.content.lexicalState) || item.content.markdown || "";
          htmlContent += `<div class="entry"><h2>${item.content.title || "Untitled"} (${item.record.entryDate})</h2><p><em>${item.record.entryType} | ${item.record.mood || ""}</em></p><p>${body.replace(/\n/g, "<br>")}</p></div>`;
        }
        htmlContent += `</body></html>`;
        downloadFile(htmlContent, `journal_export_${dateStr}.html`, "text/html");
        notify.show({ type: "success", message: `Exported ${items.length} entries as HTML archive.` });
      } else if (exportFormat === "encrypted_backup") {
        const backupData = JSON.stringify(
          items.map((i) => ({
            id: i.record.id,
            slug: i.record.slug,
            entryDate: i.record.entryDate,
            entryType: i.record.entryType,
            mood: i.record.mood,
            favorite: i.record.favorite,
            encryptedContent: i.record.encryptedContent,
            iv: i.record.iv,
            salt: i.record.salt,
            wordCount: i.record.wordCount,
            createdAt: i.record.createdAt,
          })),
          null,
          2
        );
        downloadFile(backupData, `journal_encrypted_backup_${dateStr}.json`, "application/json");
        notify.show({ type: "success", message: `Exported ${items.length} encrypted entries backup.` });
      }

      onClose();
    } catch (err: any) {
      console.error("Export error:", err);
      notify.show({ type: "error", message: `Export failed: ${err?.message || "Unknown error"}` });
    } finally {
      setIsExporting(false);
      setExportStatusText("");
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(4px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "480px",
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-color)",
          borderRadius: "10px",
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: "18px",
          color: "var(--text-primary)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, fontSize: "16px" }}>
            <Download size={18} style={{ color: "var(--accent)" }} />
            <span>Export & Encrypted Backup</span>
          </div>
          <button
            onClick={onClose}
            disabled={isExporting}
            style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)" }}>
            Select Export Format ({items.length} entries)
          </label>

          <label
            style={{
              padding: "10px 14px",
              borderRadius: "6px",
              backgroundColor: exportFormat === "markdown" ? "rgba(249, 115, 22, 0.12)" : "var(--bg-input)",
              border: exportFormat === "markdown" ? "1px solid var(--accent)" : "1px solid var(--border-color)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              fontSize: "13px",
            }}
          >
            <input type="radio" name="format" checked={exportFormat === "markdown"} onChange={() => setExportFormat("markdown")} />
            <FileArchive size={16} style={{ color: "var(--accent)" }} />
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span style={{ fontWeight: 600 }}>Markdown Bundle (.zip)</span>
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                Separate .md files with YAML frontmatter (journal: true & date)
              </span>
            </div>
          </label>

          <label
            style={{
              padding: "10px 14px",
              borderRadius: "6px",
              backgroundColor: exportFormat === "json" ? "rgba(249, 115, 22, 0.12)" : "var(--bg-input)",
              border: exportFormat === "json" ? "1px solid var(--accent)" : "1px solid var(--border-color)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              fontSize: "13px",
            }}
          >
            <input type="radio" name="format" checked={exportFormat === "json"} onChange={() => setExportFormat("json")} />
            <Code size={16} />
            <span>Decrypted JSON (.json)</span>
          </label>

          <label
            style={{
              padding: "10px 14px",
              borderRadius: "6px",
              backgroundColor: exportFormat === "html" ? "rgba(249, 115, 22, 0.12)" : "var(--bg-input)",
              border: exportFormat === "html" ? "1px solid var(--accent)" : "1px solid var(--border-color)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              fontSize: "13px",
            }}
          >
            <input type="radio" name="format" checked={exportFormat === "html"} onChange={() => setExportFormat("html")} />
            <FileText size={16} />
            <span>HTML Archive (.html)</span>
          </label>

          <label
            style={{
              padding: "10px 14px",
              borderRadius: "6px",
              backgroundColor: exportFormat === "encrypted_backup" ? "rgba(249, 115, 22, 0.12)" : "var(--bg-input)",
              border: exportFormat === "encrypted_backup" ? "1px solid var(--accent)" : "1px solid var(--border-color)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              fontSize: "13px",
            }}
          >
            <input type="radio" name="format" checked={exportFormat === "encrypted_backup"} onChange={() => setExportFormat("encrypted_backup")} />
            <ShieldCheck size={16} style={{ color: "#22c55e" }} />
            <span>Encrypted Backup (.json)</span>
          </label>
        </div>

        <button
          onClick={handleExport}
          disabled={isExporting}
          style={{
            padding: "12px",
            backgroundColor: "var(--accent)",
            color: "var(--accent-text)",
            border: "none",
            borderRadius: "6px",
            fontWeight: 600,
            fontSize: "14px",
            cursor: isExporting ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            marginTop: "6px",
            opacity: isExporting ? 0.7 : 1,
          }}
        >
          {isExporting ? <Loader2 size={16} className="spin" /> : <Download size={16} />}
          <span>
            {isExporting
              ? exportStatusText || "Generating Bundle..."
              : `Export ${exportFormat === "markdown" ? "MARKDOWN BUNDLE (.ZIP)" : exportFormat.replace("_", " ").toUpperCase()}`}
          </span>
        </button>
      </div>
    </div>
  );
}
