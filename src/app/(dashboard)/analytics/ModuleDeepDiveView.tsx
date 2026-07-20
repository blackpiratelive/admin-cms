"use client";

import {
  SupportedModule,
  JournalAnalyticsData,
  MicroblogAnalyticsData,
  TodoAnalyticsData,
  GalleryAnalyticsData,
  MovieAnalyticsData,
  TvAnalyticsData,
  MusicAnalyticsData,
  PeopleAnalyticsData,
  LocationAnalyticsData,
  TripAnalyticsData,
} from "@/features/analytics/types";
import {
  BookOpen,
  MessageSquareText,
  CheckSquare,
  Image as ImageIcon,
  Film,
  Tv,
  Music,
  Users,
  MapPin,
  Compass,
  Flame,
  FileText,
  Smile,
  Tag,
  Calendar,
  Clock,
  HardDrive,
  Star,
  Award,
  TrendingUp,
  BarChart2,
  PieChart,
  Globe,
  Headphones,
} from "lucide-react";

interface ModuleDeepDiveViewProps {
  moduleName: SupportedModule;
  data: any;
  isLoading: boolean;
}

export function ModuleDeepDiveView({ moduleName, data, isLoading }: ModuleDeepDiveViewProps) {
  if (isLoading) {
    return (
      <div
        style={{
          background: "var(--card-bg, rgba(255,255,255,0.03))",
          padding: "3rem 1.5rem",
          borderRadius: "12px",
          border: "1px solid var(--border-color, rgba(255,255,255,0.06))",
          textAlign: "center",
        }}
      >
        <div style={{ opacity: 0.7, fontSize: "1rem", fontWeight: 600 }}>
          Calculating and aggregating metrics for <span style={{ textTransform: "capitalize", color: "var(--accent-color, #ff6600)" }}>{moduleName}</span>...
        </div>
      </div>
    );
  }

  if (!data || Object.keys(data).length === 0) {
    return (
      <div
        style={{
          background: "var(--card-bg, rgba(255,255,255,0.03))",
          padding: "2.5rem 1.5rem",
          borderRadius: "12px",
          border: "1px solid var(--border-color, rgba(255,255,255,0.06))",
          textAlign: "center",
          opacity: 0.7,
        }}
      >
        No analytics data available for <strong style={{ textTransform: "capitalize" }}>{moduleName}</strong> in the selected time horizon.
      </div>
    );
  }

  switch (moduleName) {
    case "journal":
      return <JournalDeepDive data={data as JournalAnalyticsData} />;
    case "microblog":
      return <MicroblogDeepDive data={data as MicroblogAnalyticsData} />;
    case "todos":
      return <TodoDeepDive data={data as TodoAnalyticsData} />;
    case "gallery":
      return <GalleryDeepDive data={data as GalleryAnalyticsData} />;
    case "movies":
      return <MovieDeepDive data={data as MovieAnalyticsData} />;
    case "tv":
      return <TvDeepDive data={data as TvAnalyticsData} />;
    case "music":
      return <MusicDeepDive data={data as MusicAnalyticsData} />;
    case "people":
      return <PeopleDeepDive data={data as PeopleAnalyticsData} />;
    case "locations":
      return <LocationDeepDive data={data as LocationAnalyticsData} />;
    case "trips":
      return <TripDeepDive data={data as TripAnalyticsData} />;
    default:
      return (
        <div
          style={{
            background: "var(--card-bg, rgba(255,255,255,0.03))",
            padding: "1.5rem",
            borderRadius: "12px",
            border: "1px solid var(--border-color, rgba(255,255,255,0.06))",
          }}
        >
          <pre style={{ margin: 0, fontSize: "0.85rem", overflow: "auto" }}>
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      );
  }
}

/* ============================================================================
 * 1. JOURNAL DEEP DIVE VIEW
 * ============================================================================ */
