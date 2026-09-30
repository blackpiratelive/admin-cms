import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X, Star, Clock, MapPin, Plus } from "lucide-react";

export interface ComboOption {
  id: string;
  label: string;
  sublabel?: string | null;
  favorite?: boolean;
}

export interface ComboAction {
  id: string;
  label: string;
  sublabel?: string;
  icon?: React.ReactNode;
  onSelect: () => void;
}

interface EntityComboboxProps {
  options: ComboOption[];
  /** Currently selected option id, or null when nothing / a custom value is set. */
  value: string | null;
  onChange: (id: string | null) => void;
  /** Option ids to prioritize at the very top (e.g. current trip's locations). */
  priorityIds?: string[];
  /** Option ids ordered most-recently-used first; floated to the top when the search box is empty. */
  recentIds?: string[];
  placeholder?: string;
  /** Label for the "clear selection" row (e.g. "No location"). */
  noneLabel?: string;
  disabled?: boolean;
  /** Enables a free-text fallback (used by the trip-day primary location field). */
  allowCustom?: boolean;
  customValue?: string;
  onCustomChange?: (text: string) => void;
  customPlaceholder?: string;
  ariaLabel?: string;
  /** Fired when the dropdown opens; use for lazy-loading option data on first focus. */
  onOpen?: () => void;
  /** Optional extra interactive action items (e.g. geocoded quick-create suggestions). */
  extraActions?: ComboAction[];
  /** Notified when user types query */
  onQueryChange?: (query: string) => void;
}

const MAX_RESULTS = 8;

