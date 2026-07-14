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
  Database,
  Bookmark,
  Quote,
  Link2,
  Settings,
  CheckSquare,
  RefreshCw,
  Music,
  Folder,
} from "lucide-react";

export function Sidebar({ isOpen, onClose }: { isOpen?: boolean; onClose?: () => void }) {
  const pathname = usePathname();

  const isActive = (path: string) => {
    if (path === "/" && pathname === "/") return true;
    if (path !== "/" && pathname.startsWith(path)) return true;
    return false;
  };

  const handleLinkClick = () => {
    if (onClose) {
      onClose();
    }
  };

  return (
    <aside
      className={`sidebar ${isOpen ? "open" : ""}`}
      style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}
    >
      <div>
        <nav className="nav-section">
          <Link
            href="/"
            className={`nav-link ${isActive("/") ? "active" : ""}`}
            onClick={handleLinkClick}
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
            onClick={handleLinkClick}
          >
            <MessageSquareText size={16} />
            <span>Microblog</span>
          </Link>
          <Link
            href="/blog"
            className={`nav-link ${isActive("/blog") ? "active" : ""}`}
            onClick={handleLinkClick}
          >
            <FileText size={16} />
            <span>Blog</span>
            <span className="badge-placeholder">soon</span>
          </Link>
          <Link
            href="/notes"
            className={`nav-link ${isActive("/notes") ? "active" : ""}`}
            onClick={handleLinkClick}
          >
            <StickyNote size={16} />
            <span>Notes</span>
            <span className="badge-placeholder">soon</span>
          </Link>
          <Link
            href="/pages"
            className={`nav-link ${isActive("/pages") ? "active" : ""}`}
            onClick={handleLinkClick}
          >
            <Files size={16} />
            <span>Pages</span>
            <span className="badge-placeholder">soon</span>
          </Link>
        </div>

        <div className="nav-section">
          <div className="nav-section-title">Tracking</div>
          <Link
            href="/todos"
            className={`nav-link ${isActive("/todos") ? "active" : ""}`}
            onClick={handleLinkClick}
          >
            <CheckSquare size={16} />
            <span>Todos</span>
          </Link>
          <Link
            href="/books"
            className={`nav-link ${isActive("/books") ? "active" : ""}`}
            onClick={handleLinkClick}
          >
            <BookOpen size={16} />
            <span>Books</span>
            <span className="badge-placeholder">soon</span>
          </Link>
          <Link
            href="/movies"
            className={`nav-link ${isActive("/movies") ? "active" : ""}`}
            onClick={handleLinkClick}
          >
            <Film size={16} />
            <span>Movies</span>
            <span className="badge-placeholder">soon</span>
          </Link>
          <Link
            href="/tv"
            className={`nav-link ${isActive("/tv") ? "active" : ""}`}
            onClick={handleLinkClick}
          >
            <Tv size={16} />
            <span>TV Shows</span>
            <span className="badge-placeholder">soon</span>
          </Link>
          <Link
            href="/games"
            className={`nav-link ${isActive("/games") ? "active" : ""}`}
            onClick={handleLinkClick}
          >
            <Gamepad2 size={16} />
            <span>Games</span>
            <span className="badge-placeholder">soon</span>
          </Link>
        </div>

        <div className="nav-section">
          <div className="nav-section-title">Media</div>
          <Link
            href="/storage"
            className={`nav-link ${isActive("/storage") ? "active" : ""}`}
            onClick={handleLinkClick}
          >
            <Database size={16} />
            <span>Storage</span>
          </Link>
          <Link
            href="/gallery"
            className={`nav-link ${isActive("/gallery") ? "active" : ""}`}
            onClick={handleLinkClick}
          >
            <Image size={16} />
            <span>Gallery</span>
          </Link>
          <Link
            href="/uploads"
            className={`nav-link ${isActive("/uploads") ? "active" : ""}`}
            onClick={handleLinkClick}
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
            onClick={handleLinkClick}
          >
            <Bookmark size={16} />
            <span>Bookmarks</span>
            <span className="badge-placeholder">soon</span>
          </Link>
          <Link
            href="/quotes"
            className={`nav-link ${isActive("/quotes") ? "active" : ""}`}
            onClick={handleLinkClick}
          >
            <Quote size={16} />
            <span>Quotes</span>
            <span className="badge-placeholder">soon</span>
          </Link>
          <Link
            href="/links"
            className={`nav-link ${isActive("/links") ? "active" : ""}`}
            onClick={handleLinkClick}
          >
            <Link2 size={16} />
            <span>Links</span>
          </Link>
        </div>

        <div className="nav-section">
          <div className="nav-section-title">Libraries</div>
          <Link
            href="/libraries/movies"
            className={`nav-link ${isActive("/libraries/movies") ? "active" : ""}`}
            onClick={handleLinkClick}
          >
            <Film size={16} />
            <span>Movies</span>
          </Link>
          <Link
            href="/libraries/shows"
            className={`nav-link ${isActive("/libraries/shows") ? "active" : ""}`}
            onClick={handleLinkClick}
          >
            <Tv size={16} />
            <span>TV Shows</span>
          </Link>
          <Link
            href="/libraries/music"
            className={`nav-link ${isActive("/libraries/music") ? "active" : ""}`}
            onClick={handleLinkClick}
          >
            <Music size={16} />
            <span>Music</span>
          </Link>
          <Link
            href="/libraries/collections"
            className={`nav-link ${isActive("/libraries/collections") ? "active" : ""}`}
            onClick={handleLinkClick}
          >
            <Folder size={16} />
            <span>Collections</span>
          </Link>
        </div>

        <div className="nav-section">
          <Link
            href="/sync"
            className={`nav-link ${isActive("/sync") ? "active" : ""}`}
            onClick={handleLinkClick}
          >
            <RefreshCw size={16} />
            <span>Sync Center</span>
          </Link>
        </div>

        <div className="nav-section">
          <Link
            href="/settings"
            className={`nav-link ${isActive("/settings") ? "active" : ""}`}
            onClick={handleLinkClick}
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

