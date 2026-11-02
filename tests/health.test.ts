import { describe, it, expect } from "vitest";
import {
  calculateWeekNumber,
  calculateStreakAndAdherence,
  shiftDateIso,
  formatDateIso,
} from "../src/features/health/analytics";
import type { HealthTreatmentLogRecord } from "../src/db/schema";

describe("Health & Hair Regrowth Analytics", () => {
  describe("calculateWeekNumber", () => {
    it("returns week 1 for the baseline date itself", () => {
      expect(calculateWeekNumber("2026-10-01", "2026-10-01")).toBe(1);
    });

    it("returns week 1 for any day within the first 7 days", () => {
      expect(calculateWeekNumber("2026-10-01", "2026-10-06")).toBe(1);
      expect(calculateWeekNumber("2026-10-01", "2026-10-07")).toBe(1);
    });

    it("returns week 2 starting on day 8", () => {
      expect(calculateWeekNumber("2026-10-01", "2026-10-08")).toBe(2);
      expect(calculateWeekNumber("2026-10-01", "2026-10-14")).toBe(2);
    });

    it("computes later weeks accurately", () => {
      // 12 weeks = 84 days
      expect(calculateWeekNumber("2026-01-01", "2026-03-26")).toBe(13);
    });

    it("guards against target dates before baseline", () => {
      expect(calculateWeekNumber("2026-10-01", "2026-09-25")).toBe(1);
    });

    it("handles empty baseline date gracefully", () => {
      expect(calculateWeekNumber("")).toBe(1);
    });
  });

  describe("shiftDateIso & formatDateIso", () => {
    it("shifts dates forwards and backwards correctly", () => {
      expect(shiftDateIso("2026-10-10", 1)).toBe("2026-10-11");
      expect(shiftDateIso("2026-10-10", -1)).toBe("2026-10-09");
      expect(shiftDateIso("2026-10-01", -1)).toBe("2026-09-30");
    });
  });

  describe("calculateStreakAndAdherence", () => {
    const makeLog = (
      logDate: string,
      completedDoses: number,
      treatmentId = "t1",
      userId = "superadmin",
      username = "admin"
    ): HealthTreatmentLogRecord => ({
      id: `log_${logDate}_${userId}`,
      profileId: "p1",
      treatmentId,
      userId,
      username,
      logDate,
      completedDoses,
      createdAt: "2026-10-01T00:00:00Z",
      updatedAt: "2026-10-01T00:00:00Z",
    });

    it("calculates active streak for 1x daily treatment when today is compliant", () => {
      const today = "2026-10-15";
      const logs = [
        makeLog("2026-10-13", 1),
        makeLog("2026-10-14", 1),
        makeLog("2026-10-15", 1),
      ];

      const stats = calculateStreakAndAdherence({
        treatmentId: "t1",
        timesPerDay: 1,
        startDate: "2026-10-01",
        logs,
        asOfDate: today,
      });

      expect(stats.currentStreak).toBe(3);
      expect(stats.longestStreak).toBe(3);
      expect(stats.isTodayCompliant).toBe(true);
      expect(stats.todayCompletedDoses).toBe(1);
    });

    it("preserves yesterday's streak if today is still in progress (0 doses applied today)", () => {
      const today = "2026-10-15";
      const logs = [
        makeLog("2026-10-13", 1),
        makeLog("2026-10-14", 1),
        makeLog("2026-10-15", 0),
      ];

      const stats = calculateStreakAndAdherence({
        treatmentId: "t1",
        timesPerDay: 1,
        startDate: "2026-10-01",
        logs,
        asOfDate: today,
      });

      // Yesterday was compliant, so streak is active at 2 (today hasn't broken it yet)
      expect(stats.currentStreak).toBe(2);
      expect(stats.isTodayCompliant).toBe(false);
      expect(stats.todayCompletedDoses).toBe(0);
    });

    it("resets current streak to 0 if yesterday was also missed", () => {
      const today = "2026-10-15";
      const logs = [
        makeLog("2026-10-10", 1),
        makeLog("2026-10-11", 1),
        makeLog("2026-10-12", 1),
        // Missed Oct 13 and 14
        makeLog("2026-10-15", 0),
      ];

      const stats = calculateStreakAndAdherence({
        treatmentId: "t1",
        timesPerDay: 1,
        startDate: "2026-10-01",
        logs,
        asOfDate: today,
      });

      expect(stats.currentStreak).toBe(0);
      expect(stats.longestStreak).toBe(3); // Oct 10, 11, 12
    });

    it("tracks multi-dose requirements (e.g. Minoxidil 2x daily AM/PM)", () => {
      const today = "2026-10-15";
      const logs = [
        makeLog("2026-10-13", 2),
        makeLog("2026-10-14", 2),
        makeLog("2026-10-15", 1), // Only 1 dose taken so far today
      ];

      const stats = calculateStreakAndAdherence({
        treatmentId: "t1",
        timesPerDay: 2,
        startDate: "2026-10-01",
        logs,
        asOfDate: today,
      });

      expect(stats.isTodayCompliant).toBe(false);
      expect(stats.todayCompletedDoses).toBe(1);
      // Streak continues from yesterday (2 consecutive compliant days)
      expect(stats.currentStreak).toBe(2);
    });

    it("marks today as compliant when all required doses (e.g. 2 of 2) are completed", () => {
      const today = "2026-10-15";
      const logs = [
        makeLog("2026-10-13", 2),
        makeLog("2026-10-14", 2),
        makeLog("2026-10-15", 2), // Both doses taken
      ];

      const stats = calculateStreakAndAdherence({
        treatmentId: "t1",
        timesPerDay: 2,
        startDate: "2026-10-01",
        logs,
        asOfDate: today,
      });

      expect(stats.isTodayCompliant).toBe(true);
      expect(stats.todayCompletedDoses).toBe(2);
      expect(stats.currentStreak).toBe(3);
    });

    it("computes 30-day rolling adherence rate percentage accurately", () => {
      const today = "2026-10-30";
      const startDate = "2026-10-01"; // 30 days total (Oct 1 to Oct 30)

      // 15 days compliant out of 30 days
      const logs: HealthTreatmentLogRecord[] = [];
      for (let i = 1; i <= 15; i++) {
        const d = `2026-10-${String(i).padStart(2, "0")}`;
        logs.push(makeLog(d, 1));
      }

      const stats = calculateStreakAndAdherence({
        treatmentId: "t1",
        timesPerDay: 1,
        startDate,
        logs,
        asOfDate: today,
      });

      expect(stats.adherenceRate30d).toBe(50);
      expect(stats.totalCompliantDays).toBe(15);
      expect(stats.totalElapsedDays).toBe(30);
    });

    it("computes distinct streaks for multiple collaborators on the same shared treatment", () => {
      const today = "2026-10-15";
      const adminId = "superadmin";
      const samId = "uuid_sam";

      // Super Admin logged on Oct 14 and Oct 15 (2-day streak)
      // Sam only logged on Oct 15 (1-day streak)
      const logs = [
        makeLog("2026-10-14", 1, "treatment_minox", adminId, "admin"),
        makeLog("2026-10-15", 1, "treatment_minox", adminId, "admin"),
        makeLog("2026-10-15", 1, "treatment_minox", samId, "sam"),
      ];

      // Admin stats
      const adminStats = calculateStreakAndAdherence({
        treatmentId: "treatment_minox",
        timesPerDay: 1,
        startDate: "2026-10-01",
        logs,
        targetUserId: adminId,
        asOfDate: today,
      });

      // Sam stats
      const samStats = calculateStreakAndAdherence({
        treatmentId: "treatment_minox",
        timesPerDay: 1,
        startDate: "2026-10-01",
        logs,
        targetUserId: samId,
        asOfDate: today,
      });

      // Super Admin has a 2-day streak
      expect(adminStats.currentStreak).toBe(2);
      expect(adminStats.longestStreak).toBe(2);
      expect(adminStats.isTodayCompliant).toBe(true);

      // Sam has a 1-day streak
      expect(samStats.currentStreak).toBe(1);
      expect(samStats.longestStreak).toBe(1);
      expect(samStats.isTodayCompliant).toBe(true);
    });
  });

  describe("Collaborator Permissions & Metadata Protection (Option B)", () => {
    interface TestProfile {
      id: string;
      userId: string;
      creatorUsername: string;
      name: string;
      visibility: "private" | "public";
      baselineDate: string;
      notes?: string;
    }

    interface TestCollaborator {
      id: string;
      profileId: string;
      userId: string;
      username: string;
    }

    const testProfile: TestProfile = {
      id: "hp_shared_1",
      userId: "user_owner",
      creatorUsername: "admin",
      name: "Hair Regrowth Protocol",
      visibility: "public",
      baselineDate: "2026-09-01",
      notes: "Baseline notes",
    };

    const collaborators: TestCollaborator[] = [
      {
        id: "collab_1",
        profileId: "hp_shared_1",
        userId: "uuid_sam",
        username: "sam",
      },
    ];

    function canModifyProfileMetadata(
      profile: TestProfile,
      collabs: TestCollaborator[],
      actor: { role: string; userId: string }
    ): boolean {
      // Only profile owner or superadmin can modify metadata
      return actor.role === "superadmin" || actor.userId === profile.userId;
    }

    function canModifyTreatments(
      profile: TestProfile,
      collabs: TestCollaborator[],
      actor: { role: string; userId: string }
    ): boolean {
      // Collaborators CANNOT add, edit, or delete treatments
      return actor.role === "superadmin" || actor.userId === profile.userId;
    }

    function canLogDoseForParticipant(
      profile: TestProfile,
      collabs: TestCollaborator[],
      actor: { role: string; userId: string },
      targetUserId: string
    ): boolean {
      // Superadmin can log for any participant; collaborators can only log for themselves
      if (actor.role === "superadmin") return true;
      return actor.userId === targetUserId;
    }

    it("forbids collaborator Sam from editing profile metadata, name, privacy, or start date", () => {
      const samActor = { role: "user", userId: "uuid_sam" };
      expect(canModifyProfileMetadata(testProfile, collaborators, samActor)).toBe(false);
    });

    it("forbids collaborator Sam from adding or deleting treatments", () => {
      const samActor = { role: "user", userId: "uuid_sam" };
      expect(canModifyTreatments(testProfile, collaborators, samActor)).toBe(false);
    });

    it("permits profile owner and Super Admin to edit metadata and treatments", () => {
      const ownerActor = { role: "user", userId: "user_owner" };
      const adminActor = { role: "superadmin", userId: "superadmin" };

      expect(canModifyProfileMetadata(testProfile, collaborators, ownerActor)).toBe(true);
      expect(canModifyProfileMetadata(testProfile, collaborators, adminActor)).toBe(true);

      expect(canModifyTreatments(testProfile, collaborators, ownerActor)).toBe(true);
      expect(canModifyTreatments(testProfile, collaborators, adminActor)).toBe(true);
    });

    it("permits collaborator Sam to log doses for himself, but forbids him from logging for Super Admin", () => {
      const samActor = { role: "user", userId: "uuid_sam" };

      // Sam logging for himself
      expect(canLogDoseForParticipant(testProfile, collaborators, samActor, "uuid_sam")).toBe(true);

      // Sam trying to log for Super Admin
      expect(canLogDoseForParticipant(testProfile, collaborators, samActor, "user_owner")).toBe(false);
    });

    it("permits Super Admin to log doses for any collaborator", () => {
      const adminActor = { role: "superadmin", userId: "superadmin" };

      // Super Admin logging for himself
      expect(canLogDoseForParticipant(testProfile, collaborators, adminActor, "superadmin")).toBe(true);

      // Super Admin logging for Sam
      expect(canLogDoseForParticipant(testProfile, collaborators, adminActor, "uuid_sam")).toBe(true);
    });
  });

  describe("Multi-User Profile Visibility Rules", () => {
    interface TestProfile {
      id: string;
      userId: string;
      name: string;
      visibility: "private" | "public";
    }

    const profiles: TestProfile[] = [
      { id: "p1", userId: "superadmin", name: "Admin Private", visibility: "private" },
      { id: "p2", userId: "superadmin", name: "Admin Public", visibility: "public" },
      { id: "p3", userId: "user-bob", name: "Bob Private", visibility: "private" },
      { id: "p4", userId: "user-bob", name: "Bob Public", visibility: "public" },
    ];

    function filterAccessibleProfiles(
      currentUser: { userId: string; role: "superadmin" | "user" },
      items: TestProfile[]
    ) {
      if (currentUser.role === "superadmin") {
        return items;
      }
      return items.filter(
        (p) => p.userId === currentUser.userId || p.visibility === "public"
      );
    }

    it("grants superadmin access to all profiles", () => {
      const result = filterAccessibleProfiles(
        { userId: "superadmin", role: "superadmin" },
        profiles
      );
      expect(result).toHaveLength(4);
    });

    it("restricts regular user from seeing other users private profiles", () => {
      const bobUser = { userId: "user-bob", role: "user" as const };
      const bobAccessible = filterAccessibleProfiles(bobUser, profiles);

      expect(bobAccessible.map((p) => p.name)).toEqual([
        "Admin Public",
        "Bob Private",
        "Bob Public",
      ]);
      expect(bobAccessible.find((p) => p.name === "Admin Private")).toBeUndefined();
    });

    it("allows a third user to only see public profiles", () => {
      const aliceUser = { userId: "user-alice", role: "user" as const };
      const aliceAccessible = filterAccessibleProfiles(aliceUser, profiles);

      expect(aliceAccessible.map((p) => p.name)).toEqual([
        "Admin Public",
        "Bob Public",
      ]);
    });
  });
});
