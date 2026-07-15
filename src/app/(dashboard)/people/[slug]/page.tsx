"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PersonRecord, GalleryPhoto, LocationRecord, TripRecord, Microblog, Project, CollectionRecord } from "@/db/schema";
import {
  getPersonByIdOrSlugAction,
  getPersonConnectionsAction,
  getPersonTimelineAction,
  deletePersonAction,
  toggleFavoritePersonAction,
  removePersonEntityConnectionAction,
  PersonConnectionsResult,
  PersonTimelineItem,
} from "@/features/people/actions";
import { ImportantDate, SocialLinks } from "@/features/people/schema";
import { PersonFormModal } from "@/features/people/components/PersonFormModal";
import { ConnectEntityModal } from "@/features/people/components/ConnectEntityModal";
import { getLocations } from "@/features/locations/actions";
import { getTrips } from "@/features/trips/actions";
import {
  ArrowLeft,
  Users,
  Star,
  Lock,
  EyeOff,
  Globe,
  Edit2,
  Trash2,
  Calendar,
  MapPin,
  Compass,
  Image as ImageIcon,
  MessageSquareText,
  Folder,
  FolderPlus,
  Link2,
  Plus,
  ExternalLink,
  Github,
  Instagram,
  Linkedin,
  Clock,
  ChevronRight,
  X,
} from "lucide-react";
import { getBrowserCache, setBrowserCache } from "@/lib/client-cache";

