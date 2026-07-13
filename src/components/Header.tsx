"use client";

import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";
import { logoutAction } from "@/features/auth/actions";
import { LogOut, Terminal, Menu, X } from "lucide-react";

interface HeaderProps {
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
}

export function Header({ onToggleSidebar, sidebarOpen }: HeaderProps) {
  return (
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
      <div className="header-right">
        <ThemeToggle />
        <form action={logoutAction}>
          <button type="submit" className="btn btn-sm" title="Log out">
            <LogOut size={14} />
            <span>Logout</span>
          </button>
        </form>
      </div>
    </header>
  );
}
