"use client";

import React, { useState } from "react";
import { createAccountAction, deleteUserAction, type SafeUser } from "@/features/auth/users-actions";
import { UserPlus, Users, Trash2, CheckCircle2, AlertCircle, Shield, User } from "lucide-react";

interface UserAccountsManagerProps {
  initialUsers: SafeUser[];
}

export function UserAccountsManager({ initialUsers }: UserAccountsManagerProps) {
  const [usersList, setUsersList] = useState<SafeUser[]>(initialUsers);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsPending(true);

    const form = e.currentTarget;
    const formData = new FormData(form);

    try {
      const res = await createAccountAction(formData);
      if (res?.error) {
        setError(res.error);
      } else if (res?.success && res.user) {
        setSuccess(`User account '@${res.user.username}' created successfully.`);
        setUsersList([res.user, ...usersList]);
        form.reset();
      }
    } catch (err: any) {
      setError(err?.message || "Failed to create account.");
    } finally {
      setIsPending(false);
    }
  };

  const handleDelete = async (user: SafeUser) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete user account '@${user.username}'?`
    );
    if (!confirmed) return;

    setDeletingId(user.id);
    setError(null);
    setSuccess(null);

    try {
      const res = await deleteUserAction(user.id);
      if (res?.error) {
        setError(res.error);
      } else {
        setSuccess(`User '@${user.username}' deleted.`);
        setUsersList(usersList.filter((u) => u.id !== user.id));
      }
    } catch (err: any) {
      setError(err?.message || "Failed to delete account.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* Notifications */}
      {error && (
        <div
          style={{
            background: "#ffebee",
            color: "#c62828",
            border: "1px solid #ffcdd2",
            padding: "10px 14px",
            fontSize: "13px",
            borderRadius: "4px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div
          style={{
            background: "#e8f5e9",
            color: "#2e7d32",
            border: "1px solid #c8e6c9",
            padding: "10px 14px",
            fontSize: "13px",
            borderRadius: "4px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <CheckCircle2 size={16} />
          <span>{success}</span>
        </div>
      )}

      {/* Account Creation Card */}
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-color)",
          borderRadius: "6px",
          padding: "20px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
          <UserPlus size={18} style={{ color: "var(--accent-orange)" }} />
          <h2 style={{ fontSize: "15px", fontWeight: 600, margin: 0 }}>Create New User Account</h2>
        </div>

        <form onSubmit={handleCreate}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "16px",
              marginBottom: "16px",
            }}
          >
            <div className="form-group">
              <label className="form-label" htmlFor="username">
                Username <span style={{ color: "var(--accent-orange)" }}>*</span>
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                placeholder="e.g. friend"
                className="text-input"
                style={{ width: "100%" }}
              />
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                Unique handle (letters, numbers, underscores, hyphens)
              </span>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="email">
                Email Address <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>(Optional)</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="e.g. friend@example.com"
                className="text-input"
                style={{ width: "100%" }}
              />
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                Can be used as alternative login identifier
              </span>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">
                Password <span style={{ color: "var(--accent-orange)" }}>*</span>
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={6}
                placeholder="Min 6 characters"
                className="text-input"
                style={{ width: "100%" }}
              />
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                Hashed securely using bcrypt
              </span>
            </div>
          </div>

          <div
            style={{
              background: "var(--bg-sidebar)",
              border: "1px solid var(--border-color)",
              padding: "10px 14px",
              borderRadius: "4px",
              fontSize: "12px",
              color: "var(--text-secondary)",
              marginBottom: "16px",
              lineHeight: 1.5,
            }}
          >
            <strong>Default Access Policy:</strong> Newly created accounts are given zero module permissions by default and see an empty access page upon login.
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={isPending}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <UserPlus size={15} />
            <span>{isPending ? "Creating Account..." : "Create Account"}</span>
          </button>
        </form>
      </div>

      {/* Existing Accounts Table */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Users size={18} style={{ color: "var(--text-secondary)" }} />
          <h2 style={{ fontSize: "15px", fontWeight: 600, margin: 0 }}>
            Registered Accounts ({usersList.length + 1})
          </h2>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Account</th>
                <th>Email</th>
                <th>Role</th>
                <th>Module Access</th>
                <th>Created</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {/* Permanent Master Superadmin Row */}
              <tr style={{ background: "rgba(255, 102, 0, 0.03)" }}>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <Shield size={15} style={{ color: "var(--accent-orange)" }} />
                    <span style={{ fontWeight: 600 }}>admin</span>
                    <span
                      style={{
                        fontSize: "10px",
                        padding: "1px 6px",
                        borderRadius: "2px",
                        background: "var(--accent-orange)",
                        color: "#fff",
                      }}
                    >
                      Master
                    </span>
                  </div>
                </td>
                <td style={{ color: "var(--text-muted)", fontSize: "12px" }}>Env ADMIN_PASSWORD</td>
                <td>
                  <span className="status-badge status-published">Super Admin</span>
                </td>
                <td>
                  <span style={{ fontSize: "12px", color: "var(--text-primary)", fontWeight: 500 }}>
                    All Modules
                  </span>
                </td>
                <td style={{ color: "var(--text-muted)", fontSize: "12px" }}>System Default</td>
                <td style={{ textAlign: "right", color: "var(--text-muted)", fontSize: "12px" }}>
                  Protected
                </td>
              </tr>

              {/* Dynamic Database Users */}
              {usersList.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "24px", color: "var(--text-muted)" }}>
                    No additional user accounts created yet. Use the form above to add an account for your friend.
                  </td>
                </tr>
              ) : (
                usersList.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <User size={15} style={{ color: "var(--text-secondary)" }} />
                        <span style={{ fontWeight: 600 }}>@{u.username}</span>
                      </div>
                    </td>
                    <td style={{ color: u.email ? "var(--text-primary)" : "var(--text-muted)", fontSize: "12px" }}>
                      {u.email || "—"}
                    </td>
                    <td>
                      <span className="status-badge status-draft">
                        {u.role === "superadmin" ? "Super Admin" : "User"}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                        {u.role === "superadmin" ? "All Modules" : "None (Empty Page)"}
                      </span>
                    </td>
                    <td style={{ color: "var(--text-muted)", fontSize: "12px" }}>
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        type="button"
                        onClick={() => handleDelete(u)}
                        disabled={deletingId === u.id}
                        className="btn btn-sm"
                        style={{
                          color: "#c62828",
                          borderColor: "#ffcdd2",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                        title="Delete user"
                      >
                        <Trash2 size={13} />
                        <span>{deletingId === u.id ? "Deleting..." : "Delete"}</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
