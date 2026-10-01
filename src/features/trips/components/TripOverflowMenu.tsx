"use client";

import React, { useState, useEffect, useRef } from "react";
import { Edit2, Copy, Trash2 } from "lucide-react";

interface TripOverflowMenuProps {
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  tripTitle: string;
}

export function TripOverflowMenu({
  onEdit,
  onDuplicate,
  onDelete,
  tripTitle,
}: TripOverflowMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen((prev) => !prev);
  };

  const handleItemClick = (action: () => void, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(false);
    action();
  };

  return (
    <div className="trip-menu-wrap" ref={menuRef}>
      <button
        type="button"
        className="trip-menu-btn"
        onClick={handleToggle}
        aria-label={`Options for ${tripTitle}`}
        aria-haspopup="true"
        aria-expanded={isOpen}
        title="More options"
      >
        ⋯
      </button>

      {isOpen && (
        <div
          className="trip-menu-panel"
          role="menu"
          aria-label="Trip actions"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="trip-menu-item"
            role="menuitem"
            onClick={(e) => handleItemClick(onEdit, e)}
          >
            <Edit2 size={14} />
            <span>Edit</span>
          </button>

          <button
            type="button"
            className="trip-menu-item"
            role="menuitem"
            onClick={(e) => handleItemClick(onDuplicate, e)}
          >
            <Copy size={14} />
            <span>Duplicate</span>
          </button>

          <button
            type="button"
            className="trip-menu-item danger"
            role="menuitem"
            onClick={(e) => handleItemClick(onDelete, e)}
          >
            <Trash2 size={14} />
            <span>Delete</span>
          </button>
        </div>
      )}
    </div>
  );
}
