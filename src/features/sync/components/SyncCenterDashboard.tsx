"use client";

import { useState, useEffect } from "react";
import { getProvidersOverviewAction, ProviderOverviewDTO } from "../actions";
import { ProviderCard } from "./ProviderCard";
import Link from "next/link";
import { RefreshCw, ListFilter, ShieldCheck, Cpu } from "lucide-react";

export function SyncCenterDashboard() {
  const [providers, setProviders] = useState<ProviderOverviewDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProviders = async () => {
    setLoading(true);
    const data = await getProvidersOverviewAction();
    setProviders(data);
    setLoading(false);
  };

  useEffect(() => {
    loadProviders();
  }, []);

  const totalConnected = providers.filter((p) => p.connected).length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Cpu size={20} />
            <span>Sync Center</span>
          </h1>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
            Central hub for managing external integrations, database syncs, and media providers.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button className="btn btn-sm" onClick={loadProviders} disabled={loading}>
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            <span>Refresh All</span>
          </button>

          <Link href="/sync/logs" className="btn btn-sm btn-primary">
            <ListFilter size={13} />
            <span>View Logs</span>
          </Link>
        </div>
      </div>

      {/* Overview Metric Banner */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "var(--bg-card)",
          border: "1px solid var(--border-color)",
          padding: "12px 16px",
          borderRadius: "4px",
          marginBottom: "20px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <ShieldCheck size={18} style={{ color: "var(--badge-published)" }} />
          <span style={{ fontSize: "13px", fontWeight: "500" }}>
            {totalConnected} of {providers.length} Providers Active & Connected
          </span>
        </div>

        <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
          Data normalized & saved directly to local Turso DB. Hugo static builds run independent of external API downtime.
        </div>
      </div>

      {/* Provider Cards Grid */}
      <div className="sync-cards-grid">
        {providers.map((provider) => (
          <ProviderCard key={provider.slug} provider={provider} onRefresh={loadProviders} />
        ))}
      </div>
    </div>
  );
}
