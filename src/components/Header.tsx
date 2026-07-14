"use client";

import { useState } from "react";
import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";
import { CommandPalette } from "./CommandPalette";
import { logoutAction } from "@/features/auth/actions";
import { LogOut, Terminal, Menu, X, Search, Command } from "lucide-react";

interface HeaderProps {
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
}

export function Header({ onToggleSidebar, sidebarOpen }: HeaderProps) {
  const [paletteOpen, setPaletteOpen] = useState(false);

  return (
    <>
      <header className="top-header">
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            type="button"
            className="sidebar-toggle-btn"
            onClick={onToggleSidebar}
            aria-label="Toggle sidebar"
            style={{
              background: "none",
              border: "none",
              color: "var(--header-text)",
              cursor: "pointer",
              display: "none",
              padding: "4px",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <Link href="/" className="brand">
            <Terminal size={18} />
            <span>Personal CMS</span>
            <span className="brand-badge">HUGO + TURSO</span>
          </Link>
        </div>

        <div className="header-right" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            onClick={() => setPaletteOpen(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "4px 10px",
              borderRadius: "2px",
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              color: "var(--text-primary)",
              cursor: "pointer",
              fontSize: "12px",
            }}
          >
            <Search size={13} style={{ color: "var(--text-muted)" }} />
            <span>Search Everything...</span>
            <kbd
              style={{
                fontSize: "10px",
                padding: "1px 4px",
                borderRadius: "2px",
                backgroundColor: "var(--bg-sidebar)",
                border: "1px solid var(--border-color)",
                color: "var(--text-secondary)",
                fontFamily: "var(--font-mono)",
              }}
            >
              Ctrl+K
            </kbd>
          </button>

          <ThemeToggle />
          <form action={logoutAction}>
            <button type="submit" className="btn btn-sm" title="Log out">
              <LogOut size={14} />
              <span>Logout</span>
            </button>
          </form>
        </div>
      </header>

      <CommandPalette isOpen={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </>
  );
}

