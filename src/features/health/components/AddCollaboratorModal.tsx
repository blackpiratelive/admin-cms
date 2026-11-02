"use client";

import { useEffect, useState } from "react";
import { X, UserPlus, Shield, Users } from "lucide-react";
import { addCollaboratorAction, getRegisteredUsersAction } from "../actions";
import { notify } from "@/lib/notifications";

interface AddCollaboratorModalProps {
  profileId: string;
  profileName: string;
  isOpen: boolean;
  onClose: () => void;
  existingUserIds: string[];
  ownerUserId: string;
  onAdded: () => void;
}

interface UserOption {
  id: string;
  username: string;
  email?: string | null;
  role: string;
}

export function AddCollaboratorModal({
  profileId,
  profileName,
  isOpen,
  onClose,
  existingUserIds,
  ownerUserId,
  onAdded,
}: AddCollaboratorModalProps) {
  const [usersList, setUsersList] = useState<UserOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [loadingUsers, setLoadingUsers] = useState<boolean>(true);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoadingUsers(true);

    getRegisteredUsersAction()
      .then((users) => {
        if (!isMounted) return;
        // Filter out profile owner and existing collaborators
        const eligible = users.filter(
          (u) => u.id !== ownerUserId && !existingUserIds.includes(u.id)
        );
        setUsersList(eligible);
        if (eligible.length > 0) {
          setSelectedUserId(eligible[0].id);
        } else {
          setSelectedUserId("");
        }
      })
      .catch((err) => {
        console.error("Failed to fetch registered users", err);
      })
      .finally(() => {
        if (isMounted) setLoadingUsers(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, ownerUserId, existingUserIds]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;

    const chosenUser = usersList.find((u) => u.id === selectedUserId);
    const chosenName = chosenUser?.username || "collaborator";

    onClose();

    notify.bg({
      title: "Add Collaborator",
      loadingMessage: `Adding @${chosenName} to '${profileName}' in background...`,
      successMessage: `@${chosenName} added as collaborator to '${profileName}'!`,
      errorMessage: (err) =>
        `Failed to add collaborator: ${err?.message || String(err)}`,
      task: async () => {
        const res = await addCollaboratorAction(profileId, selectedUserId);
        if (!res.success) {
          throw new Error(res.error || "Failed to add collaborator.");
        }
        return res;
      },
      onSuccess: () => {
        onAdded();
      },
    });
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div className="modal-content" style={{ maxWidth: "460px" }}>
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Users size={18} color="var(--accent-primary, #f97316)" />
            <h2 style={{ margin: 0, fontSize: "17px", fontWeight: 600 }}>
              Add Collaborator
            </h2>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div
            style={{
              padding: "10px 14px",
              borderRadius: "6px",
              background: "rgba(59, 130, 246, 0.08)",
              border: "1px solid rgba(59, 130, 246, 0.2)",
              fontSize: "12px",
              color: "var(--text-secondary)",
              display: "flex",
              alignItems: "flex-start",
              gap: "8px",
            }}
          >
            <Shield size={16} color="var(--accent-blue, #3b82f6)" style={{ flexShrink: 0, marginTop: "1px" }} />
            <span>
              Collaborators share this regimen and can track their own doses & photos.
              They <strong>cannot</strong> change profile metadata, baseline dates, or delete treatments.
            </span>
          </div>

          <div className="form-group" style={{ marginTop: "12px" }}>
            <label htmlFor="collaborator-select">
              Select User Account <span style={{ color: "var(--danger-color, #ef4444)" }}>*</span>
            </label>

            {loadingUsers ? (
              <div style={{ fontSize: "13px", color: "var(--text-muted)", padding: "8px 0" }}>
                Loading registered user accounts...
              </div>
            ) : usersList.length === 0 ? (
              <div
                style={{
                  fontSize: "13px",
                  color: "var(--text-muted)",
                  padding: "12px",
                  background: "var(--bg-main)",
                  borderRadius: "6px",
                  border: "1px dashed var(--border-color)",
                }}
              >
                No additional registered users available. You can create user accounts in <strong>Settings → Users & Access</strong>.
              </div>
            ) : (
              <select
                id="collaborator-select"
                className="form-input"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                required
              >
                {usersList.map((u) => (
                  <option key={u.id} value={u.id}>
                    @{u.username} {u.email ? `(${u.email})` : ""} {u.role === "superadmin" ? "• Super Admin" : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="modal-actions" style={{ marginTop: "16px" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loadingUsers || usersList.length === 0 || !selectedUserId}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <UserPlus size={15} />
              <span>Add as Collaborator</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
