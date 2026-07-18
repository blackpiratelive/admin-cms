"use client";

import React, { useState } from "react";
import { DecryptedEntryItem } from "../lib/journal-search";
import { Download, FileText, Code, ShieldCheck, X } from "lucide-react";
import { extractPlaintextFromLexicalState } from "../lib/journal-helpers";

interface JournalExportModalProps {
  items: DecryptedEntryItem[];
  isOpen: boolean;
  onClose: () => void;
}

export function JournalExportModal({ items, isOpen, onClose }: JournalExportModalProps) {
  const [exportFormat, setExportFormat] = useState<"markdown" | "json" | "html" | "encrypted_backup">("markdown");

  if (!isOpen) return null;

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExport = () => {
    const dateStr = new Date().toISOString().split("T")[0];

    if (exportFormat === "markdown") {
      let mdContent = `# Encrypted Journal Export - ${dateStr}\n\n`;
      for (const item of items) {
        if (!item.content) continue;
        const body = extractPlaintextFromLexicalState(item.content.lexicalState) || item.content.markdown || "";
        mdContent += `## ${item.content.title || "Untitled"} (${item.record.entryDate})\n`;
        mdContent += `**Type**: ${item.record.entryType} | **Mood**: ${item.record.mood || "N/A"}\n\n`;
        mdContent += `${body}\n\n---\n\n`;
      }
      downloadFile(mdContent, `journal_export_${dateStr}.md`, "text/markdown");
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
    } else if (exportFormat === "html") {
      let htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Journal Export ${dateStr}</title><style>body{font-family:sans-serif;max-width:800px;margin:2rem auto;padding:0 1rem;line-height:1.6}h2{border-bottom:1px solid #ddd;padding-bottom:.5rem}.entry{margin-bottom:2rem}</style></head><body><h1>Personal Memory Vault Export</h1>`;
      for (const item of items) {
        if (!item.content) continue;
        const body = extractPlaintextFromLexicalState(item.content.lexicalState) || item.content.markdown || "";
        htmlContent += `<div class="entry"><h2>${item.content.title || "Untitled"} (${item.record.entryDate})</h2><p><em>${item.record.entryType} | ${item.record.mood || ""}</em></p><p>${body.replace(/\n/g, "<br>")}</p></div>`;
      }
      htmlContent += `</body></html>`;
      downloadFile(htmlContent, `journal_export_${dateStr}.html`, "text/html");
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
    }

    onClose();
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
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
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
            <FileText size={16} />
            <span>Markdown Bundle (.md)</span>
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
          style={{
            padding: "12px",
            backgroundColor: "var(--accent)",
            color: "var(--accent-text)",
            border: "none",
            borderRadius: "6px",
            fontWeight: 600,
            fontSize: "14px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            marginTop: "6px",
          }}
        >
          <Download size={16} />
          <span>Export {exportFormat.replace("_", " ").toUpperCase()}</span>
        </button>
      </div>
    </div>
  );
}
