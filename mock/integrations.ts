import type { IntegrationSeed } from "@/types/integration";

const now = new Date();

function minutesAgo(minutes: number) {
  return new Date(now.getTime() - minutes * 60_000).toISOString();
}

export const mockIntegrationSeeds: IntegrationSeed[] = [
  {
    provider: "gmail",
    label: "gmail",
    description: "email intelligence, deadline extraction, and thread context capture.",
    status: "connected",
    lastSyncedAt: minutesAgo(8),
    permissions: [
      { key: "mail.read", label: "read gmail messages", granted: true },
      { key: "mail.labels", label: "inspect labels and threads", granted: true },
      { key: "mail.send", label: "draft assistant replies", granted: false },
    ],
    syncEvents: [
      { id: "gmail-1", label: "scanned 128 new messages", timestamp: minutesAgo(8), state: "complete" },
      { id: "gmail-2", label: "captured 4 deadline signals", timestamp: minutesAgo(14), state: "complete" },
    ],
    activityScore: 0.94,
  },
  {
    provider: "calendar",
    label: "google calendar",
    description: "event tracking, schedule inference, and calendar block generation.",
    status: "connected",
    lastSyncedAt: minutesAgo(5),
    permissions: [
      { key: "calendar.read", label: "read calendars and events", granted: true },
      { key: "calendar.write", label: "create focus blocks", granted: true },
      { key: "calendar.share", label: "manage invite visibility", granted: false },
    ],
    syncEvents: [
      { id: "calendar-1", label: "updated 3 schedule blocks", timestamp: minutesAgo(5), state: "complete" },
      { id: "calendar-2", label: "resolved 1 double-booked slot", timestamp: minutesAgo(23), state: "warning" },
    ],
    activityScore: 0.88,
  },
  {
    provider: "drive",
    label: "google drive",
    description: "file discovery, document retrieval, and workspace memory indexing.",
    status: "syncing",
    lastSyncedAt: minutesAgo(31),
    permissions: [
      { key: "drive.read", label: "read drive files", granted: true },
      { key: "drive.metadata", label: "inspect file metadata", granted: true },
      { key: "drive.write", label: "write generated artifacts", granted: false },
    ],
    syncEvents: [
      { id: "drive-1", label: "indexed 21 files", timestamp: minutesAgo(31), state: "running" },
      { id: "drive-2", label: "queued 6 docs for memory extraction", timestamp: minutesAgo(29), state: "queued" },
    ],
    activityScore: 0.76,
  },
  {
    provider: "docs",
    label: "google docs",
    description: "document context capture for planning, briefs, and notes.",
    status: "disconnected",
    lastSyncedAt: null,
    permissions: [
      { key: "docs.read", label: "read documents", granted: true },
      { key: "docs.comments", label: "inspect comments and suggestions", granted: false },
      { key: "docs.write", label: "create summary drafts", granted: false },
    ],
    syncEvents: [
      { id: "docs-1", label: "awaiting connection", timestamp: minutesAgo(60), state: "warning" },
    ],
    activityScore: 0.42,
  },
  {
    provider: "meet",
    label: "google meet",
    description: "meeting summary capture and follow-up generation.",
    optional: true,
    status: "error",
    lastSyncedAt: minutesAgo(92),
    permissions: [
      { key: "meet.read", label: "read meetings metadata", granted: true },
      { key: "meet.transcripts", label: "inspect transcript context", granted: false },
      { key: "meet.recording", label: "capture recording assets", granted: false },
    ],
    syncEvents: [
      { id: "meet-1", label: "transcript import timed out", timestamp: minutesAgo(92), state: "warning" },
      { id: "meet-2", label: "retry scheduled", timestamp: minutesAgo(91), state: "queued" },
    ],
    activityScore: 0.29,
  },
];
