export type TimeFilterRange =
  | "today"
  | "yesterday"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "this_year"
  | "last_year"
  | "lifetime"
  | "custom";

export interface CustomDateRange {
  startDate?: string;
  endDate?: string;
}

export type SupportedModule =
  | "journal"
  | "microblog"
  | "todos"
  | "gallery"
  | "movies"
  | "tv"
  | "music"
  | "people"
  | "locations"
  | "trips";

export interface MemoryIndexWeights {
  richnessWeight: number;
  diversityWeight: number;
  longevityWeight: number;
  recurrenceWeight: number;
  recencyWeight: number;
  favoriteBonusWeight: number;
  pinnedBonusWeight: number;
}

export interface MemoryScoreBreakdown {
  entityType: string;
  entityId: string;
  title: string;
  slug: string;
  richnessScore: number;
  diversityScore: number;
  longevityScore: number;
  recurrenceScore: number;
  recencyScore: number;
  favoriteBonus: number;
  pinnedBonus: number;
  finalScore: number;
  isPinned: boolean;
  metadata?: Record<string, any>;
  updatedAt: string;
}

export interface TimelineCacheItem {
  id: string;
  date: string;
  type: string;
  title: string;
  entityType: string;
  entityId: string;
  relatedPeople: string[];
  relatedLocationId?: string | null;
  relatedTripId?: string | null;
  relatedJournalId?: string | null;
  thumbnailUrl?: string | null;
  importanceScore: number;
  updatedAt: string;
}

export interface RelationshipGraphItem {
  id: string;
  sourceType: string;
  sourceId: string;
  targetType: string;
  targetId: string;
  relationship: string;
  weight: number;
  metadata?: Record<string, any>;
  updatedAt: string;
}

export interface AnalyticsSnapshotDTO {
  id: string;
  snapshotType: "daily" | "monthly" | "yearly";
  periodKey: string;
  data: Record<string, any>;
  createdAt: string;
}

export interface GlobalOverviewStats {
  totalJournalEntries: number;
  totalMicroblogs: number;
  totalTodos: number;
  totalPhotos: number;
  totalMovies: number;
  totalTvShows: number;
  totalMusicItems: number;
  totalPeople: number;
  totalLocations: number;
  totalTrips: number;
  journalStreak: number;
  longestJournalStreak: number;
  mostActiveModule: string;
  databaseSizeBytes: number;
  storageUsedBytes: number;
  recentActivityCount: number;
  syncStatus: string;
  updatedAt: string;
}

export interface JournalAnalyticsData {
  totalEntries: number;
  wordsWritten: number;
  charactersWritten: number;
  averageEntryLengthWords: number;
  longestEntry: { id: string; title: string; wordCount: number } | null;
  shortestEntry: { id: string; title: string; wordCount: number } | null;
  streakDays: number;
  longestStreakDays: number;
  entriesByMonth: Array<{ month: string; count: number }>;
  entriesByWeekday: Array<{ day: string; count: number }>;
  entriesByHour: Array<{ hour: number; count: number }>;
  moodDistribution: Array<{ mood: string; count: number }>;
  writingCalendar: Array<{ date: string; count: number; wordCount: number }>;
  inlineImagesCount: number;
  attachmentsCount: number;
  mostUsedTags: Array<{ tag: string; count: number }>;
  mostMentionedPeople: Array<{ id: string; name: string; count: number }>;
  mostMentionedLocations: Array<{ id: string; name: string; count: number }>;
  mostMentionedTrips: Array<{ id: string; name: string; count: number }>;
}

export interface MicroblogAnalyticsData {
  totalPosts: number;
  draftsCount: number;
  publishedCount: number;
  averageLengthChars: number;
  postingFrequencyPerWeek: number;
  postsByMonth: Array<{ month: string; count: number }>;
  postsByWeekday: Array<{ day: string; count: number }>;
  postsByHour: Array<{ hour: number; count: number }>;
  imagePostsCount: number;
  blueskySyncCount: number;
  mastodonSyncCount: number;
  mostUsedTags: Array<{ tag: string; count: number }>;
}

