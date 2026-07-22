import type { ApiResponse } from "@/types/api";

export type GoogleWorkspaceServiceName = "gmail" | "calendar" | "drive" | "docs";

export type GoogleWorkspaceFetchState = "live" | "mock" | "unavailable";

export type GoogleEmailItem = {
  id: string;
  threadId: string;
  subject: string;
  snippet: string;
  sender: string;
  receivedAt: string;
  labelIds: string[];
  isUnread: boolean;
};

export type GoogleCalendarEventItem = {
  id: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  attendees: string[];
  location?: string | null;
  source: string;
};

export type GoogleDriveFileItem = {
  id: string;
  name: string;
  mimeType: string;
  url?: string | null;
  modifiedTime: string;
  owners: string[];
  sizeBytes?: number | null;
};

export type GoogleDocMetadataItem = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  owner: string;
  url?: string | null;
  wordCount?: number | null;
};

export type GoogleWorkspaceServiceResult<T> = ApiResponse<{
  source: GoogleWorkspaceFetchState;
  items: T[];
}>;
