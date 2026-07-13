"use client";

import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";
import { logoutAction } from "@/features/auth/actions";
import { LogOut, Terminal } from "lucide-react";

export function Header() {
  return (
    <header className="top-header">
      <Link href="/" className="brand">
        <Terminal size={18} />
        <span>Personal CMS</span>
        <span className="brand-badge">HUGO + TURSO</span>
      </Link>
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