export interface TodoAnalyticsData {
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  completionRatePercent: number;
  averageCompletionTimeHours: number;
  tasksByPriority: Array<{ priority: string; count: number }>;
  tasksByTag: Array<{ tag: string; count: number }>;
  tasksByProject: Array<{ project: string; count: number }>;
  overdueTasksCount: number;
  completedToday: number;
  completedThisWeek: number;
  completedThisMonth: number;
}

export interface GalleryAnalyticsData {
  totalPhotos: number;
  photosThisMonth: number;
  storageUsedBytes: number;
  averageFileSizeBytes: number;
  photosByLocation: Array<{ locationId: string; name: string; count: number }>;
  photosByPerson: Array<{ personId: string; name: string; count: number }>;
  photosByTrip: Array<{ tripId: string; name: string; count: number }>;
  mostPhotographedPerson: { id: string; name: string; count: number } | null;
  mostPhotographedLocation: { id: string; name: string; count: number } | null;
  favoritePhotosCount: number;
}

export interface MovieAnalyticsData {
  moviesWatched: number;
  averageRating: number;
  totalRuntimeMinutes: number;
  moviesByGenre: Array<{ genre: string; count: number }>;
  moviesByYear: Array<{ year: number; count: number }>;
  moviesByLanguage: Array<{ language: string; count: number }>;
  moviesByCountry: Array<{ country: string; count: number }>;
  watchCalendar: Array<{ date: string; count: number }>;
  monthlyTrend: Array<{ month: string; count: number }>;
}

export interface TvAnalyticsData {
  showsWatching: number;
  showsCompleted: number;
  episodesWatched: number;
  totalRuntimeMinutes: number;
  genres: Array<{ genre: string; count: number }>;
  platforms: Array<{ platform: string; count: number }>;
  averageRating: number;
  monthlyTrend: Array<{ month: string; count: number }>;
}

export interface MusicAnalyticsData {
  totalArtists: number;
  totalAlbums: number;
  totalTracks: number;
  listeningHours: number;
  topArtists: Array<{ name: string; playCount: number }>;
  topAlbums: Array<{ name: string; artist: string; playCount: number }>;
  topTracks: Array<{ name: string; artist: string; playCount: number }>;
  genres: Array<{ genre: string; count: number }>;
  listeningCalendar: Array<{ date: string; count: number }>;
  listeningHeatmap: Array<{ day: string; hour: number; count: number }>;
  monthlyTrend: Array<{ month: string; count: number }>;
}

export interface PeopleAnalyticsData {
  totalPeople: number;
  familyCount: number;
  friendsCount: number;
  colleaguesCount: number;
  journalMentionsCount: number;
  photosTogetherCount: number;
  tripsTogetherCount: number;
  sharedLocationsCount: number;
  recentInteractions: Array<{ personId: string; name: string; lastInteraction: string }>;
}

export interface LocationAnalyticsData {
  countriesCount: number;
  statesCount: number;
  citiesCount: number;
  placesCount: number;
  journalEntriesCount: number;
  photosCount: number;
  tripsCount: number;
  peopleCount: number;
  totalVisitCount: number;
  mostVisitedLocations: Array<{ id: string; name: string; visitCount: number }>;
}

export interface TripAnalyticsData {
  totalTrips: number;
  totalTravelDays: number;
  countriesVisitedCount: number;
  citiesVisitedCount: number;
  photosCount: number;
  journalEntriesCount: number;
  peopleConnectedCount: number;
  locationsConnectedCount: number;
  averageDurationDays: number;
  longestTrip: { id: string; title: string; days: number } | null;
  shortestTrip: { id: string; title: string; days: number } | null;
}

export interface AnalyticsProvider {
  name: SupportedModule;
  computeAnalytics: (timeFilter?: TimeFilterRange, customRange?: CustomDateRange) => Promise<any>;
}
