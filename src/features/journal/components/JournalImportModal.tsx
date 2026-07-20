"use client";

import React, { useState, useEffect } from "react";
import JSZip from "jszip";
import { useJournalAuth } from "../context/JournalAuthContext";
import { createJournalEntry, undoJournalImportAction } from "../actions";
import { processAndUploadEncryptedJournalAsset } from "../lib/crypto-assets";
import { encryptJournalPayload, calculateWordCount, calculateReadingTime, extractPlaintextFromLexicalState, sanitizeLexicalStateJson } from "../lib/journal-helpers";
import { notify } from "@/lib/notifications";
import {
  Upload,
  FileArchive,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  X,
  RefreshCw,
  Image as ImageIcon,
  Calendar,
  Tag,
  Smile,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

interface ParsedImportEntry {
  id: string;
  index: number;
  selected: boolean;
  expanded: boolean;
  entryDate: string;
  title: string;
  content: string; // raw text or markdown
  lexicalStateJson: string;
  entryType: string;
  mood: string | null;
  favorite: number;
  visibility: "public" | "private" | "unlisted";
  tags: string[];
  imageNames: string[];
  imageFiles: File[];
}

interface LastImportData {
  timestamp: string;
  entryIds: string[];
  assetIds: string[];
  count: number;
}

interface JournalImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: () => void;
}

function buildLexicalStateFromText(text: string): string {
  if (!text) {
    return JSON.stringify({
      root: { children: [], direction: null, format: "", indent: 0, type: "root", version: 1 },
    });
  }

  const paragraphs = text.split("\n\n").filter((p) => p.trim().length > 0);
  const children = paragraphs.map((p) => ({
    children: [
      {
        detail: 0,
        format: 0,
        mode: "normal",
        style: "",
        text: p.trim(),
        type: "text",
        version: 1,
      },
    ],
    direction: "ltr",
    format: "",
    indent: 0,
    type: "paragraph",
    version: 1,
    textFormat: 0,
  }));

  return JSON.stringify({
    root: {
      children,
      direction: "ltr",
      format: "",
      indent: 0,
      type: "root",
      version: 1,
    },
  });
}

function isLexicalJsonString(str: string): boolean {
  if (!str || typeof str !== "string") return false;
  const trimmed = str.trim();
  return trimmed.startsWith("{") && trimmed.includes('"root"') && trimmed.includes('"children"');
}

function parseMood(rawMood: any): string | null {
  if (rawMood === null || rawMood === undefined) return null;
  if (typeof rawMood === "number") {
    if (rawMood >= 8) return "amazing";
    if (rawMood === 7) return "happy";
    if (rawMood >= 5) return "good";
    if (rawMood === 4) return "neutral";
    if (rawMood === 3) return "sad";
    if (rawMood === 2) return "bad";
    if (rawMood <= 1) return "terrible";
  }
  if (typeof rawMood === "string") {
    const lower = rawMood.toLowerCase().trim();
    const valid = ["amazing", "happy", "good", "neutral", "sad", "bad", "terrible"];
    if (valid.includes(lower)) return lower;
    if (lower.includes("amazing") || lower.includes("great") || lower.includes("awesome")) return "amazing";
    if (lower.includes("happy") || lower.includes("joy")) return "happy";
    if (lower.includes("good") || lower.includes("fine")) return "good";
    if (lower.includes("neutral") || lower.includes("okay")) return "neutral";
    if (lower.includes("sad")) return "sad";
    if (lower.includes("bad")) return "bad";
    if (lower.includes("terrible") || lower.includes("awful")) return "terrible";
    return lower;
  }
  return null;
}

