import type {
  HealthProfileRecord,
  HealthProfileCollaboratorRecord,
  HealthTreatmentRecord,
  HealthTreatmentLogRecord,
  HealthPhotoSessionRecord,
  HealthScalpPhotoRecord,
} from "@/db/schema";

export type ScalpPhotoAngle =
  | "crown"
  | "hairline"
  | "left_temple"
  | "right_temple"
  | "vertex"
  | "top"
  | "overall";

export const SCALP_ANGLES: { value: ScalpPhotoAngle; label: string }[] = [
  { value: "crown", label: "Crown / Vertex" },
  { value: "hairline", label: "Hairline (Front)" },
  { value: "left_temple", label: "Left Temple" },
  { value: "right_temple", label: "Right Temple" },
  { value: "vertex", label: "Vertex" },
  { value: "top", label: "Top / Mid-Scalp" },
  { value: "overall", label: "Overall Scalp" },
];

export interface TreatmentStreakAndAdherence {
  treatmentId: string;
  currentStreak: number;
  longestStreak: number;
  adherenceRate30d: number; // percentage (0 - 100)
  totalCompliantDays: number;
  totalElapsedDays: number;
  todayCompletedDoses: number;
  timesPerDay: number;
  isTodayCompliant: boolean;
}

export interface PhotoSessionWithPhotos extends HealthPhotoSessionRecord {
  profileName?: string;
  creatorUsername?: string;
  photos: HealthScalpPhotoRecord[];
}

export interface HealthProfileSummary {
  id: string;
  userId: string;
  creatorUsername: string;
  name: string;
  visibility: "private" | "public";
  baselineDate: string;
  notes?: string | null;
  createdAt: string;
  isOwner: boolean;
  isCollaborator: boolean;
  canEdit: boolean;
  collaboratorsCount: number;
}

export interface ParticipantSummary {
  userId: string;
  username: string;
  isOwner: boolean;
  isCurrentUser: boolean;
  canLog: boolean;
  treatments: (HealthTreatmentRecord & { stats: TreatmentStreakAndAdherence })[];
  latestPhoto?: HealthScalpPhotoRecord | null;
  latestPhotoWeek?: number;
}

export interface DualCompanionProfile {
  profile: HealthProfileSummary;
  treatments: (HealthTreatmentRecord & { stats: TreatmentStreakAndAdherence })[];
  latestPhoto?: HealthScalpPhotoRecord | null;
  latestPhotoWeek?: number;
  canLogDoses: boolean;
}

export interface HealthHubData {
  profiles: HealthProfileSummary[];
  companionProfiles: DualCompanionProfile[];
  activeProfile: HealthProfileRecord | null;
  isOwner: boolean;
  isCollaborator: boolean;
  canEdit: boolean;
  collaborators: HealthProfileCollaboratorRecord[];
  participants: ParticipantSummary[];
  treatments: (HealthTreatmentRecord & { stats: TreatmentStreakAndAdherence })[];
  recentLogs: HealthTreatmentLogRecord[];
  photoSessions: PhotoSessionWithPhotos[];
  allPhotoSessions: PhotoSessionWithPhotos[];
  weeksElapsed: number;
  currentUsername: string;
  currentUserId: string;
  isSuperAdmin: boolean;
}
