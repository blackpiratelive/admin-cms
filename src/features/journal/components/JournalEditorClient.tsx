"use client";

import React, { useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useJournalAuth } from "../context/JournalAuthContext";
import { LockScreenModal } from "./LockScreenModal";
import { LexicalJournalEditor } from "./editor/LexicalJournalEditor";
import { JournalConnectionsPanel } from "./JournalConnectionsPanel";
import { JournalAttachments } from "./JournalAttachments";
import { JournalRevisionsModal } from "./JournalRevisionsModal";
import {
  getJournalEntryByIdOrSlug,
  createJournalEntry,
  updateJournalEntry,
} from "../actions";
import {
  generateIv,
  generateSalt,
} from "../lib/crypto";
import {
  ENTRY_TYPES,
  MOODS,
  encryptJournalPayload,
  decryptJournalPayload,
  DecryptedJournalContent,
} from "../lib/journal-helpers";
import { notify } from "@/lib/notifications";
import { ArrowLeft, Save, History, Sparkles, Calendar, Lock } from "lucide-react";

const TEMPLATES = [
  {
    id: "daily",
    name: "Daily Reflection",
    title: "Daily Reflection - " + new Date().toISOString().split("T")[0],
    markdown: `### What went well today?\n- \n\n### What could have been better?\n- \n\n### Gratitude\n- `,
  },
  {
    id: "travel",
    name: "Travel Day",
    title: "Travel Journal Entry",
    markdown: `### Day Highlights\n- \n\n### Locations Visited\n- \n\n### Food & Experiences\n- `,
  },
  {
    id: "meeting",
    name: "Meeting Notes",
    title: "Meeting Notes",
    markdown: `### Attendees\n- \n\n### Key Agenda & Notes\n- \n\n### Action Items\n- [ ] `,
  },
  {
    id: "gratitude",
    name: "Gratitude Journal",
    title: "Gratitude & Mindfulness",
    markdown: `### 3 Things I'm Grateful For Today\n1. \n2. \n3. \n\n### Highlight of the Day\n- `,
  },
  {
    id: "learning",
    name: "Learning Journal",
    title: "Key Insights & Notes",
    markdown: `### Topic Learned\n- \n\n### Key Takeaways\n- \n\n### Questions & Follow-ups\n- `,
  },
];

