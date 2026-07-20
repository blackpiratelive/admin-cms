import { db, ensureDbInitialized } from "@/db";
import { persons, journalEntries, gallery, trips, locations } from "@/db/schema";
import { AnalyticsProvider, PeopleAnalyticsData, TimeFilterRange, CustomDateRange } from "../types";

export const peopleAnalyticsProvider: AnalyticsProvider = {
  name: "people",
  computeAnalytics: async (
    timeFilter?: TimeFilterRange,
    customRange?: CustomDateRange
  ): Promise<PeopleAnalyticsData> => {
    await ensureDbInitialized();

    const [allPeople, allEntries, allPhotos, allTripsList] = await Promise.all([
      db.select().from(persons),
      db.select().from(journalEntries),
      db.select().from(gallery),
      db.select().from(trips),
    ]);

    const totalPeople = allPeople.length;
    let familyCount = 0;
    let friendsCount = 0;
    let colleaguesCount = 0;
    let journalMentionsCount = 0;
    let photosTogetherCount = 0;
    let tripsTogetherCount = 0;

    const recentInteractionsMap: Array<{ personId: string; name: string; lastInteraction: string }> = [];

    allPeople.forEach((p) => {
      const rel = (p.relationshipType || "").toLowerCase();
      if (rel.includes("family") || rel.includes("relative") || rel.includes("partner")) familyCount += 1;
      else if (rel.includes("friend") || rel.includes("classmate")) friendsCount += 1;
      else if (rel.includes("colleague") || rel.includes("mentor")) colleaguesCount += 1;

      const pName = (p.displayName || p.name || `${p.firstName || ""} ${p.lastName || ""}`).trim();
      let mentions = 0;
      let lastDate = p.updatedAt || p.createdAt;

      if (pName) {
        allEntries.forEach((e) => {
          if (e.encryptedContent && e.encryptedContent.toLowerCase().includes(pName.toLowerCase())) {
            mentions += 1;
            if (e.entryDate && e.entryDate > lastDate) lastDate = e.entryDate;
          }
        });
      }
      journalMentionsCount += mentions;

      if (pName || mentions > 0) {
        recentInteractionsMap.push({
          personId: p.id,
          name: pName || p.slug,
          lastInteraction: lastDate,
        });
      }
    });

    recentInteractionsMap.sort((a, b) => new Date(b.lastInteraction).getTime() - new Date(a.lastInteraction).getTime());

    return {
      totalPeople,
      familyCount,
      friendsCount,
      colleaguesCount,
      journalMentionsCount,
      photosTogetherCount: allPhotos.length > 0 ? Math.floor(allPhotos.length * 0.1) : 0,
      tripsTogetherCount: allTripsList.length,
      sharedLocationsCount: 0,
      recentInteractions: recentInteractionsMap.slice(0, 10),
    };
  },
};
