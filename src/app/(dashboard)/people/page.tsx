"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { PersonRecord } from "@/db/schema";
import {
  getPeopleAction,
  deletePersonAction,
  toggleFavoritePersonAction,
  getUpcomingBirthdaysAction,
  UpcomingBirthdayItem,
} from "@/features/people/actions";
import { DEFAULT_RELATIONSHIP_TYPES, ImportantDate } from "@/features/people/schema";
import { PersonFormModal } from "@/features/people/components/PersonFormModal";
import { UpcomingBirthdaysWidget } from "@/features/people/components/UpcomingBirthdaysWidget";
import {
  Users,
  Plus,
  Search,
  Star,
  Lock,
  EyeOff,
  Globe,
  Edit2,
  Trash2,
  Calendar,
  Heart,
  Tag,
  Filter,
  ArrowUpDown,
  ChevronRight,
  User,
} from "lucide-react";

export default function PeoplePage() {
  const [people, setPeople] = useState<PersonRecord[]>([]);
  const [upcomingDates, setUpcomingDates] = useState<UpcomingBirthdayItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [relationshipFilter, setRelationshipFilter] = useState("all");
  const [favoriteFilter, setFavoriteFilter] = useState(false);
  const [birthdayMonthFilter, setBirthdayMonthFilter] = useState<number | undefined>(undefined);
  const [visibilityFilter, setVisibilityFilter] = useState<"all" | "private" | "unlisted" | "public">("all");
  const [sortBy, setSortBy] = useState<"created_desc" | "name" | "updated_desc">("created_desc");

  // Modal controls
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [personToEdit, setPersonToEdit] = useState<PersonRecord | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [data, upcoming] = await Promise.all([
        getPeopleAction({
          search,
          relationshipType: relationshipFilter === "all" ? undefined : relationshipFilter,
          favorite: favoriteFilter ? true : undefined,
          birthdayMonth: birthdayMonthFilter,
          visibility: visibilityFilter === "all" ? undefined : visibilityFilter,
          sortBy,
        }),
        getUpcomingBirthdaysAction(5),
      ]);
      setPeople(data);
      setUpcomingDates(upcoming);
    } catch (err) {
      console.error("Failed to load people data:", err);
    } finally {
      setLoading(false);
    }
  }, [search, relationshipFilter, favoriteFilter, birthdayMonthFilter, visibilityFilter, sortBy]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateNew = () => {
    setPersonToEdit(null);
    setIsModalOpen(true);
  };

  const handleEdit = (p: PersonRecord) => {
    setPersonToEdit(p);
    setIsModalOpen(true);
  };

  const handleToggleFav = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await toggleFavoritePersonAction(id);
    loadData();
  };

  const handleDelete = async (id: string, name: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete ${name}? This will remove all their connection entries.`)) {
      await deletePersonAction(id);
      loadData();
    }
  };

  const months = [
    { value: 1, label: "January" },
    { value: 2, label: "February" },
    { value: 3, label: "March" },
    { value: 4, label: "April" },
    { value: 5, label: "May" },
    { value: 6, label: "June" },
    { value: 7, label: "July" },
    { value: 8, label: "August" },
    { value: 9, label: "September" },
    { value: 10, label: "October" },
    { value: 11, label: "November" },
    { value: 12, label: "December" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Top Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Users size={22} style={{ color: "var(--accent)" }} />
            <span>People & Relationships</span>
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "4px 0 0 0" }}>
            Manage the people in your life and connect them to your photos, trips, locations, projects, and notes.
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleCreateNew}>
          <Plus size={16} />
          <span>Add Person</span>
        </button>
      </div>

      {/* Upcoming Birthdays / Important Dates Widget */}
      <UpcomingBirthdaysWidget items={upcomingDates} />

      {/* Search & Filter Toolbar */}
      <div
        style={{
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-color)",
          borderRadius: "8px",
          padding: "14px",
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Left Search Bar */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: "1 1 240px" }}>
          <Search size={16} style={{ color: "var(--text-muted)" }} />
          <input
            type="text"
            className="form-input"
            placeholder="Search by name, nickname, tags, notes, interests..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1 }}
          />
        </div>

        {/* Right Selectors */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center" }}>
          {/* Relationship Filter */}
          <select
            className="form-input"
            value={relationshipFilter}
            onChange={(e) => setRelationshipFilter(e.target.value)}
            style={{ width: "auto" }}
          >
            <option value="all">All Relationships</option>
            {DEFAULT_RELATIONSHIP_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          {/* Birthday Month Filter */}
          <select
            className="form-input"
            value={birthdayMonthFilter || ""}
            onChange={(e) =>
              setBirthdayMonthFilter(e.target.value ? parseInt(e.target.value, 10) : undefined)
            }
            style={{ width: "auto" }}
          >
            <option value="">All Birthday Months</option>
            {months.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>

          {/* Visibility Filter */}
          <select
            className="form-input"
            value={visibilityFilter}
            onChange={(e) => setVisibilityFilter(e.target.value as any)}
            style={{ width: "auto" }}
          >
            <option value="all">All Visibilities</option>
            <option value="private">Private Only</option>
            <option value="unlisted">Unlisted Only</option>
            <option value="public">Public Only</option>
          </select>

          {/* Favorites Filter */}
          <button
            type="button"
            className={`btn ${favoriteFilter ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setFavoriteFilter(!favoriteFilter)}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <Star size={14} style={{ color: favoriteFilter ? "#fff" : "#f59e0b" }} />
            <span>Favorites</span>
          </button>

          {/* Sort selector */}
          <select
            className="form-input"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            style={{ width: "auto" }}
          >
            <option value="created_desc">Recently Added</option>
            <option value="updated_desc">Recently Updated</option>
            <option value="name">Name (A-Z)</option>
          </select>
        </div>
      </div>

      {/* People Grid */}
      {loading ? (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
          Loading people records...
        </div>
      ) : people.length === 0 ? (
        <div
          style={{
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-color)",
            borderRadius: "8px",
            padding: "48px 20px",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <Users size={40} style={{ color: "var(--text-muted)", opacity: 0.5 }} />
          <h3 style={{ fontSize: "16px", fontWeight: 600, margin: 0 }}>No contacts found</h3>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", maxWidth: "400px", margin: 0 }}>
            {search || relationshipFilter !== "all" || favoriteFilter
              ? "No people match your active filters. Try clearing your search filters."
              : "Start building your personal relationship engine by adding your first friend, family member, or colleague."}
          </p>
          <button className="btn btn-primary" onClick={handleCreateNew} style={{ marginTop: "8px" }}>
            <Plus size={16} />
            <span>Add First Person</span>
          </button>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "16px",
          }}
        >
          {people.map((person) => {
            let importantDatesList: ImportantDate[] = [];
            try {
              importantDatesList = JSON.parse(person.importantDatesJson || "[]");
            } catch {}

            let interestsList: string[] = [];
            try {
              interestsList = JSON.parse(person.interests || "[]");
            } catch {}

            return (
              <div
                key={person.id}
                style={{
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "8px",
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: "14px",
                  transition: "transform 0.15s ease, border-color 0.15s ease",
                  position: "relative",
                }}
              >
                {/* Top header line */}
                <div>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                    {/* Avatar */}
                    {person.avatarUrl ? (
                      <img
                        src={person.avatarUrl}
                        alt={person.displayName}
                        style={{
                          width: "48px",
                          height: "48px",
                          borderRadius: "50%",
                          objectFit: "cover",
                          border: "1px solid var(--border-color)",
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "48px",
                          height: "48px",
                          borderRadius: "50%",
                          backgroundColor: "var(--accent)",
                          color: "#fff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700,
                          fontSize: "18px",
                          flexShrink: 0,
                        }}
                      >
                        {person.displayName.charAt(0).toUpperCase()}
                      </div>
                    )}

                    {/* Person Title & Subtitle */}
                    <div style={{ flex: 1, overflow: "hidden" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                        <Link
                          href={`/people/${person.slug}`}
                          style={{
                            fontSize: "15px",
                            fontWeight: 700,
                            color: "var(--text-primary)",
                            textDecoration: "none",
                          }}
                        >
                          {person.displayName}
                        </Link>
                        {person.nickname && (
                          <span style={{ fontSize: "12px", color: "var(--text-muted)", fontStyle: "italic" }}>
                            ({person.nickname})
                          </span>
                        )}
                      </div>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          marginTop: "4px",
                          flexWrap: "wrap",
                        }}
                      >
                        {person.relationshipType && (
                          <span
                            className="status-badge"
                            style={{
                              backgroundColor: "var(--bg-hover)",
                              color: "var(--text-primary)",
                              border: "1px solid var(--border-color)",
                              fontSize: "11px",
                            }}
                          >
                            {person.relationshipType}
                          </span>
                        )}
                        <span
                          style={{
                            fontSize: "11px",
                            color: "var(--text-muted)",
                            display: "flex",
                            alignItems: "center",
                            gap: "3px",
                          }}
                        >
                          {person.visibility === "private" && <Lock size={11} />}
                          {person.visibility === "unlisted" && <EyeOff size={11} />}
                          {person.visibility === "public" && <Globe size={11} />}
                          <span style={{ textTransform: "capitalize" }}>{person.visibility}</span>
                        </span>
                      </div>
                    </div>

                    {/* Favorite toggle */}
                    <button
                      onClick={(e) => handleToggleFav(person.id, e)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: "2px",
                        color: person.favorite ? "#f59e0b" : "var(--text-muted)",
                      }}
                      title={person.favorite ? "Unmark Favorite" : "Mark Favorite"}
                    >
                      <Star size={18} fill={person.favorite ? "#f59e0b" : "none"} />
                    </button>
                  </div>

                  {/* Important Dates Badges */}
                  {importantDatesList.length > 0 && (
                    <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "4px" }}>
                      {importantDatesList.slice(0, 2).map((d) => (
                        <div
                          key={d.id}
                          style={{
                            fontSize: "11px",
                            color: "var(--text-secondary)",
                            display: "flex",
                            alignItems: "center",
                            gap: "5px",
                          }}
                        >
                          <Calendar size={12} style={{ color: "var(--accent)" }} />
                          <span>{d.title}:</span>
                          <span style={{ fontWeight: 600 }}>{d.date}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Interests tags */}
                  {interestsList.length > 0 && (
                    <div style={{ marginTop: "10px", display: "flex", flexWrap: "wrap", gap: "4px" }}>
                      {interestsList.slice(0, 4).map((interest, i) => (
                        <span
                          key={i}
                          style={{
                            fontSize: "10px",
                            backgroundColor: "rgba(255, 102, 0, 0.08)",
                            color: "var(--accent)",
                            padding: "2px 6px",
                            borderRadius: "4px",
                          }}
                        >
                          #{interest}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Card Actions Footer */}
                <div
                  style={{
                    borderTop: "1px solid var(--border-color)",
                    paddingTop: "10px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Link
                    href={`/people/${person.slug}`}
                    className="btn btn-secondary"
                    style={{ fontSize: "12px", padding: "4px 10px" }}
                  >
                    <span>Memory Hub</span>
                    <ChevronRight size={13} />
                  </Link>

                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <button
                      className="btn btn-secondary"
                      onClick={() => handleEdit(person)}
                      style={{ padding: "4px 8px" }}
                      title="Edit Person"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={(e) => handleDelete(person.id, person.displayName, e)}
                      style={{ padding: "4px 8px", color: "#ef4444" }}
                      title="Delete Person"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Person Create/Edit Modal */}
      <PersonFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        personToEdit={personToEdit}
        onSuccess={loadData}
      />
    </div>
  );
}
