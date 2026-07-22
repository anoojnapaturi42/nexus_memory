import {
  mockGoogleCalendarEvents,
  mockGoogleDocs,
  mockGoogleDriveFiles,
  mockGoogleEmails,
} from "@/mock/google-workspace";
import type {
  GoogleCalendarEventItem,
  GoogleDocMetadataItem,
  GoogleDriveFileItem,
  GoogleEmailItem,
} from "@/types/google-workspace";

export function getMockLatestEmails(): GoogleEmailItem[] {
  return mockGoogleEmails;
}

export function getMockCalendarEvents(): GoogleCalendarEventItem[] {
  return mockGoogleCalendarEvents;
}

export function getMockDriveFiles(): GoogleDriveFileItem[] {
  return mockGoogleDriveFiles;
}

export function getMockDocumentMetadata(): GoogleDocMetadataItem[] {
  return mockGoogleDocs;
}
