"use client";

import React, { useState } from "react";
import { useJournalAuth } from "../context/JournalAuthContext";
import { Lock, KeyRound, ShieldCheck, AlertCircle, Eye, EyeOff } from "lucide-react";

export function LockScreenModal() {
  const { isConfigured, unlock, setupPassword, loading } = useJournalAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [autoLockMinutes, setAutoLockMinutes] = useState(15);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "var(--bg-primary)",
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-muted)",
        }}
      >
        <span>Checking encryption status...</span>
      </div>
    );
  }

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!password) {
      setError("Please enter your journal password.");
      return;
    }

    setSubmitting(true);
    try {
      const success = await unlock(password);
      if (!success) {
        setError("Invalid password. Decryption failed.");
      }
    } catch (err) {
      setError("An error occurred during decryption.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const success = await setupPassword(password, autoLockMinutes);
      if (!success) {
        setError("Failed to setup journal password.");
      }
    } catch (err) {
      setError("Error setting up encryption key.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(8px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "440px",
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-color)",
          borderRadius: "12px",
          padding: "32px 28px",
          boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          color: "var(--text-primary)",
        }}
      >
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              backgroundColor: "rgba(249, 115, 22, 0.15)",
              color: "var(--accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {isConfigured ? <Lock size={26} /> : <KeyRound size={26} />}
          </div>
          <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 700 }}>
            {isConfigured ? "Unlock Journal" : "Setup Encryption Password"}
          </h2>
          <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.5 }}>
            {isConfigured
              ? "Your journal entries are end-to-end encrypted with AES-256-GCM. Enter your master password to derive the key in browser memory."
              : "Set up a dedicated password for your personal journal. The key is derived in your browser and never sent to the server."}
          </p>
        </div>

        {error && (
          <div
            style={{
              padding: "10px 14px",
              backgroundColor: "rgba(239, 68, 68, 0.12)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "6px",
              color: "#f87171",
              fontSize: "13px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {isConfigured ? (
          <form onSubmit={handleUnlock} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)" }}>
                Journal Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter master journal password..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                  style={{
                    width: "100%",
                    padding: "10px 38px 10px 12px",
                    backgroundColor: "var(--bg-input)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "6px",
                    color: "var(--text-primary)",
                    fontSize: "14px",
                    outline: "none",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute",
                    right: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: "12px",
                backgroundColor: "var(--accent)",
                color: "var(--accent-text)",
                border: "none",
                borderRadius: "6px",
                fontWeight: 600,
                fontSize: "14px",
                cursor: submitting ? "not-allowed" : "pointer",
                opacity: submitting ? 0.7 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              <ShieldCheck size={18} />
              <span>{submitting ? "Decrypting..." : "Unlock Memory Vault"}</span>
            </button>
          </form>
        ) : (
          <form onSubmit={handleSetup} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)" }}>
                New Password (min 6 chars)
              </label>
              <input
                type="password"
                placeholder="Enter strong password..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  backgroundColor: "var(--bg-input)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "6px",
                  color: "var(--text-primary)",
                  fontSize: "14px",
                  outline: "none",
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)" }}>
                Confirm Password
              </label>
              <input
                type="password"
                placeholder="Re-enter password..."
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  backgroundColor: "var(--bg-input)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "6px",
                  color: "var(--text-primary)",
                  fontSize: "14px",
                  outline: "none",
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)" }}>
                Inactivity Auto Lock
              </label>
              <select
                value={autoLockMinutes}
                onChange={(e) => setAutoLockMinutes(Number(e.target.value))}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  backgroundColor: "var(--bg-input)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "6px",
                  color: "var(--text-primary)",
                  fontSize: "14px",
                  outline: "none",
                }}
              >
                <option value={0}>Immediately on blur</option>
                <option value={5}>After 5 minutes</option>
                <option value={10}>After 10 minutes</option>
                <option value={15}>After 15 minutes</option>
                <option value={30}>After 30 minutes</option>
                <option value={60}>After 1 hour</option>
                <option value={-1}>Manual lock only</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: "12px",
                backgroundColor: "var(--accent)",
                color: "var(--accent-text)",
                border: "none",
                borderRadius: "6px",
                fontWeight: 600,
                fontSize: "14px",
                cursor: submitting ? "not-allowed" : "pointer",
                opacity: submitting ? 0.7 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                marginTop: "4px",
              }}
            >
              <ShieldCheck size={18} />
              <span>{submitting ? "Initializing Key..." : "Create Encrypted Journal"}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
