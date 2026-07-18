"use client";

import React, { useState } from "react";
import { ProviderOverviewDTO, connectProviderAction, disconnectProviderAction, testProviderConnectionAction } from "../actions";
import { notify } from "@/lib/notifications";
import { Loader2, CheckCircle2, AlertCircle, X } from "lucide-react";

export function ConfigureModal({
  provider,
  onClose,
  onUpdated,
}: {
  provider: ProviderOverviewDTO;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [formData, setFormData] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    provider.configFields.forEach((field) => {
      initial[field.name] = provider.configurationSummary[field.name] || "";
    });
    return initial;
  });

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    setTestResult(null);
    setErrorMsg(null);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    setErrorMsg(null);

    const res = await testProviderConnectionAction(provider.slug, formData);
    setTesting(false);

    if (res.success) {
      setTestResult({ success: true, message: "Connection test succeeded!" });
    } else {
      setTestResult({ success: false, message: res.error || "Connection test failed." });
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const currentForm = { ...formData };
    onClose();

    notify.bg({
      title: `Configure ${provider.name}`,
      loadingMessage: `Connecting to ${provider.name}...`,
      successMessage: `Connected ${provider.name} successfully!`,
      errorMessage: (err) => `Failed to connect ${provider.name}: ${err?.message || String(err)}`,
      task: () => connectProviderAction(provider.slug, currentForm),
      onSuccess: (res) => {
        if (res.success) {
          onUpdated();
        } else {
          notify.show({
            type: "error",
            title: "Connection Failed",
            message: res.error || `Failed to save ${provider.name} configuration.`,
          });
        }
      },
    });
  };

  const handleDisconnect = () => {
    if (!confirm(`Are you sure you want to disconnect ${provider.name}?`)) return;
    onClose();

    notify.bg({
      title: `Disconnect ${provider.name}`,
      loadingMessage: `Disconnecting ${provider.name}...`,
      successMessage: `Disconnected ${provider.name}.`,
      errorMessage: `Failed to disconnect ${provider.name}.`,
      task: () => disconnectProviderAction(provider.slug),
      onSuccess: (res) => {
        if (res.success) {
          onUpdated();
        } else {
          notify.show({
            type: "error",
            title: "Disconnect Failed",
            message: res.error || `Failed to disconnect ${provider.name}.`,
          });
        }
      },
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ fontSize: "16px", fontWeight: "bold", display: "flex", alignItems: "center", gap: "8px" }}>
            <span>{provider.icon}</span> Configure {provider.name}
          </h3>
          <button className="icon-button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {errorMsg && (
          <div style={{ background: "#ffebee", color: "#c62828", border: "1px solid #ffcdd2", padding: "8px 12px", borderRadius: "2px", fontSize: "13px" }}>
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {provider.configFields.map((field) => (
            <div key={field.name} className="form-group">
              <label className="form-label">
                {field.label} {field.required && <span style={{ color: "red" }}>*</span>}
              </label>
              <input
                type={field.type}
                className="text-input"
                placeholder={field.placeholder}
                value={formData[field.name] || ""}
                onChange={(e) => handleChange(field.name, e.target.value)}
                required={field.required}
              />
              {field.description && <small>{field.description}</small>}
            </div>
          ))}

          {testResult && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 12px",
                borderRadius: "2px",
                fontSize: "13px",
                background: testResult.success ? "#e8f5e9" : "#ffebee",
                color: testResult.success ? "#2e7d32" : "#c62828",
                border: `1px solid ${testResult.success ? "#c8e6c9" : "#ffcdd2"}`,
              }}
            >
              {testResult.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span>{testResult.message}</span>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
            <button
              type="button"
              className="btn btn-sm"
              onClick={handleTestConnection}
              disabled={testing || saving || disconnecting}
            >
              {testing ? <Loader2 size={14} className="animate-spin" /> : "Test Connection"}
            </button>

            <div style={{ display: "flex", gap: "8px" }}>
              {provider.connected && (
                <button
                  type="button"
                  className="btn btn-sm btn-danger"
                  onClick={handleDisconnect}
                  disabled={testing || saving || disconnecting}
                >
                  {disconnecting ? <Loader2 size={14} className="animate-spin" /> : "Disconnect"}
                </button>
              )}
              <button type="submit" className="btn btn-sm btn-primary" disabled={testing || saving || disconnecting}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : "Save & Connect"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