export function JournalImportModal({ isOpen, onClose, onImportSuccess }: JournalImportModalProps) {
  const { cryptoKey } = useJournalAuth();

  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [undoing, setUndoing] = useState(false);

  const [parsedEntries, setParsedEntries] = useState<ParsedImportEntry[]>([]);
  const [zipFileName, setZipFileName] = useState<string | null>(null);

  const [importProgress, setImportProgress] = useState<{
    current: number;
    total: number;
    currentBatch: number;
    totalBatches: number;
    statusText: string;
  } | null>(null);

  const [lastImport, setLastImport] = useState<LastImportData | null>(null);
  const [batchSize, setBatchSize] = useState<number>(5);

  // Load last import info from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("last_journal_import");
      if (saved) {
        setLastImport(JSON.parse(saved));
      }
    } catch (err) {
      console.error("Failed to parse last_journal_import from localStorage:", err);
    }
  }, []);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".zip")) {
      notify.show({ type: "error", message: "Please select a valid .zip file." });
      return;
    }

    setParsing(true);
    setZipFileName(file.name);
    setParsedEntries([]);

    try {
      const zip = await JSZip.loadAsync(file);

      // 1. Locate journal.json (prefer root or shortest path)
      let journalJsonEntry: JSZip.JSZipObject | null = null;
      zip.forEach((relativePath, zipObj) => {
        if (zipObj.dir) return;
        const fileName = relativePath.split("/").pop()?.toLowerCase();
        if (fileName === "journal.json") {
          if (!journalJsonEntry || relativePath.length < journalJsonEntry.name.length) {
            journalJsonEntry = zipObj;
          }
        }
      });

      if (!journalJsonEntry) {
        notify.show({ type: "error", message: "Invalid zip archive: journal.json not found." });
        setParsing(false);
        return;
      }

      const jsonString = await (journalJsonEntry as JSZip.JSZipObject).async("string");
      let rawData: any;
      try {
        rawData = JSON.parse(jsonString);
      } catch (err) {
        notify.show({ type: "error", message: "Failed to parse journal.json content." });
        setParsing(false);
        return;
      }

      // Handle root array or object wrapping an entries array
      let rawEntriesArray: any[] = [];
      if (Array.isArray(rawData)) {
        rawEntriesArray = rawData;
      } else if (rawData && typeof rawData === "object") {
        rawEntriesArray = rawData.entries || rawData.journal || rawData.items || rawData.data || [rawData];
      }

      // 2. Extract ALL image files from zip (regardless of root or subdirectories)
      const imagesMap = new Map<string, File>();
      const zipFiles = zip.files;

      for (const relativePath of Object.keys(zipFiles)) {
        const zipObj = zipFiles[relativePath];
        if (zipObj.dir) continue;

        const fileNameOnly = relativePath.split("/").pop() || "";
        if (!fileNameOnly || fileNameOnly.startsWith(".")) continue; // Ignore hidden files like .DS_Store

        const ext = fileNameOnly.split(".").pop()?.toLowerCase() || "";
        if (["jpg", "jpeg", "png", "webp", "gif", "svg", "bmp", "heic"].includes(ext)) {
          const blob = await zipObj.async("blob");
          const mimeType =
            ext === "png"
              ? "image/png"
              : ext === "webp"
              ? "image/webp"
              : ext === "gif"
              ? "image/gif"
              : "image/jpeg";

          const imageFile = new File([blob], fileNameOnly, { type: mimeType });

          // Map under multiple lookup keys to handle any relative path style
          imagesMap.set(fileNameOnly.toLowerCase(), imageFile); // e.g. "1_0.webp"
          imagesMap.set(relativePath.toLowerCase(), imageFile); // e.g. "my-folder/images/1_0.webp"
          imagesMap.set(`images/${fileNameOnly.toLowerCase()}`, imageFile);
        }
      }

      // 3. Process each entry
      const parsedList: ParsedImportEntry[] = rawEntriesArray.map((raw: any, idx: number) => {
        const rawContent =
          typeof raw.content === "string"
            ? raw.content
            : typeof raw.text === "string"
            ? raw.text
            : typeof raw.markdown === "string"
            ? raw.markdown
            : typeof raw.body === "string"
            ? raw.body
            : "";

        let lexicalStateJson = "";
        let displayContent = rawContent;

        if (isLexicalJsonString(rawContent)) {
          lexicalStateJson = sanitizeLexicalStateJson(rawContent);
          displayContent = raw.preview || extractPlaintextFromLexicalState(rawContent) || rawContent;
        } else if (raw.lexicalState && typeof raw.lexicalState === "string") {
          lexicalStateJson = sanitizeLexicalStateJson(raw.lexicalState);
        } else if (raw.lexicalState && typeof raw.lexicalState === "object") {
          lexicalStateJson = sanitizeLexicalStateJson(JSON.stringify(raw.lexicalState));
        } else {
          lexicalStateJson = sanitizeLexicalStateJson(buildLexicalStateFromText(rawContent));
        }

        let title = raw.title || raw.name || "";
        if (!title) {
          const sourceText = raw.preview || displayContent || "";
          const firstLine = sourceText.split("\n")[0]?.replace(/^[#*\s-]+/, "").trim();
          if (firstLine) {
            title = firstLine.length > 60 ? firstLine.substring(0, 60) + "..." : firstLine;
          } else {
            title = `Entry ${idx + 1}`;
          }
        }

        const dateStr =
          raw.entryDate || raw.date || raw.createdAt || raw.created_at || new Date().toISOString().split("T")[0];

        // Format date string to YYYY-MM-DD
        let entryDate = dateStr;
        try {
          const d = new Date(dateStr);
          if (!isNaN(d.getTime())) {
            entryDate = d.toISOString().split("T")[0];
          }
        } catch (e) {
          entryDate = new Date().toISOString().split("T")[0];
        }

        // Tags
        let tags: string[] = [];
        if (Array.isArray(raw.tags)) tags = raw.tags.map(String);
        else if (typeof raw.tags === "string") tags = raw.tags.split(",").map((t: string) => t.trim()).filter(Boolean);

        // Location tag/reference
        if (raw.location && typeof raw.location === "string" && !tags.includes(raw.location)) {
          tags.push(`📍 ${raw.location}`);
        }

        // Images reference
        let rawImages: string[] = [];
        if (Array.isArray(raw.images)) rawImages = raw.images;
        else if (Array.isArray(raw.photos)) rawImages = raw.photos;
        else if (Array.isArray(raw.attachments)) rawImages = raw.attachments;

        const matchedFiles: File[] = [];
        const imageNames: string[] = [];

        for (const item of rawImages) {
          const name = typeof item === "string" ? item : (item as any)?.filename || (item as any)?.name || (item as any)?.url || "";
          if (!name) continue;

          const fileNameOnly = name.split("/").pop()?.toLowerCase() || "";
          const cleanName = name.replace(/^images\//i, "").toLowerCase();

          const found =
            imagesMap.get(fileNameOnly) ||
            imagesMap.get(cleanName) ||
            imagesMap.get(name.toLowerCase()) ||
            imagesMap.get(`images/${fileNameOnly}`);

          if (found && !matchedFiles.includes(found)) {
            matchedFiles.push(found);
            imageNames.push(found.name);
          }
        }

        return {
          id: `imp_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
          index: idx,
          selected: true,
          expanded: false,
          entryDate,
          title,
          content: displayContent,
          lexicalStateJson,
          entryType: raw.entryType || raw.type || "daily",
          mood: parseMood(raw.mood),
          favorite: raw.favorite ? 1 : 0,
          visibility: ["public", "private", "unlisted"].includes(raw.visibility) ? raw.visibility : "private",
          tags,
          imageNames,
          imageFiles: matchedFiles,
        };
      });

      setParsedEntries(parsedList);
      notify.show({
        type: "success",
        message: `Parsed ${parsedList.length} entries & ${imagesMap.size} images from zip.`,
      });
    } catch (err: any) {
      console.error("Zip parse error:", err);
      notify.show({ type: "error", message: `Failed to extract zip: ${err?.message || "Unknown error"}` });
    } finally {
      setParsing(false);
    }
  };

  const toggleSelectAll = (val: boolean) => {
    setParsedEntries((prev) => prev.map((e) => ({ ...e, selected: val })));
  };

  const toggleSelectEntry = (id: string) => {
    setParsedEntries((prev) => prev.map((e) => (e.id === id ? { ...e, selected: !e.selected } : e)));
  };

  const toggleExpandEntry = (id: string) => {
    setParsedEntries((prev) => prev.map((e) => (e.id === id ? { ...e, expanded: !e.expanded } : e)));
  };

  const updateEntryField = (id: string, field: keyof ParsedImportEntry, value: any) => {
    setParsedEntries((prev) => prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
  };

  const handleStartImport = async () => {
    const selectedList = parsedEntries.filter((e) => e.selected);
    if (selectedList.length === 0) {
      notify.show({ type: "error", message: "Please select at least one entry to import." });
      return;
    }

    if (!cryptoKey) {
      notify.show({ type: "error", message: "Vault is locked. Unlock journal before importing." });
      return;
    }

    setImporting(true);

    const createdEntryIds: string[] = [];
    const createdAssetIds: string[] = [];

    const total = selectedList.length;
    const totalBatches = Math.ceil(total / batchSize);

    try {
      for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
        const start = batchIdx * batchSize;
        const end = Math.min(start + batchSize, total);
        const batchItems = selectedList.slice(start, end);

        setImportProgress({
          current: start,
          total,
          currentBatch: batchIdx + 1,
          totalBatches,
          statusText: `Processing batch ${batchIdx + 1} of ${totalBatches}...`,
        });

        for (let i = 0; i < batchItems.length; i++) {
          const item = batchItems[i];
          const currentCount = start + i + 1;

          setImportProgress({
            current: currentCount,
            total,
            currentBatch: batchIdx + 1,
            totalBatches,
            statusText: `Encrypting entry ${currentCount}/${total}: "${item.title}"...`,
          });

          // 1. Prepare E2EE Encrypted Payload
          const wordCount = calculateWordCount(item.content);
          const readingTime = calculateReadingTime(wordCount);

          const payload = {
            title: item.title,
            lexicalState: item.lexicalStateJson,
            markdown: item.content,
            tags: item.tags,
          };

          const encrypted = await encryptJournalPayload(payload, cryptoKey);

          // 2. Save Entry to DB
          const createdEntry = await createJournalEntry({
            entryDate: item.entryDate,
            entryType: item.entryType,
            mood: item.mood || undefined,
            favorite: item.favorite,
            visibility: item.visibility,
            encryptedContent: encrypted.ciphertext,
            iv: encrypted.iv,
            salt: "import_v1",
            wordCount,
            readingTime,
            tags: item.tags,
          });

          createdEntryIds.push(createdEntry.id);

          // 3. Process and Save Image Attachments
          if (item.imageFiles.length > 0) {
            for (let imgIdx = 0; imgIdx < item.imageFiles.length; imgIdx++) {
              const imgFile = item.imageFiles[imgIdx];
              setImportProgress({
                current: currentCount,
                total,
                currentBatch: batchIdx + 1,
                totalBatches,
                statusText: `Encrypting image ${imgIdx + 1}/${item.imageFiles.length} for "${item.title}"...`,
              });

              try {
                const assetRecord = await processAndUploadEncryptedJournalAsset({
                  file: imgFile,
                  dekKey: cryptoKey,
                  entryId: createdEntry.id,
                  assetRole: "attachment",
                });

                if (assetRecord) {
                  createdAssetIds.push(assetRecord.id);
                }
              } catch (imgErr: any) {
                console.error(`Failed to process/upload image attachment "${imgFile.name}":`, imgErr);
                notify.show({
                  type: "error",
                  message: `Attachment "${imgFile.name}" failed: ${imgErr?.message || "Upload error"}. Entry text was saved.`,
                });
              }
            }
          }
        }

        // Slight delay between batches to yield event loop
        await new Promise((resolve) => setTimeout(resolve, 60));
      }

      // Save Undo record to localStorage
      const newUndoData: LastImportData = {
        timestamp: new Date().toISOString(),
        entryIds: createdEntryIds,
        assetIds: createdAssetIds,
        count: createdEntryIds.length,
      };
      localStorage.setItem("last_journal_import", JSON.stringify(newUndoData));
      setLastImport(newUndoData);

      notify.show({
        type: "success",
        message: `Successfully imported ${createdEntryIds.length} entries and ${createdAssetIds.length} image attachments!`,
      });

      onImportSuccess();
      onClose();
    } catch (err: any) {
      console.error("Batch import error:", err);
      notify.show({
        type: "error",
        message: `Import failed halfway: ${err?.message || "Unknown error"}`,
      });
    } finally {
      setImporting(false);
      setImportProgress(null);
    }
  };

  const handleUndoLastImport = async () => {
    if (!lastImport || lastImport.entryIds.length === 0) return;
    if (
      !confirm(
        `Are you sure you want to undo the last import of ${lastImport.count} entries? This will delete those entries and their attachments.`
      )
    )
      return;

    setUndoing(true);
    try {
      await undoJournalImportAction(lastImport.entryIds, lastImport.assetIds);
      localStorage.removeItem("last_journal_import");
      setLastImport(null);

      notify.show({
        type: "success",
        message: `Undone last import! Deleted ${lastImport.count} entries.`,
      });

      onImportSuccess();
    } catch (err: any) {
      console.error("Undo error:", err);
      notify.show({ type: "error", message: `Failed to undo last import: ${err?.message || "Error"}` });
    } finally {
      setUndoing(false);
    }
  };

  const selectedCount = parsedEntries.filter((e) => e.selected).length;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        backdropFilter: "blur(5px)",
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
          maxWidth: "800px",
          maxHeight: "90vh",
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-color)",
          borderRadius: "12px",
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: "18px",
          color: "var(--text-primary)",
          overflowY: "auto",
          boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                padding: "8px",
                borderRadius: "6px",
                backgroundColor: "rgba(249, 115, 22, 0.15)",
                color: "var(--accent)",
                display: "flex",
              }}
            >
              <FileArchive size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>Import Journal Entries (.zip)</h2>
              <p style={{ margin: 0, fontSize: "12px", color: "var(--text-muted)" }}>
                Extracts journal.json & images/ directory, parses metadata, encrypts client-side, and batch saves to DB.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={importing || parsing}
            style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Undo Section */}
        {lastImport && (
          <div
            style={{
              padding: "12px 16px",
              backgroundColor: "rgba(239, 68, 68, 0.08)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}>
              <RotateCcw size={16} style={{ color: "#ef4444" }} />
              <span>
                <strong>Last Import:</strong> {lastImport.count} entries imported on{" "}
                {new Date(lastImport.timestamp).toLocaleString()}
              </span>
            </div>
            <button
              onClick={handleUndoLastImport}
              disabled={undoing || importing}
              style={{
                padding: "6px 12px",
                backgroundColor: "rgba(239, 68, 68, 0.15)",
                color: "#f87171",
                border: "1px solid rgba(239, 68, 68, 0.4)",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              {undoing ? <RefreshCw size={14} className="spin" /> : <RotateCcw size={14} />}
              <span>Undo Last Import</span>
            </button>
          </div>
        )}

        {/* Upload Zip Section */}
        <div
          style={{
            border: "2px dashed var(--border-color)",
            borderRadius: "8px",
            padding: "24px",
            textAlign: "center",
            backgroundColor: "var(--bg-input)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "10px",
            cursor: "pointer",
            position: "relative",
          }}
        >
          <input
            type="file"
            accept=".zip"
            onChange={handleFileChange}
            disabled={parsing || importing}
            style={{
              position: "absolute",
              inset: 0,
              opacity: 0,
              cursor: parsing || importing ? "not-allowed" : "pointer",
            }}
          />
          <Upload size={28} style={{ color: "var(--accent)" }} />
          <div>
            <div style={{ fontSize: "14px", fontWeight: 600 }}>
              {zipFileName ? `Selected: ${zipFileName}` : "Choose or drag a .zip file to import"}
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
              Must contain <code>journal.json</code> at root and optional <code>images/</code> folder.
            </div>
          </div>
          {parsing && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--accent)", fontSize: "13px" }}>
              <RefreshCw size={16} className="spin" />
              <span>Extracting and parsing zip archive...</span>
            </div>
          )}
        </div>

        {/* Parsed Entries Selection & Expandable List */}
        {parsedEntries.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "4px" }}>
            {/* Toolbar */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "10px",
                borderBottom: "1px solid var(--border-color)",
                paddingBottom: "10px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "13px", fontWeight: 700 }}>
                  Found {parsedEntries.length} entries ({selectedCount} selected)
                </span>
                <button
                  onClick={() => toggleSelectAll(true)}
                  style={{
                    fontSize: "12px",
                    background: "none",
                    border: "none",
                    color: "var(--accent)",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  Select All
                </button>
                <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>|</span>
                <button
                  onClick={() => toggleSelectAll(false)}
                  style={{
                    fontSize: "12px",
                    background: "none",
                    border: "none",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  Deselect All
                </button>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <label style={{ fontSize: "12px", color: "var(--text-muted)" }}>Batch Size:</label>
                <select
                  value={batchSize}
                  onChange={(e) => setBatchSize(Number(e.target.value))}
                  style={{
                    padding: "4px 8px",
                    backgroundColor: "var(--bg-input)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "4px",
                    color: "var(--text-primary)",
                    fontSize: "12px",
                  }}
                >
                  <option value={3}>3 per batch</option>
                  <option value={5}>5 per batch</option>
                  <option value={10}>10 per batch</option>
                  <option value={20}>20 per batch</option>
                </select>
              </div>
            </div>

            {/* List */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                maxHeight: "360px",
                overflowY: "auto",
                paddingRight: "4px",
              }}
            >
              {parsedEntries.map((item) => (
                <div
                  key={item.id}
                  style={{
                    border: "1px solid var(--border-color)",
                    borderRadius: "8px",
                    backgroundColor: item.selected ? "var(--bg-card)" : "rgba(0, 0, 0, 0.2)",
                    opacity: item.selected ? 1 : 0.65,
                    transition: "all 0.15s ease",
                  }}
                >
                  {/* Summary Bar */}
                  <div
                    style={{
                      padding: "10px 14px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "12px",
                      cursor: "pointer",
                    }}
                    onClick={() => toggleExpandEntry(item.id)}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: 0 }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelectEntry(item.id);
                        }}
                        style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", padding: 0 }}
                      >
                        {item.selected ? <CheckSquare size={18} /> : <Square size={18} style={{ color: "var(--text-muted)" }} />}
                      </button>

                      <button
                        type="button"
                        style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 0 }}
                      >
                        {item.expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      </button>

                      <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--accent)", minWidth: "85px" }}>
                        {item.entryDate}
                      </span>

                      <span
                        style={{
                          fontSize: "13px",
                          fontWeight: 600,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.title}
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", color: "var(--text-muted)" }}>
                      <span
                        style={{
                          padding: "2px 6px",
                          borderRadius: "4px",
                          backgroundColor: "var(--bg-input)",
                          border: "1px solid var(--border-color)",
                          textTransform: "capitalize",
                        }}
                      >
                        {item.entryType}
                      </span>

                      {item.mood && (
                        <span style={{ padding: "2px 6px", borderRadius: "4px", backgroundColor: "var(--bg-input)" }}>
                          {item.mood}
                        </span>
                      )}

                      {item.imageFiles.length > 0 && (
                        <span
                          style={{
                            padding: "2px 6px",
                            borderRadius: "4px",
                            backgroundColor: "rgba(249, 115, 22, 0.15)",
                            color: "var(--accent)",
                            fontWeight: 600,
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <ImageIcon size={12} />
                          {item.imageFiles.length}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Expandable Content Preview */}
                  {item.expanded && (
                    <div
                      style={{
                        padding: "12px 14px",
                        borderTop: "1px solid var(--border-color)",
                        backgroundColor: "var(--bg-input)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "10px",
                        fontSize: "12px",
                      }}
                    >
                      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                        <div>
                          <strong>Date:</strong>{" "}
                          <input
                            type="date"
                            value={item.entryDate}
                            onChange={(e) => updateEntryField(item.id, "entryDate", e.target.value)}
                            style={{
                              padding: "2px 6px",
                              backgroundColor: "var(--bg-card)",
                              border: "1px solid var(--border-color)",
                              borderRadius: "4px",
                              color: "var(--text-primary)",
                              fontSize: "12px",
                            }}
                          />
                        </div>
                        <div>
                          <strong>Type:</strong>{" "}
                          <input
                            type="text"
                            value={item.entryType}
                            onChange={(e) => updateEntryField(item.id, "entryType", e.target.value)}
                            style={{
                              padding: "2px 6px",
                              backgroundColor: "var(--bg-card)",
                              border: "1px solid var(--border-color)",
                              borderRadius: "4px",
                              color: "var(--text-primary)",
                              fontSize: "12px",
                              width: "100px",
                            }}
                          />
                        </div>
                        <div>
                          <strong>Visibility:</strong> {item.visibility}
                        </div>
                        {item.tags.length > 0 && (
                          <div>
                            <strong>Tags:</strong> {item.tags.join(", ")}
                          </div>
                        )}
                      </div>

                      {item.imageFiles.length > 0 && (
                        <div>
                          <strong>Attached Images ({item.imageFiles.length}):</strong>
                          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "4px" }}>
                            {item.imageFiles.map((f, i) => (
                              <span
                                key={i}
                                style={{
                                  padding: "2px 8px",
                                  backgroundColor: "var(--bg-card)",
                                  border: "1px solid var(--border-color)",
                                  borderRadius: "4px",
                                  fontSize: "11px",
                                }}
                              >
                                📷 {f.name} ({(f.size / 1024).toFixed(1)} KB)
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div>
                        <strong>Content Body Preview:</strong>
                        <div
                          style={{
                            marginTop: "4px",
                            padding: "8px 10px",
                            backgroundColor: "var(--bg-card)",
                            border: "1px solid var(--border-color)",
                            borderRadius: "4px",
                            maxHeight: "120px",
                            overflowY: "auto",
                            whiteSpace: "pre-wrap",
                            fontSize: "12px",
                            color: "var(--text-secondary)",
                            fontFamily: "monospace",
                          }}
                        >
                          {item.content || "(No text content)"}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Import Progress Bar */}
        {importProgress && (
          <div
            style={{
              padding: "14px",
              backgroundColor: "rgba(249, 115, 22, 0.1)",
              border: "1px solid var(--accent)",
              borderRadius: "8px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: 600 }}>
              <span>{importProgress.statusText}</span>
              <span>
                {importProgress.current} / {importProgress.total} ({Math.round((importProgress.current / importProgress.total) * 100)}%)
              </span>
            </div>
            <div style={{ width: "100%", height: "8px", backgroundColor: "var(--bg-input)", borderRadius: "4px", overflow: "hidden" }}>
              <div
                style={{
                  width: `${(importProgress.current / importProgress.total) * 100}%`,
                  height: "100%",
                  backgroundColor: "var(--accent)",
                  transition: "width 0.2s ease",
                }}
              />
            </div>
          </div>
        )}

        {/* Action Footer */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "6px" }}>
          <button
            onClick={onClose}
            disabled={importing || parsing}
            style={{
              padding: "8px 16px",
              backgroundColor: "var(--bg-input)",
              border: "1px solid var(--border-color)",
              borderRadius: "6px",
              color: "var(--text-primary)",
              fontWeight: 600,
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>

          <button
            onClick={handleStartImport}
            disabled={importing || parsing || selectedCount === 0}
            style={{
              padding: "8px 18px",
              backgroundColor: selectedCount > 0 ? "var(--accent)" : "var(--bg-input)",
              color: selectedCount > 0 ? "var(--accent-text)" : "var(--text-muted)",
              border: "none",
              borderRadius: "6px",
              fontWeight: 700,
              fontSize: "13px",
              cursor: selectedCount > 0 && !importing ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            {importing ? (
              <>
                <RefreshCw size={16} className="spin" />
                <span>Importing in Batches...</span>
              </>
            ) : (
              <>
                <Upload size={16} />
                <span>Import {selectedCount} Selected Entries</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
