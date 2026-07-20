import { db, ensureDbInitialized } from "@/db";
import { lastfmScrobbles, lastfmArtists, lastfmAlbums, lastfmTracks } from "@/db/schema";
import { AnalyticsProvider, MusicAnalyticsData, TimeFilterRange, CustomDateRange } from "../types";
import { getTimeFilterStartEnd } from "../config";

export const musicAnalyticsProvider: AnalyticsProvider = {
  name: "music",
  computeAnalytics: async (
    timeFilter?: TimeFilterRange,
    customRange?: CustomDateRange
  ): Promise<MusicAnalyticsData> => {
    await ensureDbInitialized();

    const [allScrobbles, allArtists, allAlbums, allTracks] = await Promise.all([
      db.select().from(lastfmScrobbles),
      db.select().from(lastfmArtists),
      db.select().from(lastfmAlbums),
      db.select().from(lastfmTracks),
    ]);

    let filteredScrobbles = allScrobbles;
    const { start, end } = getTimeFilterStartEnd(timeFilter, customRange);
    if (start || end) {
      filteredScrobbles = allScrobbles.filter((s) => {
        const d = new Date(s.playedAt);
        if (start && d < start) return false;
        if (end && d > end) return false;
        return true;
      });
    }

    const artistPlays: Record<string, number> = {};
    const albumPlays: Record<string, { artist: string; count: number }> = {};
    const trackPlays: Record<string, { artist: string; count: number }> = {};

    const monthCounts: Record<string, number> = {};
    const calendarMap: Record<string, number> = {};
    const heatmapMap: Record<string, number> = {};

    let totalDurationSec = 0;

    filteredScrobbles.forEach((s) => {
      totalDurationSec += s.duration || 210; // average 3.5 mins if missing

      artistPlays[s.artist] = (artistPlays[s.artist] || 0) + 1;

      if (s.album) {
        const key = `${s.artist} - ${s.album}`;
        if (!albumPlays[key]) albumPlays[key] = { artist: s.artist, count: 0 };
        albumPlays[key].count += 1;
      }

      const trKey = `${s.artist} - ${s.track}`;
      if (!trackPlays[trKey]) trackPlays[trKey] = { artist: s.artist, count: 0 };
      trackPlays[trKey].count += 1;

      const dateObj = new Date(s.playedAt);
      if (!isNaN(dateObj.getTime())) {
        const ym = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}`;
        monthCounts[ym] = (monthCounts[ym] || 0) + 1;

        const dateStr = dateObj.toISOString().split("T")[0];
        calendarMap[dateStr] = (calendarMap[dateStr] || 0) + 1;

        const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const dayName = dayNames[dateObj.getDay()];
        const hour = dateObj.getHours();
        const hmKey = `${dayName}_${hour}`;
        heatmapMap[hmKey] = (heatmapMap[hmKey] || 0) + 1;
      }
    });

    const topArtists = Object.entries(artistPlays)
      .map(([name, playCount]) => ({ name, playCount }))
      .sort((a, b) => b.playCount - a.playCount)
      .slice(0, 10);

    const topAlbums = Object.entries(albumPlays)
      .map(([key, val]) => ({ name: key, artist: val.artist, playCount: val.count }))
      .sort((a, b) => b.playCount - a.playCount)
      .slice(0, 10);

    const topTracks = Object.entries(trackPlays)
      .map(([key, val]) => ({ name: key, artist: val.artist, playCount: val.count }))
      .sort((a, b) => b.playCount - a.playCount)
      .slice(0, 10);

    const heatmapArray: Array<{ day: string; hour: number; count: number }> = [];
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    dayNames.forEach((day) => {
      for (let hour = 0; hour < 24; hour++) {
        const key = `${day}_${hour}`;
        heatmapArray.push({ day, hour, count: heatmapMap[key] || 0 });
      }
    });

    const isFiltered = !!timeFilter && timeFilter !== "lifetime";

    return {
      totalArtists: isFiltered ? Object.keys(artistPlays).length : (allArtists.length || Object.keys(artistPlays).length),
      totalAlbums: isFiltered ? Object.keys(albumPlays).length : (allAlbums.length || Object.keys(albumPlays).length),
      totalTracks: isFiltered ? Object.keys(trackPlays).length : (allTracks.length || Object.keys(trackPlays).length),
      listeningHours: Number((totalDurationSec / 3600).toFixed(1)),
      topArtists,
      topAlbums,
      topTracks,
      genres: [],
      listeningCalendar: Object.entries(calendarMap).map(([date, count]) => ({ date, count })),
      listeningHeatmap: heatmapArray,
      monthlyTrend: Object.entries(monthCounts).map(([month, count]) => ({ month, count })),
    };
  },
};