export default function PersonDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const slug = resolvedParams.slug;

  const [person, setPerson] = useState<PersonRecord | null>(null);
  const [connections, setConnections] = useState<PersonConnectionsResult | null>(null);
  const [timeline, setTimeline] = useState<PersonTimelineItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Entities for connection picker
  const [allLocations, setAllLocations] = useState<LocationRecord[]>([]);
  const [allTrips, setAllTrips] = useState<TripRecord[]>([]);

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "connections" | "timeline">("overview");

  const loadPerson = useCallback(async () => {
    const cacheKey = `swr_person_detail_${slug}`;
    const cached = getBrowserCache<{
      person: PersonRecord;
      connections: PersonConnectionsResult;
      timeline: PersonTimelineItem[];
    }>(cacheKey);

    if (cached) {
      setPerson(cached.person);
      setConnections(cached.connections);
      setTimeline(cached.timeline);
      setLoading(false);
    } else {
      setLoading(true);
    }

    try {
      const p = await getPersonByIdOrSlugAction(slug);
      if (p) {
        setPerson(p);
        const [connRes, timelineRes, locs, trps] = await Promise.all([
          getPersonConnectionsAction(p.id),
          getPersonTimelineAction(p.id),
          getLocations(),
          getTrips(),
        ]);
        setConnections(connRes);
        setTimeline(timelineRes);
        setAllLocations(locs);
        setAllTrips(trps);
        setBrowserCache(cacheKey, { person: p, connections: connRes, timeline: timelineRes });
      }
    } catch (err) {
      console.error("Error loading person detail:", err);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadPerson();
  }, [loadPerson]);

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
        Loading person memory hub...
      </div>
    );
  }

  if (!person) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <h2>Person profile not found</h2>
        <Link href="/people" className="btn btn-primary" style={{ marginTop: "12px", display: "inline-flex" }}>
          <ArrowLeft size={16} />
          <span>Back to People</span>
        </Link>
      </div>
    );
  }

  let importantDates: ImportantDate[] = [];
  try {
    importantDates = JSON.parse(person.importantDatesJson || "[]");
  } catch {}

  let interests: string[] = [];
  try {
    interests = JSON.parse(person.interests || "[]");
  } catch {}

  let socialLinks: SocialLinks = {};
  try {
    socialLinks = JSON.parse(person.socialLinksJson || "{}");
  } catch {}

  const handleToggleFavorite = async () => {
    await toggleFavoritePersonAction(person.id);
    loadPerson();
  };

  const handleDelete = async () => {
    if (confirm(`Are you sure you want to delete ${person.displayName}?`)) {
      await deletePersonAction(person.id);
      router.push("/people");
    }
  };

  const handleRemoveConnection = async (relId?: string) => {
    if (!relId) return;
    if (confirm("Disconnect this entity from this person?")) {
      await removePersonEntityConnectionAction(relId, person.slug);
      loadPerson();
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Top Breadcrumb & Actions Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Link href="/people" style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "var(--text-muted)", textDecoration: "none" }}>
          <ArrowLeft size={14} />
          <span>Back to People</span>
        </Link>

        <div style={{ display: "flex", gap: "8px" }}>
          <button className="btn btn-secondary" onClick={handleToggleFavorite}>
            <Star size={15} fill={person.favorite ? "#f59e0b" : "none"} style={{ color: person.favorite ? "#f59e0b" : "var(--text-muted)" }} />
            <span>{person.favorite ? "Favorited" : "Favorite"}</span>
          </button>
          <button className="btn btn-secondary" onClick={() => setIsEditModalOpen(true)}>
            <Edit2 size={15} />
            <span>Edit Profile</span>
          </button>
          <button className="btn btn-secondary" onClick={handleDelete} style={{ color: "#ef4444" }}>
            <Trash2 size={15} />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {/* Hero Card Banner */}
      <div
        style={{
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-color)",
          borderRadius: "8px",
          padding: "24px",
          display: "flex",
          flexWrap: "wrap",
          gap: "20px",
          alignItems: "center",
        }}
      >
        {person.avatarUrl ? (
          <img
            src={person.avatarUrl}
            alt={person.displayName}
            style={{
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              objectFit: "cover",
              border: "2px solid var(--accent)",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            }}
          />
        ) : (
          <div
            style={{
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              backgroundColor: "var(--accent)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: "32px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            }}
          >
            {person.displayName.charAt(0).toUpperCase()}
          </div>
        )}

        <div style={{ flex: 1, minWidth: "240px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <h1 style={{ fontSize: "22px", fontWeight: 700, margin: 0 }}>{person.displayName}</h1>
            {person.nickname && (
              <span style={{ fontSize: "15px", color: "var(--text-muted)", fontStyle: "italic" }}>
                "{person.nickname}"
              </span>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px", flexWrap: "wrap" }}>
            {person.relationshipType && (
              <span
                className="status-badge"
                style={{
                  backgroundColor: "var(--accent)",
                  color: "var(--accent-text)",
                  fontWeight: 600,
                  fontSize: "12px",
                }}
              >
                {person.relationshipType}
              </span>
            )}

            <span style={{ fontSize: "12px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px" }}>
              {person.visibility === "private" && <Lock size={12} />}
              {person.visibility === "unlisted" && <EyeOff size={12} />}
              {person.visibility === "public" && <Globe size={12} />}
              <span style={{ textTransform: "capitalize" }}>{person.visibility} Contact</span>
            </span>

            {person.firstName && person.lastName && (
              <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                Full name: {person.firstName} {person.lastName}
              </span>
            )}
          </div>

          {/* Social Links Row */}
          <div style={{ display: "flex", gap: "10px", marginTop: "12px", flexWrap: "wrap" }}>
            {socialLinks.instagram && (
              <a
                href={socialLinks.instagram.startsWith("http") ? socialLinks.instagram : `https://instagram.com/${socialLinks.instagram}`}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: "12px", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "4px", textDecoration: "none" }}
              >
                <Instagram size={14} style={{ color: "#e1306c" }} />
                <span>Instagram</span>
              </a>
            )}
            {socialLinks.github && (
              <a
                href={socialLinks.github.startsWith("http") ? socialLinks.github : `https://github.com/${socialLinks.github}`}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: "12px", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "4px", textDecoration: "none" }}
              >
                <Github size={14} />
                <span>GitHub</span>
              </a>
            )}
            {socialLinks.linkedin && (
              <a
                href={socialLinks.linkedin.startsWith("http") ? socialLinks.linkedin : `https://linkedin.com/in/${socialLinks.linkedin}`}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: "12px", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "4px", textDecoration: "none" }}
              >
                <Linkedin size={14} style={{ color: "#0a66c2" }} />
                <span>LinkedIn</span>
              </a>
            )}
            {socialLinks.website && (
              <a
                href={socialLinks.website.startsWith("http") ? socialLinks.website : `https://${socialLinks.website}`}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: "12px", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "4px", textDecoration: "none" }}
              >
                <ExternalLink size={14} style={{ color: "var(--accent)" }} />
                <span>Website</span>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border-color)", gap: "16px" }}>
        <button
          onClick={() => setActiveTab("overview")}
          style={{
            background: "none",
            border: "none",
            borderBottom: activeTab === "overview" ? "2px solid var(--accent)" : "2px solid transparent",
            color: activeTab === "overview" ? "var(--accent)" : "var(--text-muted)",
            fontWeight: activeTab === "overview" ? 700 : 500,
            padding: "8px 12px",
            cursor: "pointer",
            fontSize: "14px",
          }}
        >
          Overview & Notes
        </button>
        <button
          onClick={() => setActiveTab("connections")}
          style={{
            background: "none",
            border: "none",
            borderBottom: activeTab === "connections" ? "2px solid var(--accent)" : "2px solid transparent",
            color: activeTab === "connections" ? "var(--accent)" : "var(--text-muted)",
            fontWeight: activeTab === "connections" ? 700 : 500,
            padding: "8px 12px",
            cursor: "pointer",
            fontSize: "14px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <span>Connections Hub</span>
          {connections && (
            <span
              style={{
                backgroundColor: "var(--bg-hover)",
                fontSize: "11px",
                padding: "1px 6px",
                borderRadius: "10px",
              }}
            >
              {connections.photos.length +
                connections.locations.length +
                connections.trips.length +
                connections.microblogs.length +
                connections.projects.length +
                connections.collections.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("timeline")}
          style={{
            background: "none",
            border: "none",
            borderBottom: activeTab === "timeline" ? "2px solid var(--accent)" : "2px solid transparent",
            color: activeTab === "timeline" ? "var(--accent)" : "var(--text-muted)",
            fontWeight: activeTab === "timeline" ? 700 : 500,
            padding: "8px 12px",
            cursor: "pointer",
            fontSize: "14px",
          }}
        >
          Memory Timeline
        </button>
      </div>

      {/* TAB 1: OVERVIEW & NOTES */}
      {activeTab === "overview" && (
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "20px" }}>
          {/* Left Column: Markdown Notes & Interests */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div
              style={{
                backgroundColor: "var(--bg-card)",
                border: "1px solid var(--border-color)",
                borderRadius: "8px",
                padding: "20px",
              }}
            >
              <h3 style={{ fontSize: "15px", fontWeight: 700, marginBottom: "12px", margin: "0 0 12px 0" }}>
                Personal Notes & Memories
              </h3>
              {person.notesMarkdown ? (
                <div
                  style={{
                    whiteSpace: "pre-wrap",
                    fontFamily: "var(--font-sans)",
                    lineHeight: "1.6",
                    fontSize: "14px",
                    color: "var(--text-primary)",
                  }}
                >
                  {person.notesMarkdown}
                </div>
              ) : (
                <p style={{ color: "var(--text-muted)", fontStyle: "italic", fontSize: "13px" }}>
                  No personal markdown notes saved yet. Click "Edit Profile" to record gift ideas, funny stories, or shared interests.
                </p>
              )}
            </div>

            {/* Interests & Tags */}
            <div
              style={{
                backgroundColor: "var(--bg-card)",
                border: "1px solid var(--border-color)",
                borderRadius: "8px",
                padding: "20px",
              }}
            >
              <h3 style={{ fontSize: "14px", fontWeight: 700, marginBottom: "12px", margin: "0 0 12px 0" }}>
                Interests & Shared Topics
              </h3>
              {interests.length > 0 ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {interests.map((interest, i) => (
                    <span
                      key={i}
                      style={{
                        backgroundColor: "var(--bg-hover)",
                        border: "1px solid var(--border-color)",
                        fontSize: "12px",
                        padding: "4px 10px",
                        borderRadius: "20px",
                        color: "var(--text-primary)",
                      }}
                    >
                      {interest}
                    </span>
                  ))}
                </div>
              ) : (
                <div style={{ color: "var(--text-muted)", fontSize: "13px" }}>No interests tagged yet.</div>
              )}
            </div>
          </div>

          {/* Right Column: Important Dates Card */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div
              style={{
                backgroundColor: "var(--bg-card)",
                border: "1px solid var(--border-color)",
                borderRadius: "8px",
                padding: "20px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
                <Calendar size={16} style={{ color: "var(--accent)" }} />
                <h3 style={{ fontSize: "15px", fontWeight: 700, margin: 0 }}>
                  Important Dates
                </h3>
              </div>

              {importantDates.length === 0 ? (
                <div style={{ color: "var(--text-muted)", fontSize: "13px", fontStyle: "italic" }}>
                  No dates registered (birthday, anniversary, met on, etc.).
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {importantDates.map((d) => (
                    <div
                      key={d.id}
                      style={{
                        backgroundColor: "var(--bg-hover)",
                        border: "1px solid var(--border-color)",
                        borderRadius: "6px",
                        padding: "10px 12px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "13px" }}>{d.title}</div>
                        <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
                          {d.date}
                        </div>
                      </div>
                      {d.reminderEnabled && (
                        <span
                          style={{
                            fontSize: "10px",
                            backgroundColor: "rgba(255, 102, 0, 0.15)",
                            color: "var(--accent)",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            fontWeight: 600,
                          }}
                        >
                          Reminder On
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CONNECTIONS HUB */}
      {activeTab === "connections" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>
              Connected Entities
            </h2>
            <button className="btn btn-primary" onClick={() => setIsConnectModalOpen(true)}>
              <Plus size={16} />
              <span>Connect Item</span>
            </button>
          </div>

          {/* Locations */}
          <div
            style={{
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              borderRadius: "8px",
              padding: "16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
              <MapPin size={16} style={{ color: "var(--accent)" }} />
              <h3 style={{ fontSize: "14px", fontWeight: 700, margin: 0 }}>
                Places Visited Together ({connections?.locations.length || 0})
              </h3>
            </div>
            {connections?.locations.length === 0 ? (
              <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>No locations linked yet.</div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                {connections?.locations.map((loc) => (
                  <div
                    key={loc.entity.id}
                    style={{
                      backgroundColor: "var(--bg-hover)",
                      border: "1px solid var(--border-color)",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      fontSize: "13px",
                    }}
                  >
                    <span>{loc.entity.name}</span>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>({loc.relationshipName})</span>
                    <button
                      onClick={() => handleRemoveConnection(loc.relationshipId)}
                      style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: 0 }}
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Trips */}
          <div
            style={{
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              borderRadius: "8px",
              padding: "16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
              <Compass size={16} style={{ color: "var(--accent)" }} />
              <h3 style={{ fontSize: "14px", fontWeight: 700, margin: 0 }}>
                Shared Trips ({connections?.trips.length || 0})
              </h3>
            </div>
            {connections?.trips.length === 0 ? (
              <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>No trips linked yet.</div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                {connections?.trips.map((t) => (
                  <div
                    key={t.entity.id}
                    style={{
                      backgroundColor: "var(--bg-hover)",
                      border: "1px solid var(--border-color)",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      fontSize: "13px",
                    }}
                  >
                    <span>{t.entity.title}</span>
                    <button
                      onClick={() => handleRemoveConnection(t.relationshipId)}
                      style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: 0 }}
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Photos */}
          <div
            style={{
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              borderRadius: "8px",
              padding: "16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
              <ImageIcon size={16} style={{ color: "var(--accent)" }} />
              <h3 style={{ fontSize: "14px", fontWeight: 700, margin: 0 }}>
                Photos Together ({connections?.photos.length || 0})
              </h3>
            </div>
            {connections?.photos.length === 0 ? (
              <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>No gallery photos linked yet.</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "10px" }}>
                {connections?.photos.map((ph) => (
                  <div
                    key={ph.entity.id}
                    style={{
                      position: "relative",
                      borderRadius: "6px",
                      overflow: "hidden",
                      border: "1px solid var(--border-color)",
                      aspectRatio: "1",
                    }}
                  >
                    <img
                      src={ph.entity.thumbnailUrl || ph.entity.mediumUrl}
                      alt={ph.entity.title}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                    <button
                      onClick={() => handleRemoveConnection(ph.relationshipId)}
                      style={{
                        position: "absolute",
                        top: "4px",
                        right: "4px",
                        backgroundColor: "rgba(0,0,0,0.6)",
                        color: "#fff",
                        border: "none",
                        borderRadius: "50%",
                        padding: "2px",
                        cursor: "pointer",
                      }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Microblogs & Projects */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div
              style={{
                backgroundColor: "var(--bg-card)",
                border: "1px solid var(--border-color)",
                borderRadius: "8px",
                padding: "16px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <MessageSquareText size={16} style={{ color: "var(--accent)" }} />
                <h3 style={{ fontSize: "14px", fontWeight: 700, margin: 0 }}>
                  Microblogs ({connections?.microblogs.length || 0})
                </h3>
              </div>
              {connections?.microblogs.length === 0 ? (
                <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>No microblogs linked.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {connections?.microblogs.map((mb) => (
                    <div
                      key={mb.entity.id}
                      style={{
                        fontSize: "12px",
                        backgroundColor: "var(--bg-hover)",
                        padding: "6px 10px",
                        borderRadius: "4px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span>{mb.entity.contentMarkdown.slice(0, 45)}...</span>
                      <button
                        onClick={() => handleRemoveConnection(mb.relationshipId)}
                        style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer" }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div
              style={{
                backgroundColor: "var(--bg-card)",
                border: "1px solid var(--border-color)",
                borderRadius: "8px",
                padding: "16px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <Folder size={16} style={{ color: "var(--accent)" }} />
                <h3 style={{ fontSize: "14px", fontWeight: 700, margin: 0 }}>
                  Projects ({connections?.projects.length || 0})
                </h3>
              </div>
              {connections?.projects.length === 0 ? (
                <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>No projects linked.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {connections?.projects.map((pr) => (
                    <div
                      key={pr.entity.id}
                      style={{
                        fontSize: "12px",
                        backgroundColor: "var(--bg-hover)",
                        padding: "6px 10px",
                        borderRadius: "4px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span>{pr.entity.name}</span>
                      <button
                        onClick={() => handleRemoveConnection(pr.relationshipId)}
                        style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer" }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: MEMORY TIMELINE */}
      {activeTab === "timeline" && (
        <div
          style={{
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-color)",
            borderRadius: "8px",
            padding: "24px",
          }}
        >
          <h2 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "20px", margin: "0 0 20px 0" }}>
            Relationship Story & Memory Feed
          </h2>

          {timeline.length === 0 ? (
            <div style={{ color: "var(--text-muted)", fontSize: "13px", textAlign: "center", padding: "30px" }}>
              No timeline items recorded yet. Add important dates or connect trips, photos, and places to see the story unfold.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", position: "relative", paddingLeft: "20px" }}>
              {/* Vertical line accent */}
              <div
                style={{
                  position: "absolute",
                  left: "7px",
                  top: "4px",
                  bottom: "4px",
                  width: "2px",
                  backgroundColor: "var(--border-color)",
                }}
              />

              {timeline.map((item) => (
                <div
                  key={item.id}
                  style={{
                    position: "relative",
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}
                >
                  {/* Circle dot */}
                  <div
                    style={{
                      position: "absolute",
                      left: "-20px",
                      top: "4px",
                      width: "12px",
                      height: "12px",
                      borderRadius: "50%",
                      backgroundColor:
                        item.type === "date"
                          ? "#f59e0b"
                          : item.type === "trip"
                          ? "var(--accent)"
                          : "var(--text-muted)",
                      border: "2px solid var(--bg-card)",
                    }}
                  />

                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 600 }}>
                      {item.date}
                    </span>
                    <span
                      className="status-badge"
                      style={{
                        fontSize: "9px",
                        textTransform: "uppercase",
                        backgroundColor: "var(--bg-hover)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {item.type}
                    </span>
                  </div>

                  <div style={{ fontSize: "14px", fontWeight: 600 }}>{item.title}</div>
                  {item.description && (
                    <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{item.description}</div>
                  )}

                  {item.metadata?.thumbnailUrl && (
                    <img
                      src={item.metadata.thumbnailUrl}
                      alt={item.title}
                      style={{
                        width: "80px",
                        height: "80px",
                        borderRadius: "6px",
                        objectFit: "cover",
                        marginTop: "6px",
                        border: "1px solid var(--border-color)",
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Edit Form Modal */}
      <PersonFormModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        personToEdit={person}
        onSuccess={loadPerson}
      />

      {/* Connect Entity Modal */}
      <ConnectEntityModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        personId={person.id}
        personName={person.displayName}
        onSuccess={loadPerson}
        allLocations={allLocations}
        allTrips={allTrips}
      />
    </div>
  );
}