export function EntityCombobox({
  options,
  value,
  onChange,
  priorityIds = [],
  recentIds = [],
  placeholder = "Search…",
  noneLabel = "None",
  disabled = false,
  allowCustom = false,
  customValue,
  onCustomChange,
  customPlaceholder = "Type a custom name",
  ariaLabel,
  onOpen,
  extraActions = [],
  onQueryChange,
}: EntityComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);
  const selected = value ? byId.get(value) : undefined;
  const hasCustom = allowCustom && !value && !!customValue?.trim();

  // Ordering when the query is empty: priority (e.g. trip locations) → recents → favorites → rest
  const baseOrder = useMemo(() => {
    const prioritySet = new Set(priorityIds);
    const recentSet = new Set(recentIds);
    const priority = priorityIds.map((id) => byId.get(id)).filter((o): o is ComboOption => !!o);
    const recent = recentIds.filter((id) => !prioritySet.has(id)).map((id) => byId.get(id)).filter((o): o is ComboOption => !!o);
    const favorites = options.filter((o) => o.favorite && !prioritySet.has(o.id) && !recentSet.has(o.id));
    const favSet = new Set(favorites.map((o) => o.id));
    const rest = options.filter((o) => !prioritySet.has(o.id) && !recentSet.has(o.id) && !favSet.has(o.id));
    return { priority, recent, favorites, rest };
  }, [options, priorityIds, recentIds, byId]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return [...baseOrder.priority, ...baseOrder.recent, ...baseOrder.favorites, ...baseOrder.rest].slice(0, MAX_RESULTS);
    }
    const prioritySet = new Set(priorityIds);
    const matches = options.filter((o) => {
      const hay = `${o.label} ${o.sublabel ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
    // Priority matches first, then prefix matches on label, then substring
    matches.sort((a, b) => {
      const aPri = prioritySet.has(a.id) ? 0 : 1;
      const bPri = prioritySet.has(b.id) ? 0 : 1;
      if (aPri !== bPri) return aPri - bPri;
      const ap = a.label.toLowerCase().startsWith(q) ? 0 : 1;
      const bp = b.label.toLowerCase().startsWith(q) ? 0 : 1;
      return ap - bp;
    });
    return matches.slice(0, MAX_RESULTS);
  }, [query, options, priorityIds, baseOrder]);

  useEffect(() => setHighlight(0), [query, open]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const displayLabel = selected?.label ?? (hasCustom ? customValue : "");

  const commitOption = (id: string | null) => {
    onChange(id);
    if (id !== null) onCustomChange?.("");
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
  };

  const commitCustom = () => {
    const text = query.trim();
    if (!text) return;
    onChange(null);
    onCustomChange?.(text);
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
  };

  // Build the interactive row list (used for keyboard navigation + rendering).
  type Row =
    | { kind: "none" }
    | { kind: "option"; option: ComboOption; priority: boolean; recent: boolean }
    | { kind: "action"; action: ComboAction }
    | { kind: "custom"; text: string };

  const rows: Row[] = [];
  rows.push({ kind: "none" });
  const recentSet = new Set(recentIds);
  const prioritySet = new Set(priorityIds);
  for (const o of results) {
    rows.push({
      kind: "option",
      option: o,
      priority: prioritySet.has(o.id),
      recent: !prioritySet.has(o.id) && recentSet.has(o.id),
    });
  }
  if (extraActions && extraActions.length > 0) {
    for (const a of extraActions) rows.push({ kind: "action", action: a });
  }
  if (allowCustom && query.trim()) rows.push({ kind: "custom", text: query.trim() });

  const activateRow = (row: Row) => {
    if (row.kind === "none") commitOption(null);
    else if (row.kind === "option") commitOption(row.option.id);
    else if (row.kind === "action") {
      row.action.onSelect();
      setOpen(false);
      setQuery("");
      inputRef.current?.blur();
    } else commitCustom();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      onOpen?.();
      setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, rows.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const row = rows[highlight];
      if (row) activateRow(row);
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
    }
  };

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <Search
          size={14}
          style={{ position: "absolute", left: "10px", color: "var(--text-muted)", pointerEvents: "none" }}
        />
        <input
          ref={inputRef}
          type="text"
          className="form-input"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel}
          disabled={disabled}
          style={{ paddingLeft: "30px", paddingRight: value || hasCustom ? "30px" : undefined }}
          value={open ? query : displayLabel}
          placeholder={selected || hasCustom ? undefined : placeholder}
          onFocus={() => {
            if (!open) onOpen?.();
            setOpen(true);
            setQuery("");
          }}
          onChange={(e) => {
            setOpen(true);
            setQuery(e.target.value);
            onQueryChange?.(e.target.value);
          }}
          onKeyDown={onKeyDown}
        />
        {(value || hasCustom) && !open && (
          <button
            type="button"
            aria-label="Clear selection"
            onClick={() => commitOption(null)}
            style={{
              position: "absolute", right: "8px", background: "none", border: "none",
              color: "var(--text-muted)", cursor: "pointer", display: "flex", padding: "2px",
            }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {open && (
        <div
          style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 50,
            background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "6px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.3)", maxHeight: "280px", overflowY: "auto", padding: "4px",
          }}
        >
          {rows.map((row, i) => {
            const active = i === highlight;
            const base: React.CSSProperties = {
              display: "flex", alignItems: "center", gap: "8px", width: "100%", textAlign: "left",
              padding: "7px 10px", borderRadius: "4px", border: "none", cursor: "pointer",
              fontSize: "13px", background: active ? "var(--bg-hover, rgba(255,255,255,0.06))" : "transparent",
              color: "var(--text-primary)",
            };
            if (row.kind === "none") {
              return (
                <button key="none" type="button" style={{ ...base, color: "var(--text-muted)" }}
                  onMouseEnter={() => setHighlight(i)} onClick={() => activateRow(row)}>
                  {noneLabel}
                </button>
              );
            }
            if (row.kind === "action") {
              return (
                <button key={`act_${row.action.id}`} type="button" style={base}
                  onMouseEnter={() => setHighlight(i)} onClick={() => activateRow(row)}>
                  {row.action.icon || <Plus size={13} style={{ color: "var(--accent, #f97316)", flexShrink: 0 }} />}
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {row.action.label}
                    {row.action.sublabel && (
                      <span style={{ color: "var(--text-muted)", marginLeft: "6px", fontSize: "12px" }}>
                        {row.action.sublabel}
                      </span>
                    )}
                  </span>
                </button>
              );
            }
            if (row.kind === "custom") {
              return (
                <button key="custom" type="button" style={base}
                  onMouseEnter={() => setHighlight(i)} onClick={() => activateRow(row)}>
                  <Search size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                  <span>Use “{row.text}”</span>
                </button>
              );
            }
            const o = row.option;
            return (
              <button key={o.id} type="button" style={base}
                onMouseEnter={() => setHighlight(i)} onClick={() => activateRow(row)}>
                {row.priority ? (
                  <MapPin size={13} style={{ color: "var(--accent, #f97316)", flexShrink: 0 }} />
                ) : row.recent ? (
                  <Clock size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                ) : o.favorite ? (
                  <Star size={13} style={{ color: "#f5a623", fill: "#f5a623", flexShrink: 0 }} />
                ) : (
                  <span style={{ width: "13px", flexShrink: 0 }} />
                )}
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {o.label}
                  {o.sublabel && (
                    <span style={{ color: "var(--text-muted)", marginLeft: "6px", fontSize: "12px" }}>
                      {o.sublabel}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
          {results.length === 0 && !allowCustom && (
            <div style={{ padding: "8px 10px", fontSize: "12px", color: "var(--text-muted)" }}>
              No matches
            </div>
          )}
          {allowCustom && customValue && !query && (
            <input
              type="text"
              className="form-input"
              style={{ margin: "4px", width: "calc(100% - 8px)" }}
              value={customValue}
              placeholder={customPlaceholder}
              onChange={(e) => {
                onChange(null);
                onCustomChange?.(e.target.value);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
