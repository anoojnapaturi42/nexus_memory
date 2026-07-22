import type { GoogleCalendarEventItem, GoogleDriveFileItem, GoogleEmailItem } from "@/types/google-workspace";

export type GoogleWorkspaceSyncSource = "live" | "mock" | "empty";

export type GoogleWorkspaceEmailDTO = Pick<GoogleEmailItem, "id" | "sender" | "subject" | "snippet"> & {
  timestamp: string;
};

export type GoogleWorkspaceCalendarDTO = Pick<
  GoogleCalendarEventItem,
  "id" | "title" | "description" | "attendees" | "location"
> & {
  startTime: string;
  endTime: string;
};

export type GoogleWorkspaceDriveDTO = Pick<GoogleDriveFileItem, "id" | "name" | "mimeType" | "url" | "owners"> & {
  modifiedTime: string;
};

export type GoogleWorkspaceSyncSnapshot = {
  source: GoogleWorkspaceSyncSource;
  connected: boolean;
  accountEmail: string | null;
  lastSyncedAt: string | null;
  emails: GoogleWorkspaceEmailDTO[];
  calendarEvents: GoogleWorkspaceCalendarDTO[];
  driveFiles: GoogleWorkspaceDriveDTO[];
};
