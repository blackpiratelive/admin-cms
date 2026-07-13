import React from "react";
import { Wrench } from "lucide-react";

interface PlaceholderModuleProps {
  title: string;
  description: string;
  category?: string;
}

export function PlaceholderModule({ title, description, category }: PlaceholderModuleProps) {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">
          <Wrench size={18} />
          {title}
        </h1>
        {category && <span className="brand-badge">{category}</span>}
      </div>

      <div
        style={{
          border: "1px dashed var(--border-color)",
          padding: "32px 24px",
          background: "var(--bg-card)",
          borderRadius: "2px",
        }}
      >
        <h3 style={{ fontSize: "16px", marginBottom: "8px" }}>Module Reserved</h3>
        <p style={{ color: "var(--text-secondary)", marginBottom: "16px" }}>{description}</p>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "12px",
            color: "var(--text-muted)",
            background: "var(--bg-code)",
            padding: "8px 12px",
            borderRadius: "2px",
            display: "inline-block",
          }}
        >
          Status: Planned module for future expansion. Schema ready for extension.
        </div>
      </div>
    </div>
  );
}
