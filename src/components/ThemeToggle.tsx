"use client";

import { useTheme } from "./ThemeProvider";
import { Palette } from "lucide-react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="theme-toggle">
      <Palette className="icon" size={16} />
      <select
        value={theme}
        onChange={(e) => setTheme(e.target.value as any)}
        className="theme-select"
        aria-label="Select theme"
      >
        <option value="hn">HN Orange</option>
        <option value="dark">Dark</option>
        <option value="mono">Monochrome</option>
        <option value="teal">Retro Teal</option>
      </select>
    </div>
  );
}