function JournalDeepDive({ data }: { data: JournalAnalyticsData }) {
  const moodColors: Record<string, string> = {
    amazing: "#10b981",
    happy: "#3b82f6",
    good: "#06b6d4",
    neutral: "#8b5cf6",
    bad: "#f59e0b",
    sad: "#ef4444",
    terrible: "#9f1239",
  };

  const totalMoods = (data.moodDistribution || []).reduce((acc, curr) => acc + curr.count, 0) || 1;

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      {/* Overview Metric Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
        <StatBox title="Total Entries" value={data.totalEntries?.toLocaleString()} icon={BookOpen} color="#3b82f6" />
        <StatBox title="Words Written" value={data.wordsWritten?.toLocaleString()} icon={FileText} color="#10b981" />
        <StatBox title="Characters" value={data.charactersWritten?.toLocaleString()} icon={BarChart2} color="#8b5cf6" />
        <StatBox title="Avg Entry Length" value={`${data.averageEntryLengthWords || 0} words`} icon={TrendingUp} color="#f59e0b" />
        <StatBox title="Writing Streak" value={`${data.streakDays || 0} days`} subtext={`Longest: ${data.longestStreakDays || 0} days`} icon={Flame} color="#f97316" />
        <StatBox title="Images & Files" value={`${data.inlineImagesCount || 0} photos / ${data.attachmentsCount || 0} files`} icon={ImageIcon} color="#ec4899" />
      </div>

      {/* Longest & Shortest Entries */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1rem" }}>
        {data.longestEntry && (
          <div
            style={{
              background: "var(--card-bg, rgba(255,255,255,0.03))",
              padding: "1.25rem",
              borderRadius: "12px",
              border: "1px solid var(--border-color, rgba(255,255,255,0.06))",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem", color: "#10b981", fontWeight: 600 }}>
              <Award size={18} />
              <span>Longest Entry</span>
            </div>
            <div style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0.25rem 0" }}>{data.longestEntry.title}</div>
            <div style={{ fontSize: "0.85rem", opacity: 0.7 }}>{data.longestEntry.wordCount.toLocaleString()} words</div>
          </div>
        )}

        {data.shortestEntry && (
          <div
            style={{
              background: "var(--card-bg, rgba(255,255,255,0.03))",
              padding: "1.25rem",
              borderRadius: "12px",
              border: "1px solid var(--border-color, rgba(255,255,255,0.06))",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem", color: "#3b82f6", fontWeight: 600 }}>
              <FileText size={18} />
              <span>Shortest Entry</span>
            </div>
            <div style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0.25rem 0" }}>{data.shortestEntry.title}</div>
            <div style={{ fontSize: "0.85rem", opacity: 0.7 }}>{data.shortestEntry.wordCount.toLocaleString()} words</div>
          </div>
        )}
      </div>

      {/* Mood Distribution */}
      {data.moodDistribution && data.moodDistribution.length > 0 && (
        <div
          style={{
            background: "var(--card-bg, rgba(255,255,255,0.03))",
            padding: "1.25rem",
            borderRadius: "12px",
            border: "1px solid var(--border-color, rgba(255,255,255,0.06))",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
            <Smile size={18} style={{ color: "#f59e0b" }} />
            <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>Mood Distribution</h3>
          </div>
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {data.moodDistribution.map((m) => {
              const pct = Math.round((m.count / totalMoods) * 100);
              const color = moodColors[m.mood.toLowerCase()] || "#3b82f6";
              return (
                <div key={m.mood}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "0.25rem" }}>
                    <span style={{ textTransform: "capitalize", fontWeight: 600 }}>{m.mood}</span>
                    <span style={{ opacity: 0.8 }}>{m.count} ({pct}%)</span>
                  </div>
                  <div style={{ height: "8px", background: "rgba(255,255,255,0.08)", borderRadius: "4px", overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: "4px", transition: "width 0.4s ease" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Mentions & Relationships */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
        {/* Most Mentioned People */}
        {data.mostMentionedPeople && data.mostMentionedPeople.length > 0 && (
          <div
            style={{
              background: "var(--card-bg, rgba(255,255,255,0.03))",
              padding: "1.25rem",
              borderRadius: "12px",
              border: "1px solid var(--border-color, rgba(255,255,255,0.06))",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
              <Users size={18} style={{ color: "#eab308" }} />
              <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>Top Mentioned People</h3>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              {data.mostMentionedPeople.map((p) => (
                <span
                  key={p.id}
                  style={{
                    background: "rgba(234, 179, 8, 0.12)",
                    color: "#eab308",
                    border: "1px solid rgba(234, 179, 8, 0.3)",
                    padding: "0.3rem 0.75rem",
                    borderRadius: "16px",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                  }}
                >
                  {p.name} <span style={{ opacity: 0.7 }}>({p.count})</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Most Mentioned Locations & Trips */}
        {((data.mostMentionedLocations && data.mostMentionedLocations.length > 0) ||
          (data.mostMentionedTrips && data.mostMentionedTrips.length > 0)) && (
          <div
            style={{
              background: "var(--card-bg, rgba(255,255,255,0.03))",
              padding: "1.25rem",
              borderRadius: "12px",
              border: "1px solid var(--border-color, rgba(255,255,255,0.06))",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
              <MapPin size={18} style={{ color: "#ef4444" }} />
              <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>Top Mentioned Places & Trips</h3>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              {(data.mostMentionedLocations || []).map((loc) => (
                <span
                  key={loc.id}
                  style={{
                    background: "rgba(239, 68, 68, 0.12)",
                    color: "#ef4444",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    padding: "0.3rem 0.75rem",
                    borderRadius: "16px",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                  }}
                >
                  📍 {loc.name} <span style={{ opacity: 0.7 }}>({loc.count})</span>
                </span>
              ))}
              {(data.mostMentionedTrips || []).map((t) => (
                <span
                  key={t.id}
                  style={{
                    background: "rgba(99, 102, 241, 0.12)",
                    color: "#6366f1",
                    border: "1px solid rgba(99, 102, 241, 0.3)",
                    padding: "0.3rem 0.75rem",
                    borderRadius: "16px",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                  }}
                >
                  ✈️ {t.name} <span style={{ opacity: 0.7 }}>({t.count})</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Most Used Tags */}
      {data.mostUsedTags && data.mostUsedTags.length > 0 && (
        <div
          style={{
            background: "var(--card-bg, rgba(255,255,255,0.03))",
            padding: "1.25rem",
            borderRadius: "12px",
            border: "1px solid var(--border-color, rgba(255,255,255,0.06))",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
            <Tag size={18} style={{ color: "#ec4899" }} />
            <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>Most Used Journal Tags</h3>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {data.mostUsedTags.map((t) => (
              <span
                key={t.tag}
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid var(--border-color, rgba(255,255,255,0.1))",
                  padding: "0.3rem 0.75rem",
                  borderRadius: "20px",
                  fontSize: "0.85rem",
                }}
              >
                #{t.tag} <strong style={{ color: "var(--accent-color, #ff6600)" }}>({t.count})</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Weekday Breakdown */}
      {data.entriesByWeekday && data.entriesByWeekday.length > 0 && (
        <div
          style={{
            background: "var(--card-bg, rgba(255,255,255,0.03))",
            padding: "1.25rem",
            borderRadius: "12px",
            border: "1px solid var(--border-color, rgba(255,255,255,0.06))",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
            <Calendar size={18} style={{ color: "#3b82f6" }} />
            <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>Entries Written by Day of Week</h3>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: "0.75rem" }}>
            {data.entriesByWeekday.map((dayObj) => (
              <div
                key={dayObj.day}
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid var(--border-color, rgba(255,255,255,0.06))",
                  padding: "0.75rem",
                  borderRadius: "8px",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: "0.8rem", opacity: 0.7 }}>{dayObj.day}</div>
                <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#3b82f6", marginTop: "0.2rem" }}>
                  {dayObj.count}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================================
 * 2. MICROBLOG DEEP DIVE VIEW
 * ============================================================================ */
function MicroblogDeepDive({ data }: { data: MicroblogAnalyticsData }) {
  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
        <StatBox title="Total Posts" value={data.totalPosts?.toLocaleString()} icon={MessageSquareText} color="#10b981" />
        <StatBox title="Published / Drafts" value={`${data.publishedCount || 0} / ${data.draftsCount || 0}`} icon={FileText} color="#3b82f6" />
        <StatBox title="Avg Length" value={`${data.averageLengthChars || 0} chars`} icon={BarChart2} color="#8b5cf6" />
        <StatBox title="Frequency" value={`${data.postingFrequencyPerWeek || 0} posts/wk`} icon={TrendingUp} color="#f59e0b" />
        <StatBox title="Image Posts" value={data.imagePostsCount?.toLocaleString()} icon={ImageIcon} color="#ec4899" />
        <StatBox title="Cross Syncs" value={`Bluesky: ${data.blueskySyncCount || 0} | Masto: ${data.mastodonSyncCount || 0}`} icon={Globe} color="#06b6d4" />
      </div>

      {data.mostUsedTags && data.mostUsedTags.length > 0 && (
        <TagCloudSection title="Top Microblog Hashtags" tags={data.mostUsedTags} icon={Tag} color="#10b981" />
      )}
    </div>
  );
}

/* ============================================================================
 * 3. TODO DEEP DIVE VIEW
 * ============================================================================ */
function TodoDeepDive({ data }: { data: TodoAnalyticsData }) {
  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
        <StatBox title="Total Tasks" value={data.totalTasks?.toLocaleString()} icon={CheckSquare} color="#f59e0b" />
        <StatBox title="Completed" value={data.completedTasks?.toLocaleString()} icon={Award} color="#10b981" />
        <StatBox title="Pending" value={data.pendingTasks?.toLocaleString()} icon={Clock} color="#ef4444" />
        <StatBox title="Completion Rate" value={`${data.completionRatePercent || 0}%`} icon={TrendingUp} color="#3b82f6" />
        <StatBox title="Overdue Tasks" value={data.overdueTasksCount?.toLocaleString()} icon={Flame} color="#ef4444" />
        <StatBox title="Done Today/Week" value={`${data.completedToday || 0} / ${data.completedThisWeek || 0}`} icon={Calendar} color="#8b5cf6" />
      </div>
    </div>
  );
}

/* ============================================================================
 * 4. GALLERY DEEP DIVE VIEW
 * ============================================================================ */
function GalleryDeepDive({ data }: { data: GalleryAnalyticsData }) {
  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
        <StatBox title="Total Photos" value={data.totalPhotos?.toLocaleString()} icon={ImageIcon} color="#ec4899" />
        <StatBox title="Added This Month" value={data.photosThisMonth?.toLocaleString()} icon={Calendar} color="#3b82f6" />
        <StatBox title="Storage Used" value={`${((data.storageUsedBytes || 0) / (1024 * 1024)).toFixed(1)} MB`} icon={HardDrive} color="#8b5cf6" />
        <StatBox title="Favorites" value={data.favoritePhotosCount?.toLocaleString()} icon={Star} color="#f59e0b" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
        {data.mostPhotographedPerson && (
          <div style={{ background: "var(--card-bg, rgba(255,255,255,0.03))", padding: "1.25rem", borderRadius: "12px", border: "1px solid var(--border-color, rgba(255,255,255,0.06))" }}>
            <div style={{ color: "#ec4899", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.25rem" }}>Most Photographed Person</div>
            <div style={{ fontSize: "1.2rem", fontWeight: 700 }}>{data.mostPhotographedPerson.name}</div>
            <div style={{ opacity: 0.7, fontSize: "0.85rem" }}>{data.mostPhotographedPerson.count} photos</div>
          </div>
        )}
        {data.mostPhotographedLocation && (
          <div style={{ background: "var(--card-bg, rgba(255,255,255,0.03))", padding: "1.25rem", borderRadius: "12px", border: "1px solid var(--border-color, rgba(255,255,255,0.06))" }}>
            <div style={{ color: "#ef4444", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.25rem" }}>Top Photo Location</div>
            <div style={{ fontSize: "1.2rem", fontWeight: 700 }}>{data.mostPhotographedLocation.name}</div>
            <div style={{ opacity: 0.7, fontSize: "0.85rem" }}>{data.mostPhotographedLocation.count} photos</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================================
 * 5. MOVIES DEEP DIVE VIEW
 * ============================================================================ */
function MovieDeepDive({ data }: { data: MovieAnalyticsData }) {
  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
        <StatBox title="Movies Watched" value={data.moviesWatched?.toLocaleString()} icon={Film} color="#8b5cf6" />
        <StatBox title="Avg Rating" value={`${data.averageRating || 0} / 10`} icon={Star} color="#f59e0b" />
        <StatBox title="Watch Time" value={`${Math.round((data.totalRuntimeMinutes || 0) / 60)} hours`} icon={Clock} color="#3b82f6" />
      </div>
    </div>
  );
}

/* ============================================================================
 * 6. TV SHOWS DEEP DIVE VIEW
 * ============================================================================ */
function TvDeepDive({ data }: { data: TvAnalyticsData }) {
  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
        <StatBox title="Watching / Completed" value={`${data.showsWatching || 0} / ${data.showsCompleted || 0}`} icon={Tv} color="#06b6d4" />
        <StatBox title="Episodes Watched" value={data.episodesWatched?.toLocaleString()} icon={Film} color="#10b981" />
        <StatBox title="Runtime" value={`${Math.round((data.totalRuntimeMinutes || 0) / 60)} hrs`} icon={Clock} color="#3b82f6" />
      </div>
    </div>
  );
}

/* ============================================================================
 * 7. MUSIC DEEP DIVE VIEW
 * ============================================================================ */
function MusicDeepDive({ data }: { data: MusicAnalyticsData }) {
  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
        <StatBox title="Total Tracks" value={data.totalTracks?.toLocaleString()} icon={Music} color="#14b8a6" />
        <StatBox title="Artists / Albums" value={`${data.totalArtists || 0} / ${data.totalAlbums || 0}`} icon={Headphones} color="#8b5cf6" />
        <StatBox title="Listening Time" value={`${data.listeningHours || 0} hours`} icon={Clock} color="#f59e0b" />
      </div>
    </div>
  );
}

/* ============================================================================
 * 8. PEOPLE DEEP DIVE VIEW
 * ============================================================================ */
function PeopleDeepDive({ data }: { data: PeopleAnalyticsData }) {
  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
        <StatBox title="Total Contacts" value={data.totalPeople?.toLocaleString()} icon={Users} color="#eab308" />
        <StatBox title="Family / Friends" value={`${data.familyCount || 0} / ${data.friendsCount || 0}`} icon={Award} color="#10b981" />
        <StatBox title="Mentions in Journal" value={data.journalMentionsCount?.toLocaleString()} icon={BookOpen} color="#3b82f6" />
        <StatBox title="Photos Together" value={data.photosTogetherCount?.toLocaleString()} icon={ImageIcon} color="#ec4899" />
      </div>
    </div>
  );
}

/* ============================================================================
 * 9. LOCATIONS DEEP DIVE VIEW
 * ============================================================================ */
function LocationDeepDive({ data }: { data: LocationAnalyticsData }) {
  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
        <StatBox title="Places & Locations" value={data.placesCount?.toLocaleString()} icon={MapPin} color="#ef4444" />
        <StatBox title="Countries / Cities" value={`${data.countriesCount || 0} / ${data.citiesCount || 0}`} icon={Globe} color="#3b82f6" />
        <StatBox title="Journal Entries" value={data.journalEntriesCount?.toLocaleString()} icon={BookOpen} color="#10b981" />
        <StatBox title="Photos Uploaded" value={data.photosCount?.toLocaleString()} icon={ImageIcon} color="#ec4899" />
      </div>
    </div>
  );
}

/* ============================================================================
 * 10. TRIPS DEEP DIVE VIEW
 * ============================================================================ */
function TripDeepDive({ data }: { data: TripAnalyticsData }) {
  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
        <StatBox title="Total Trips" value={data.totalTrips?.toLocaleString()} icon={Compass} color="#6366f1" />
        <StatBox title="Travel Days" value={`${data.totalTravelDays || 0} days`} icon={Calendar} color="#f59e0b" />
        <StatBox title="Countries Visited" value={data.countriesVisitedCount?.toLocaleString()} icon={Globe} color="#3b82f6" />
        <StatBox title="Avg Duration" value={`${data.averageDurationDays || 0} days`} icon={Clock} color="#10b981" />
      </div>
    </div>
  );
}

/* ============================================================================
 * HELPER UI COMPONENTS
 * ============================================================================ */
function StatBox({
  title,
  value,
  subtext,
  icon: Icon,
  color,
}: {
  title: string;
  value?: string | number;
  subtext?: string;
  icon: any;
  color: string;
}) {
  return (
    <div
      style={{
        background: "var(--card-bg, rgba(255,255,255,0.03))",
        padding: "1.25rem",
        borderRadius: "12px",
        border: "1px solid var(--border-color, rgba(255,255,255,0.06))",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
        <span style={{ fontSize: "0.8rem", opacity: 0.7, fontWeight: 600 }}>{title}</span>
        <Icon size={18} style={{ color }} />
      </div>
      <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{value ?? 0}</div>
      {subtext && <div style={{ fontSize: "0.75rem", opacity: 0.6, marginTop: "0.2rem" }}>{subtext}</div>}
    </div>
  );
}

function TagCloudSection({ title, tags, icon: Icon, color }: { title: string; tags: Array<{ tag: string; count: number }>; icon: any; color: string }) {
  return (
    <div
      style={{
        background: "var(--card-bg, rgba(255,255,255,0.03))",
        padding: "1.25rem",
        borderRadius: "12px",
        border: "1px solid var(--border-color, rgba(255,255,255,0.06))",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
        <Icon size={18} style={{ color }} />
        <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>{title}</h3>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
        {tags.map((t) => (
          <span
            key={t.tag}
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid var(--border-color, rgba(255,255,255,0.1))",
              padding: "0.35rem 0.75rem",
              borderRadius: "20px",
              fontSize: "0.85rem",
            }}
          >
            #{t.tag} <strong style={{ color: "var(--accent-color, #ff6600)" }}>({t.count})</strong>
          </span>
        ))}
      </div>
    </div>
  );
}