export function JournalEditorClient() {
  const { isUnlocked, cryptoKey, keyRecord } = useJournalAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  const entryId = searchParams.get("id");
  const initialDateParam = searchParams.get("date");

  const [loading, setLoading] = useState(Boolean(entryId));
  const [saving, setSaving] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [showRevisionsModal, setShowRevisionsModal] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [entryDate, setEntryDate] = useState(() => initialDateParam || new Date().toISOString().split("T")[0]);
  const [entryType, setEntryType] = useState("daily");
  const [mood, setMood] = useState("good");
  const [favorite, setFavorite] = useState(0);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [tripId, setTripId] = useState<string | null>(null);
  const [selectedPeopleIds, setSelectedPeopleIds] = useState<string[]>([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);

  // Lexical state
  const [lexicalStateJson, setLexicalStateJson] = useState("");
  const [plaintextBody, setPlaintextBody] = useState("");
  const [wordCount, setWordCount] = useState(0);
  const [readingTime, setReadingTime] = useState(0);

  // Existing entry record
  const [existingRecord, setExistingRecord] = useState<any | null>(null);

  // Load existing entry for edit
  useEffect(() => {
    if (!entryId || !isUnlocked || !cryptoKey) return;

    const loadEntry = async () => {
      setLoading(true);
      try {
        const rec = await getJournalEntryByIdOrSlug(entryId);
        if (rec) {
          setExistingRecord(rec);
          setEntryDate(rec.entryDate);
          setEntryType(rec.entryType);
          setMood(rec.mood || "good");
          setFavorite(rec.favorite);
          setLocationId(rec.locationId);
          setTripId(rec.tripId);

          const dec = await decryptJournalPayload(rec.encryptedContent, rec.iv, cryptoKey);
          setTitle(dec.title || "");
          setLexicalStateJson(dec.lexicalState || "");
        }
      } catch (err) {
        console.error("Error loading journal entry:", err);
        notify.show({ type: "error", message: "Error decrypting journal entry" });
      } finally {
        setLoading(false);
      }
    };

    loadEntry();
  }, [entryId, isUnlocked, cryptoKey]);

  if (!isUnlocked) {
    return <LockScreenModal />;
  }

  const handleSave = async () => {
    if (!cryptoKey) {
      notify.show({ type: "error", message: "Vault is locked." });
      return;
    }
    if (!title.trim() && !plaintextBody.trim()) {
      notify.show({ type: "error", message: "Please enter a title or content before saving." });
      return;
    }

    setSaving(true);
    setAutosaveStatus("saving");

    try {
      const payload: DecryptedJournalContent = {
        title: title.trim() || "Untitled Journal Entry",
        lexicalState: lexicalStateJson,
        markdown: plaintextBody,
      };

      const encrypted = await encryptJournalPayload(payload, cryptoKey);
      const saltToUse = existingRecord?.salt || keyRecord?.salt || generateSalt();

      const mentions = [
        ...selectedPeopleIds.map((pid) => ({ entityType: "person", entityId: pid })),
        ...selectedProjectIds.map((prid) => ({ entityType: "project", entityId: prid })),
      ];

      if (existingRecord) {
        const updated = await updateJournalEntry(existingRecord.id, {
          entryDate,
          entryType,
          mood,
          favorite,
          locationId: locationId || undefined,
          tripId: tripId || undefined,
          encryptedContent: encrypted.ciphertext,
          iv: encrypted.iv,
          salt: saltToUse,
          wordCount,
          readingTime,
          mentions,
        });
        setExistingRecord(updated);
        notify.show({ type: "success", message: "Journal entry updated." });
      } else {
        const created = await createJournalEntry({
          entryDate,
          entryType,
          mood,
          favorite,
          locationId: locationId || undefined,
          tripId: tripId || undefined,
          encryptedContent: encrypted.ciphertext,
          iv: encrypted.iv,
          salt: saltToUse,
          wordCount,
          readingTime,
          mentions,
        });
        setExistingRecord(created);
        notify.show({ type: "success", message: "Journal entry created." });
        router.replace(`/journal/editor?id=${created.id}`);
      }

      setAutosaveStatus("saved");
    } catch (err) {
      console.error("Save error:", err);
      notify.show({ type: "error", message: "Failed to save journal entry" });
      setAutosaveStatus("error");
    } finally {
      setSaving(false);
    }
  };

  const handleApplyTemplate = (tmplId: string) => {
    const tmpl = TEMPLATES.find((t) => t.id === tmplId);
    if (!tmpl) return;

    if (!title) setTitle(tmpl.title);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Top action bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 18px",
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-color)",
          borderRadius: "8px",
        }}
      >
        <button
          onClick={() => router.push("/journal")}
          style={{
            padding: "6px 12px",
            backgroundColor: "var(--bg-input)",
            border: "1px solid var(--border-color)",
            borderRadius: "6px",
            color: "var(--text-primary)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "13px",
            fontWeight: 600,
          }}
        >
          <ArrowLeft size={16} />
          <span>Back to Memory Vault</span>
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {existingRecord && (
            <button
              onClick={() => setShowRevisionsModal(true)}
              style={{
                padding: "6px 12px",
                backgroundColor: "var(--bg-input)",
                border: "1px solid var(--border-color)",
                borderRadius: "6px",
                color: "var(--text-primary)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "13px",
              }}
            >
              <History size={15} />
              <span>Revisions</span>
            </button>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: "8px 16px",
              backgroundColor: "var(--accent)",
              color: "var(--accent-text)",
              border: "none",
              borderRadius: "6px",
              fontWeight: 600,
              fontSize: "13px",
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.7 : 1,
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Save size={16} />
            <span>{saving ? "Encrypting..." : "Save Entry"}</span>
          </button>
        </div>
      </div>

      {/* Main editor grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "20px", alignItems: "start" }}>
        {/* Left Column: Title & Lexical Editor */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Metadata Controls */}
          <div
            style={{
              padding: "16px",
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              borderRadius: "8px",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "12px",
            }}
          >
            {/* Entry Date */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
                Entry Date
              </label>
              <input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                style={{
                  padding: "8px",
                  backgroundColor: "var(--bg-input)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "4px",
                  color: "var(--text-primary)",
                  fontSize: "13px",
                }}
              />
            </div>

            {/* Entry Type */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
                Entry Type
              </label>
              <select
                value={entryType}
                onChange={(e) => setEntryType(e.target.value)}
                style={{
                  padding: "8px",
                  backgroundColor: "var(--bg-input)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "4px",
                  color: "var(--text-primary)",
                  fontSize: "13px",
                }}
              >
                {ENTRY_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.icon} {t.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Mood */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
                Mood
              </label>
              <select
                value={mood}
                onChange={(e) => setMood(e.target.value)}
                style={{
                  padding: "8px",
                  backgroundColor: "var(--bg-input)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "4px",
                  color: "var(--text-primary)",
                  fontSize: "13px",
                }}
              >
                {MOODS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.emoji} {m.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Template Selector */}
            {!existingRecord && (
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
                  Insert Template
                </label>
                <select
                  onChange={(e) => handleApplyTemplate(e.target.value)}
                  defaultValue=""
                  style={{
                    padding: "8px",
                    backgroundColor: "var(--bg-input)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "4px",
                    color: "var(--text-primary)",
                    fontSize: "13px",
                  }}
                >
                  <option value="" disabled>
                    -- Select Template --
                  </option>
                  {TEMPLATES.map((tmpl) => (
                    <option key={tmpl.id} value={tmpl.id}>
                      {tmpl.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Entry Title Input */}
          <input
            type="text"
            placeholder="Title of your journal entry..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{
              width: "100%",
              padding: "14px 16px",
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              borderRadius: "8px",
              color: "var(--text-primary)",
              fontSize: "20px",
              fontWeight: 700,
              outline: "none",
            }}
          />

          {/* Lexical Rich Text Editor */}
          {loading ? (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
              Decrypting entry content...
            </div>
          ) : (
            <LexicalJournalEditor
              initialStateJson={lexicalStateJson}
              onChange={(json, text, wCount, rTime) => {
                setLexicalStateJson(json);
                setPlaintextBody(text);
                setWordCount(wCount);
                setReadingTime(rTime);
              }}
              autosaveStatus={autosaveStatus}
              onManualSave={handleSave}
              entryId={existingRecord?.id}
            />
          )}

          {/* E2EE Attachments Gallery */}
          {existingRecord && (
            <JournalAttachments entryId={existingRecord.id} />
          )}
        </div>

        {/* Right Column: Contextual Connections Panel */}
        <JournalConnectionsPanel
          entryDate={entryDate}
          locationId={locationId}
          tripId={tripId}
          onLocationChange={setLocationId}
          onTripChange={setTripId}
          selectedPeopleIds={selectedPeopleIds}
          onPeopleChange={setSelectedPeopleIds}
          selectedProjectIds={selectedProjectIds}
          onProjectChange={setSelectedProjectIds}
        />
      </div>

      {existingRecord && (
        <JournalRevisionsModal
          entryId={existingRecord.id}
          isOpen={showRevisionsModal}
          onClose={() => setShowRevisionsModal(false)}
          onRestoreRevision={(restored) => {
            setTitle(restored.title);
            setLexicalStateJson(restored.lexicalState);
            notify.show({ type: "success", message: "Revision restored into editor." });
          }}
        />
      )}
    </div>
  );
}
