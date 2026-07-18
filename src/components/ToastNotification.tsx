"use client";

import { useEffect, useState } from "react";
import { notify, Toast } from "@/lib/notifications";
import { CheckCircle2, AlertCircle, Loader2, Info, X } from "lucide-react";

export function ToastNotification() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    return notify.subscribe((newToasts) => {
      setToasts(newToasts);
    });
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "20px",
        right: "20px",
        zIndex: 10000,
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        maxWidth: "400px",
        width: "calc(100vw - 40px)",
        pointerEvents: "none",
      }}
    >
      {toasts.map((toast) => {
        const isSuccess = toast.type === "success";
        const isError = toast.type === "error";
        const isLoading = toast.type === "loading";

        const borderColor = isSuccess
          ? "#2e7d32"
          : isError
          ? "#c62828"
          : isLoading
          ? "var(--accent)"
          : "var(--border-color)";

        return (
          <div
            key={toast.id}
            style={{
              pointerEvents: "auto",
              background: "var(--bg-card)",
              color: "var(--text-primary)",
              border: `1px solid ${borderColor}`,
              borderLeft: `4px solid ${borderColor}`,
              borderRadius: "6px",
              padding: "12px 14px",
              boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3)",
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
              animation: "slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            <div style={{ flexShrink: 0, marginTop: "2px" }}>
              {isSuccess && <CheckCircle2 size={18} style={{ color: "#2e7d32" }} />}
              {isError && <AlertCircle size={18} style={{ color: "#c62828" }} />}
              {isLoading && <Loader2 size={18} className="animate-spin" style={{ color: "var(--accent)" }} />}
              {!isSuccess && !isError && !isLoading && (
                <Info size={18} style={{ color: "var(--accent)" }} />
              )}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              {toast.title && (
                <div style={{ fontWeight: 600, fontSize: "13px", marginBottom: "2px" }}>
                  {toast.title}
                </div>
              )}
              <div style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.4 }}>
                {toast.message}
              </div>
            </div>

            <button
              onClick={() => notify.dismiss(toast.id)}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
                padding: "2px",
                flexShrink: 0,
                marginTop: "-2px",
              }}
              title="Dismiss notification"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
