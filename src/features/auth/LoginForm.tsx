"use client";

import React, { useState } from "react";
import { loginAction } from "./actions";
import { Lock, ArrowRight, AlertCircle } from "lucide-react";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsPending(true);

    const formData = new FormData(e.currentTarget);
    try {
      const res = await loginAction(formData);
      if (res?.error) {
        setError(res.error);
      }
    } catch (err) {
      // In Next.js server actions, redirect throws an internal error, handled by framework
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="auth-box">
      <div className="auth-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <Lock size={18} />
        <span>Personal CMS Login</span>
      </div>
      <p className="auth-desc">Single-user administration panel for Hugo + Turso.</p>

      {error && (
        <div
          style={{
            background: "#ffebee",
            color: "#c62828",
            border: "1px solid #ffcdd2",
            padding: "8px 12px",
            fontSize: "12px",
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label" htmlFor="password">
            Admin Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoFocus
            className="text-input"
            placeholder="Enter ADMIN_PASSWORD..."
            style={{ width: "100%" }}
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          style={{ width: "100%", justifyContent: "center", marginTop: "8px" }}
          disabled={isPending}
        >
          <span>{isPending ? "Authenticating..." : "Enter Dashboard"}</span>
          <ArrowRight size={16} />
        </button>
      </form>
    </div>
  );
}
