"use client";

import React, { useEffect, useState, useTransition } from "react";
import { useJournalAuth } from "../context/JournalAuthContext";
import { LockScreenModal } from "./LockScreenModal";
import { JournalHeader } from "./JournalHeader";
import { JournalDashboardWidget } from "./JournalDashboardWidget";
import { JournalTimeline } from "./JournalTimeline";
import { JournalCalendar } from "./JournalCalendar";
import { JournalExportModal } from "./JournalExportModal";
import { JournalImportModal } from "./JournalImportModal";
import { getJournalEntries, updateJournalEntry, deleteJournalEntry } from "../actions";
import { decryptAllEntries, searchDecryptedEntries, DecryptedEntryItem } from "../lib/journal-search";
import { calculateJournalStats } from "../lib/journal-stats";
import { JournalEntryRecord } from "@/db/schema";
import { useRouter } from "next/navigation";
import { notify } from "@/lib/notifications";
import { BookOpen, RefreshCw } from "lucide-react";
import { JournalSecurityModal } from "./JournalSecurityModal";

export function JournalHubClient() {
  const { isUnlocked, cryptoKey } = useJournalAuth();
  const router = useRouter();

  const [rawRecords, setRawRecords] = useState<JournalEntryRecord[]>([]);
  const [decryptedItems, setDecryptedItems] = useState<DecryptedEntryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [decrypting, setDecrypting] = useState(false);

  const [viewMode, setViewMode] = useState<"timeline" | "calendar" | "stats">("timeline");
  const [searchQuery, setSearchQuery] = useState("");
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showSecurityModal, setShowSecurityModal] = useState(false);

  // Fetch entries from DB
  const loadEntries = async () => {
    setLoading(true);
    try {
      const records = await getJournalEntries();
      setRawRecords(records);
    } catch (err) {
      console.error("Failed to load journal records:", err);
      notify.show({ type: "error", message: "Failed to load journal entries." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEntries();
  }, []);

  // Decrypt entries when unlocked and key is available
  useEffect(() => {
    if (!isUnlocked || !cryptoKey || rawRecords.length === 0) {
      setDecryptedItems([]);
      return;
    }

    const decryptAll = async () => {
      setDecrypting(true);
      try {
        const dec = await decryptAllEntries(rawRecords, cryptoKey);
        setDecryptedItems(dec);
      } catch (err) {
        console.error("Error decrypting entries:", err);
        notify.show({ type: "error", message: "Error decrypting journal entries." });
      } finally {
        setDecrypting(false);
      }
    };

    decryptAll();
  }, [isUnlocked, cryptoKey, rawRecords]);

  if (!isUnlocked) {
    return <LockScreenModal />;
  }

  const filteredItems = searchDecryptedEntries(decryptedItems, searchQuery);
  const stats = calculateJournalStats(decryptedItems);

  const handleToggleFavorite = async (item: DecryptedEntryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const newFav = item.record.favorite === 1 ? 0 : 1;
    try {
      await updateJournalEntry(item.record.id, { favorite: newFav });
      setRawRecords((prev) =>
        prev.map((r) => (r.id === item.record.id ? { ...r, favorite: newFav } : r))
      );
      notify.show({ type: "success", message: newFav ? "Added to favorites" : "Removed from favorites" });
    } catch (err) {
      notify.show({ type: "error", message: "Failed to update favorite status" });
    }
  };

  const handleDeleteEntry = async (item: DecryptedEntryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this journal entry? This action cannot be undone.")) return;

    try {
      await deleteJournalEntry(item.record.id);
      setRawRecords((prev) => prev.filter((r) => r.id !== item.record.id));
      notify.show({ type: "success", message: "Journal entry deleted." });
    } catch (err) {
      notify.show({ type: "error", message: "Failed to delete journal entry." });
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <JournalHeader
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onNewEntry={() => router.push("/journal/editor")}
        onExportClick={() => setShowExportModal(true)}
        onImportClick={() => setShowImportModal(true)}
        onSecurityClick={() => setShowSecurityModal(true)}
      />

      <JournalDashboardWidget stats={stats} />

      {decrypting ? (
        <div
          style={{
            padding: "40px",
            textAlign: "center",
            color: "var(--text-muted)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
          }}
        >
          <RefreshCw size={18} className="spin" />
          <span>Decrypting journal entries in browser memory...</span>
        </div>
      ) : viewMode === "timeline" ? (
        <JournalTimeline
          items={filteredItems}
          onSelectEntry={(item) => router.push(`/journal/editor?id=${item.record.id}`)}
          onToggleFavorite={handleToggleFavorite}
          onDeleteEntry={handleDeleteEntry}
        />
      ) : viewMode === "calendar" ? (
        <JournalCalendar
          items={decryptedItems}
          onSelectEntry={(item) => router.push(`/journal/editor?id=${item.record.id}`)}
          onSelectDate={(dateStr) => router.push(`/journal/editor?date=${dateStr}`)}
        />
      ) : (
        /* Detailed Stats View */
        <div
          style={{
            padding: "24px",
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-color)",
            borderRadius: "8px",
            color: "var(--text-primary)",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700 }}>Vault Statistics</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
            <div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Total Words Written</div>
              <div style={{ fontSize: "24px", fontWeight: 800 }}>{stats.totalWords.toLocaleString()}</div>
            </div>
            <div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Average Entry Length</div>
              <div style={{ fontSize: "24px", fontWeight: 800 }}>{stats.avgWordsPerEntry} words</div>
            </div>
            <div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Longest Entry</div>
              <div style={{ fontSize: "24px", fontWeight: 800 }}>{stats.longestEntryWords} words</div>
            </div>
            <div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Current Streak</div>
              <div style={{ fontSize: "24px", fontWeight: 800, color: "var(--accent)" }}>{stats.currentStreak} days</div>
            </div>
          </div>
        </div>
      )}

      <JournalExportModal
        items={decryptedItems}
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
      />

      <JournalImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportSuccess={loadEntries}
      />

      <JournalSecurityModal
        isOpen={showSecurityModal}
        onClose={() => setShowSecurityModal(false)}
        onExportBackup={() => setShowExportModal(true)}
      />
    </div>
  );
}
