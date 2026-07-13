"use client";

import React, { useState } from "react";
import { manualDeployAction } from "@/features/deploy/actions";
import { RefreshCw, CheckCircle2, AlertCircle, Rocket } from "lucide-react";

export function DeployWidget() {
  const [isDeploying, setIsDeploying] = useState(false);
  const [lastDeploy, setLastDeploy] = useState<{
    status: "idle" | "success" | "error";
    message: string;
    time?: string;
  }>({
    status: "idle",
    message: "Ready to deploy",
  });

  const handleRedeploy = async () => {
    setIsDeploying(true);
    setLastDeploy({ status: "idle", message: "Triggering Vercel rebuild..." });
    try {
      const res = await manualDeployAction();
      if (res.success) {
        setLastDeploy({
          status: "success",
          message: "Hugo rebuild triggered!",
          time: res.timestamp,
        });
      } else {
        setLastDeploy({
          status: "error",
          message: res.message,
          time: res.timestamp,
        });
      }
    } catch (err) {
      setLastDeploy({
        status: "error",
        message: "Failed to trigger deploy hook.",
      });
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div
      style={{
        margin: "12px",
        padding: "10px",
        background: "var(--bg-card)",
        border: "1px solid var(--border-color)",
        borderRadius: "2px",
        fontSize: "12px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          fontWeight: "bold",
          marginBottom: "6px",
          color: "var(--text-primary)",
        }}
      >
        <Rocket size={14} style={{ color: "var(--accent)" }} />
        <span>Vercel Deployment</span>
      </div>

      <div
        style={{
          fontSize: "11px",
          color:
            lastDeploy.status === "success"
              ? "#2e7d32"
              : lastDeploy.status === "error"
              ? "#c62828"
              : "var(--text-secondary)",
          marginBottom: "8px",
          display: "flex",
          alignItems: "center",
          gap: "4px",
        }}
      >
        {lastDeploy.status === "success" && <CheckCircle2 size={12} />}
        {lastDeploy.status === "error" && <AlertCircle size={12} />}
        <span>
          {lastDeploy.message}
          {lastDeploy.time ? ` (${lastDeploy.time})` : ""}
        </span>
      </div>

      <button
        type="button"
        onClick={handleRedeploy}
        disabled={isDeploying}
        className="btn btn-sm"
        style={{ width: "100%", justifyContent: "center" }}
      >
        <RefreshCw
          size={12}
          style={{
            animation: isDeploying ? "spin 1s linear infinite" : "none",
          }}
        />
        <span>{isDeploying ? "Deploying..." : "Trigger Redeploy"}</span>
      </button>

      <style jsx>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
