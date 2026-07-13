"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DeployWidget } from "./DeployWidget";
import {
  LayoutDashboard,
  MessageSquareText,
  FileText,
  StickyNote,
  Files,
  BookOpen,
  Film,
  Tv,
  Gamepad2,
  Image,
  Upload,
  Bookmark,
  Quote,
  Link2,
  Settings,
} from "lucide-react";

export function Sidebar() {
  const pathname = usePathname();

  const isActive = (path: string) => {
    if (path === "/" && pathname === "/") return true;
    if (path !== "/" && pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <aside className="sidebar" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
      <div>
        <nav className="nav-section">
          <Link
            href="/"
            className={`nav-link ${isActive("/") ? "active" : ""}`}
          >
            <LayoutDashboard size={16} />
            <span>Dashboard</span>
          </Link>
        </nav>

        <div className="nav-section">
          <div className="nav-section-title">Content</div>
          <Link
            href="/microblog"
            className={`nav-link ${isActive("/microblog") ? "active" : ""}`}
          >
            <MessageSquareText size={16} />
            <span>Microblog</span>
          </Link>
          <Link
            href="/blog"
            className={`nav-link ${isActive("/blog") ? "active" : ""}`}
          >
            <FileText size={16} />
            <span>Blog</span>
            <span className="badge-placeholder">soon</span>
          </Link>
          <Link
            href="/notes"
            className={`nav-link ${isActive("/notes") ? "active" : ""}`}
          >
            <StickyNote size={16} />
            <span>Notes</span>
            <span className="badge-placeholder">soon</span>
          </Link>
          <Link
            href="/pages"
            className={`nav-link ${isActive("/pages") ? "active" : ""}`}
          >
            <Files size={16} />
            <span>Pages</span>
            <span className="badge-placeholder">soon</span>
          </Link>
        </div>

        <div className="nav-section">
          <div className="nav-section-title">Tracking</div>
          <Link
            href="/books"
            className={`nav-link ${isActive("/books") ? "active" : ""}`}
          >
            <BookOpen size={16} />
            <span>Books</span>
            <span className="badge-placeholder">soon</span>
          </Link>
          <Link
            href="/movies"
            className={`nav-link ${isActive("/movies") ? "active" : ""}`}
          >
            <Film size={16} />
            <span>Movies</span>
            <span className="badge-placeholder">soon</span>
          </Link>
          <Link
            href="/tv"
            className={`nav-link ${isActive("/tv") ? "active" : ""}`}
          >
            <Tv size={16} />
            <span>TV Shows</span>
            <span className="badge-placeholder">soon</span>
          </Link>
          <Link
            href="/games"
            className={`nav-link ${isActive("/games") ? "active" : ""}`}
          >
            <Gamepad2 size={16} />
            <span>Games</span>
            <span className="badge-placeholder">soon</span>
          </Link>
        </div>

        <div className="nav-section">
          <div className="nav-section-title">Media</div>
          <Link
            href="/gallery"
            className={`nav-link ${isActive("/gallery") ? "active" : ""}`}
          >
            <Image size={16} />
            <span>Gallery</span>
            <span className="badge-placeholder">soon</span>
          </Link>
          <Link
            href="/uploads"
            className={`nav-link ${isActive("/uploads") ? "active" : ""}`}
          >
            <Upload size={16} />
            <span>Uploads</span>
            <span className="badge-placeholder">soon</span>
          </Link>
        </div>

        <div className="nav-section">
          <div className="nav-section-title">Collections</div>
          <Link
            href="/bookmarks"
            className={`nav-link ${isActive("/bookmarks") ? "active" : ""}`}
          >
            <Bookmark size={16} />
            <span>Bookmarks</span>
            <span className="badge-placeholder">soon</span>
          </Link>
          <Link
            href="/quotes"
            className={`nav-link ${isActive("/quotes") ? "active" : ""}`}
          >
            <Quote size={16} />
            <span>Quotes</span>
            <span className="badge-placeholder">soon</span>
          </Link>
          <Link
            href="/links"
            className={`nav-link ${isActive("/links") ? "active" : ""}`}
          >
            <Link2 size={16} />
            <span>Links</span>
            <span className="badge-placeholder">soon</span>
          </Link>
        </div>

        <div className="nav-section">
          <Link
            href="/settings"
            className={`nav-link ${isActive("/settings") ? "active" : ""}`}
          >
            <Settings size={16} />
            <span>Settings</span>
            <span className="badge-placeholder">soon</span>
          </Link>
        </div>
      </div>

      {/* Vercel Deployment & Manual Redeploy Option */}
      <DeployWidget />
    </aside>
  );
}
