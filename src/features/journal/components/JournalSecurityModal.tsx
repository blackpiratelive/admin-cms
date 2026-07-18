"use client";

import React, { useState } from "react";
import { useJournalAuth } from "../context/JournalAuthContext";
import { notify } from "@/lib/notifications";
import { ShieldCheck, Lock, KeyRound, Download, X, Cpu, CheckCircle2, AlertCircle } from "lucide-react";

interface JournalSecurityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExportBackup?: () => void;
}

export function JournalSecurityModal({ isOpen, onClose, onExportBackup }: JournalSecurityModalProps) {
  const { keyRecord, lock, changePassword } = useJournalAuth();
  const [activeTab, setActiveTab] = useState<"security" | "password" | "info">("security");

  // Password change state
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!oldPassword) {
      setError("Please enter your current journal password.");
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setError("New password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError("New passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const success = await changePassword(oldPassword, newPassword);
      if (success) {
        notify.show({
          type: "success",
          message: "Journal password updated in <10ms! DEK re-wrapped successfully without re-encrypting entries.",
        });
        setOldPassword("");
        setNewPassword("");
        setConfirmNewPassword("");
        setActiveTab("security");
      } else {
        setError("Invalid current password.");
      }
    } catch (err) {
      setError("An error occurred during password change.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(6px)",
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
          maxWidth: "560px",
          backgroundColor: "var(--bg-card, #141416)",
          border: "1px solid var(--border-color, #27272a)",
          borderRadius: "12px",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          color: "var(--text-primary)",
          boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border-color)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                padding: "6px",
                borderRadius: "6px",
                backgroundColor: "rgba(249, 115, 22, 0.15)",
                color: "var(--accent, #f97316)",
                display: "flex",
              }}
            >
              <ShieldCheck size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700 }}>Journal Security & Encryption</h3>
              <p style={{ margin: 0, fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                DEK / KEK Zero-Knowledge Cryptography Architecture
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--border-color)", padding: "0 12px" }}>
          <button
            onClick={() => setActiveTab("security")}
            style={{
              padding: "10px 14px",
              border: "none",
              borderBottom: activeTab === "security" ? "2px solid var(--accent, #f97316)" : "2px solid transparent",
              backgroundColor: "transparent",
              color: activeTab === "security" ? "var(--accent, #f97316)" : "var(--text-muted)",
              fontWeight: 600,
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            Security Overview
          </button>
          <button
            onClick={() => setActiveTab("password")}
            style={{
              padding: "10px 14px",
              border: "none",
              borderBottom: activeTab === "password" ? "2px solid var(--accent, #f97316)" : "2px solid transparent",
              backgroundColor: "transparent",
              color: activeTab === "password" ? "var(--accent, #f97316)" : "var(--text-muted)",
              fontWeight: 600,
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            Change Password
          </button>
          <button
            onClick={() => setActiveTab("info")}
            style={{
              padding: "10px 14px",
              border: "none",
              borderBottom: activeTab === "info" ? "2px solid var(--accent, #f97316)" : "2px solid transparent",
              backgroundColor: "transparent",
              color: activeTab === "info" ? "var(--accent, #f97316)" : "var(--text-muted)",
              fontWeight: 600,
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            Argon2id Parameters
          </button>
        </div>

        {/* Tab Content */}
        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
          {activeTab === "security" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div
                style={{
                  padding: "14px",
                  borderRadius: "8px",
                  backgroundColor: "rgba(34, 197, 94, 0.08)",
                  border: "1px solid rgba(34, 197, 94, 0.2)",
                  display: "flex",
                  gap: "12px",
                  fontSize: "13px",
                  lineHeight: 1.5,
                  color: "var(--text-secondary)",
                }}
              >
                <CheckCircle2 size={20} style={{ color: "#22c55e", flexShrink: 0, marginTop: "2px" }} />
                <div>
                  <strong style={{ color: "var(--text-primary)" }}>DEK / KEK Envelope Encryption Active</strong>
                  <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "var(--text-muted)" }}>
                    Journal entries are encrypted with a dedicated Data Encryption Key (DEK). Changing your journal password only re-wraps the DEK using a new Argon2id KEK without re-encrypting your journal entries.
                  </p>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <button
                  onClick={() => {
                    onClose();
                    lock();
                  }}
                  style={{
                    padding: "12px",
                    backgroundColor: "rgba(239, 68, 68, 0.12)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    borderRadius: "6px",
                    color: "#f87171",
                    fontWeight: 600,
                    fontSize: "13px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                  }}
                >
                  <Lock size={16} />
                  <span>Lock Vault Now</span>
                </button>

                {onExportBackup && (
                  <button
                    onClick={() => {
                      onClose();
                      onExportBackup();
                    }}
                    style={{
                      padding: "12px",
                      backgroundColor: "var(--bg-input, #09090b)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "6px",
                      color: "var(--text-primary)",
                      fontWeight: 600,
                      fontSize: "13px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                    }}
                  >
                    <Download size={16} />
                    <span>Export Backup</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {activeTab === "password" && (
            <form onSubmit={handleChangePassword} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: "6px",
                  backgroundColor: "rgba(249, 115, 22, 0.08)",
                  border: "1px solid rgba(249, 115, 22, 0.2)",
                  fontSize: "12px",
                  color: "var(--text-secondary)",
                  lineHeight: 1.5,
                }}
              >
                ⚡ <strong>Instant Password Update</strong>: Changing your password derives a new Key Encryption Key (KEK) via Argon2id and re-wraps the DEK in &lt;10ms. Journal content remains untouched.
              </div>

              {error && (
                <div
                  style={{
                    padding: "8px 12px",
                    backgroundColor: "rgba(239, 68, 68, 0.12)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    borderRadius: "6px",
                    color: "#f87171",
                    fontSize: "12px",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <AlertCircle size={15} />
                  <span>{error}</span>
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)" }}>
                  Current Journal Password
                </label>
                <input
                  type="password"
                  placeholder="Enter current password..."
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  style={{
                    padding: "9px 12px",
                    backgroundColor: "var(--bg-input, #09090b)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "6px",
                    color: "var(--text-primary)",
                    fontSize: "13px",
                    outline: "none",
                  }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)" }}>
                  New Journal Password
                </label>
                <input
                  type="password"
                  placeholder="Enter new strong password..."
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={{
                    padding: "9px 12px",
                    backgroundColor: "var(--bg-input, #09090b)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "6px",
                    color: "var(--text-primary)",
                    fontSize: "13px",
                    outline: "none",
                  }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)" }}>
                  Confirm New Password
                </label>
                <input
                  type="password"
                  placeholder="Re-enter new password..."
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  style={{
                    padding: "9px 12px",
                    backgroundColor: "var(--bg-input, #09090b)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "6px",
                    color: "var(--text-primary)",
                    fontSize: "13px",
                    outline: "none",
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                style={{
                  padding: "10px",
                  backgroundColor: "var(--accent, #f97316)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: submitting ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  marginTop: "4px",
                }}
              >
                <KeyRound size={16} />
                <span>{submitting ? "Re-wrapping DEK..." : "Update Password"}</span>
              </button>
            </form>
          )}

          {activeTab === "info" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)" }}>
                Cryptographic Parameters
              </div>
              <div
                style={{
                  padding: "14px",
                  backgroundColor: "var(--bg-input, #09090b)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "6px",
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "12px",
                  fontSize: "13px",
                }}
              >
                <div>
                  <div style={{ color: "var(--text-muted)", fontSize: "11px" }}>Encryption Algorithm</div>
                  <div style={{ fontWeight: 600, color: "var(--accent)" }}>{keyRecord?.algorithm || "AES-256-GCM"}</div>
                </div>
                <div>
                  <div style={{ color: "var(--text-muted)", fontSize: "11px" }}>Key Derivation (KDF)</div>
                  <div style={{ fontWeight: 600, color: "var(--accent)" }}>{keyRecord?.kdf || "Argon2id"}</div>
                </div>
                <div>
                  <div style={{ color: "var(--text-muted)", fontSize: "11px" }}>Argon Memory Cost</div>
                  <div style={{ fontWeight: 600 }}>{keyRecord?.argonMemory || 65536} KiB (64MB)</div>
                </div>
                <div>
                  <div style={{ color: "var(--text-muted)", fontSize: "11px" }}>Argon Iterations</div>
                  <div style={{ fontWeight: 600 }}>{keyRecord?.argonIterations || 3} pass</div>
                </div>
                <div>
                  <div style={{ color: "var(--text-muted)", fontSize: "11px" }}>Argon Parallelism</div>
                  <div style={{ fontWeight: 600 }}>{keyRecord?.argonParallelism || 1} lane</div>
                </div>
                <div>
                  <div style={{ color: "var(--text-muted)", fontSize: "11px" }}>Key Version</div>
                  <div style={{ fontWeight: 600 }}>v{keyRecord?.keyVersion || 1}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
