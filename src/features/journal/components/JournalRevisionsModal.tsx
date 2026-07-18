"use client";

import React, { useEffect, useState } from "react";
import { JournalRevisionRecord } from "@/db/schema";
import { getJournalRevisions } from "../actions";
import { useJournalAuth } from "../context/JournalAuthContext";
import { decryptJournalPayload, DecryptedJournalContent, extractPlaintextFromLexicalState } from "../lib/journal-helpers";
import { History, X, RotateCcw, Clock } from "lucide-react";

interface JournalRevisionsModalProps {
  entryId: string;
  isOpen: boolean;
  onClose: () => void;
  onRestoreRevision: (content: DecryptedJournalContent) => void;
}

export function JournalRevisionsModal({
  entryId,
  isOpen,
  onClose,
  onRestoreRevision,
}: JournalRevisionsModalProps) {
  const { cryptoKey } = useJournalAuth();
  const [revisions, setRevisions] = useState<JournalRevisionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [decryptedMap, setDecryptedMap] = useState<Record<string, DecryptedJournalContent>>({});
  const [selectedRevId, setSelectedRevId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !entryId || !cryptoKey) return;

    const fetchRev = async () => {
      setLoading(true);
      try {
        const revs = await getJournalRevisions(entryId);
        setRevisions(revs);

        const decMap: Record<string, DecryptedJournalContent> = {};
        for (const rev of revs) {
          try {
            const dec = await decryptJournalPayload(rev.encryptedContent, rev.iv, cryptoKey);
            decMap[rev.id] = dec;
          } catch (e) {
            console.error("Revision decrypt error:", e);
          }
        }
        setDecryptedMap(decMap);
        if (revs.length > 0) setSelectedRevId(revs[0].id);
      } catch (err) {
        console.error("Error loading revisions:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchRev();
  }, [isOpen, entryId, cryptoKey]);

  if (!isOpen) return null;

  const selectedRev = revisions.find((r) => r.id === selectedRevId);
  const selectedDecrypted = selectedRevId ? decryptedMap[selectedRevId] : null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.7)",
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
          maxWidth: "720px",
          maxHeight: "85vh",
          backgroundColor: "var(--bg-card, #141416)",
          border: "1px solid var(--border-color, #27272a)",
          borderRadius: "10px",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          color: "var(--text-primary)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "14px 18px",
            borderBottom: "1px solid var(--border-color)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, fontSize: "15px" }}>
            <History size={18} style={{ color: "var(--accent)" }} />
            <span>Encrypted Revision History</span>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content body */}
        <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", flex: 1, overflow: "hidden" }}>
          {/* Revisions sidebar list */}
          <div style={{ borderRight: "1px solid var(--border-color)", overflowY: "auto", padding: "10px" }}>
            {loading ? (
              <div style={{ padding: "12px", fontSize: "13px", color: "var(--text-muted)" }}>Loading revisions...</div>
            ) : revisions.length === 0 ? (
              <div style={{ padding: "12px", fontSize: "13px", color: "var(--text-muted)" }}>No previous revisions</div>
            ) : (
              revisions.map((rev, idx) => {
                const dec = decryptedMap[rev.id];
                const isSelected = rev.id === selectedRevId;
                return (
                  <button
                    key={rev.id}
                    onClick={() => setSelectedRevId(rev.id)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 12px",
                      borderRadius: "6px",
                      backgroundColor: isSelected ? "var(--bg-input, #09090b)" : "transparent",
                      border: isSelected ? "1px solid var(--accent, #f97316)" : "1px solid transparent",
                      color: "var(--text-primary)",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                      marginBottom: "6px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 600 }}>
                      <Clock size={12} style={{ color: "var(--accent)" }} />
                      <span>{new Date(rev.createdAt).toLocaleString()}</span>
                    </div>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                      {dec?.title || `Revision #${revisions.length - idx}`}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {/* Selected revision preview */}
          <div style={{ padding: "16px 20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "14px" }}>
            {selectedDecrypted ? (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700 }}>{selectedDecrypted.title}</h3>
                  <button
                    onClick={() => {
                      onRestoreRevision(selectedDecrypted);
                      onClose();
                    }}
                    style={{
                      padding: "6px 12px",
                      backgroundColor: "var(--accent, #f97316)",
                      color: "#fff",
                      border: "none",
                      borderRadius: "4px",
                      fontWeight: 600,
                      fontSize: "12px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <RotateCcw size={14} />
                    <span>Restore Version</span>
                  </button>
                </div>
                <div
                  style={{
                    padding: "14px",
                    backgroundColor: "var(--bg-input, #09090b)",
                    borderRadius: "6px",
                    fontSize: "13px",
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                    color: "var(--text-secondary)",
                  }}
                >
                  {extractPlaintextFromLexicalState(selectedDecrypted.lexicalState) || selectedDecrypted.markdown}
                </div>
              </>
            ) : (
              <div style={{ padding: "20px", color: "var(--text-muted)", fontSize: "13px" }}>
                Select a revision to preview its decrypted content.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
