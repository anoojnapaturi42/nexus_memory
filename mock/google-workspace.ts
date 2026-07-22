import type {
  GoogleCalendarEventItem,
  GoogleDocMetadataItem,
  GoogleDriveFileItem,
  GoogleEmailItem,
} from "@/types/google-workspace";

const now = Date.now();

function minutesAgo(minutes: number) {
  return new Date(now - minutes * 60_000).toISOString();
}

export const mockGoogleEmails: GoogleEmailItem[] = [
  {
    id: "email-1",
    threadId: "thread-1",
    subject: "google interview prep checklist",
    snippet: "sharing the prep checklist and study plan milestones for next week.",
    sender: "Raj <raj@example.com>",
    receivedAt: minutesAgo(12),
    labelIds: ["INBOX", "IMPORTANT"],
    isUnread: true,
  },
  {
    id: "email-2",
    threadId: "thread-2",
    subject: "updated resume draft",
    snippet: "attached the newest resume version with the revised systems design bullet points.",
    sender: "mentor@example.com",
    receivedAt: minutesAgo(48),
    labelIds: ["INBOX"],
    isUnread: false,
  },
];

export const mockGoogleCalendarEvents: GoogleCalendarEventItem[] = [
  {
    id: "event-1",
    title: "mock interview",
    description: "practice interview with feedback",
    startTime: minutesAgo(-90),
    endTime: minutesAgo(-30),
    attendees: ["Raj", "mentor@example.com"],
    location: "google meet",
    source: "google calendar",
  },
  {
    id: "event-2",
    title: "deep work block",
    description: "study plan execution block",
    startTime: minutesAgo(120),
    endTime: minutesAgo(60),
    attendees: ["Raj"],
    source: "google calendar",
  },
];

export const mockGoogleDriveFiles: GoogleDriveFileItem[] = [
  {
    id: "file-1",
    name: "resume.pdf",
    mimeType: "application/pdf",
    url: "https://drive.google.com/file/d/mock-resume",
    modifiedTime: minutesAgo(25),
    owners: ["Raj"],
    sizeBytes: 214_000,
  },
  {
    id: "file-2",
    name: "google interview prep notes",
    mimeType: "application/vnd.google-apps.document",
    url: "https://docs.google.com/document/d/mock-notes",
    modifiedTime: minutesAgo(64),
    owners: ["Raj"],
    sizeBytes: null,
  },
];

export const mockGoogleDocs: GoogleDocMetadataItem[] = [
  {
    id: "doc-1",
    name: "august interview timeline",
    mimeType: "application/vnd.google-apps.document",
    modifiedTime: minutesAgo(15),
    owner: "Raj",
    url: "https://docs.google.com/document/d/mock-timeline",
    wordCount: 1840,
  },
  {
    id: "doc-2",
    name: "study plan v2",
    mimeType: "application/vnd.google-apps.document",
    modifiedTime: minutesAgo(38),
    owner: "Raj",
    url: "https://docs.google.com/document/d/mock-study-plan",
    wordCount: 1320,
  },
];
