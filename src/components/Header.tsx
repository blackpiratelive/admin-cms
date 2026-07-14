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
              padding: "6px 12px",
              borderRadius: "6px",
              backgroundColor: "rgba(255,255,255,0.06)",
              border: "1px solid var(--border-color, #333)",
              color: "var(--text-muted, #888)",
              cursor: "pointer",
              fontSize: "13px",
            }}
          >
            <Search size={14} />
            <span>Search Everything...</span>
            <kbd
              style={{
                fontSize: "10px",
                padding: "2px 4px",
                borderRadius: "3px",
                backgroundColor: "rgba(255,255,255,0.1)",
                color: "var(--text-main, #eee)",
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

