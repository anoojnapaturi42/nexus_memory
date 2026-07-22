import type { NextRequest } from "next/server";
import { calendarService } from "@/services/calendar-service";
import { driveService } from "@/services/drive-service";
import { gmailService } from "@/services/gmail-service";
import { googleAuthService } from "@/services/google/auth.service";
import type {
  GoogleWorkspaceCalendarDTO,
  GoogleWorkspaceDriveDTO,
  GoogleWorkspaceEmailDTO,
  GoogleWorkspaceSyncSnapshot,
} from "@/types/google-workspace-sync";

function sortByRecent<T extends { timestamp?: string; startTime?: string; modifiedTime?: string }>(items: T[]) {
  return [...items].sort((left, right) => {
    const leftValue = Date.parse(left.timestamp ?? left.startTime ?? left.modifiedTime ?? "");
    const rightValue = Date.parse(right.timestamp ?? right.startTime ?? right.modifiedTime ?? "");
    return rightValue - leftValue;
  });
}

function pickLastSyncedAt(...collections: Array<Array<{ timestamp?: string; startTime?: string; modifiedTime?: string }>>) {
  const timestamps = collections
    .flat()
    .map((item) => item.timestamp ?? item.startTime ?? item.modifiedTime ?? null)
    .filter(Boolean) as string[];

  if (timestamps.length === 0) return null;
  return timestamps.sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? null;
}

function normalizeEmailItems(items: GoogleWorkspaceEmailDTO[]) {
  return sortByRecent(items).slice(0, 20);
}

function normalizeCalendarItems(items: GoogleWorkspaceCalendarDTO[]) {
  return sortByRecent(items).slice(0, 20);
}

function normalizeDriveItems(items: GoogleWorkspaceDriveDTO[]) {
  return sortByRecent(items).slice(0, 20);
}

export class GoogleWorkspaceSyncService {
  async syncWorkspace(request?: NextRequest): Promise<GoogleWorkspaceSyncSnapshot> {
    let authStatus;
    try {
      authStatus = await googleAuthService.getStatusFromSession(
        request?.cookies.get(googleAuthService.sessionCookieName)?.value ?? null,
      );
    } catch {
      return {
        source: "empty",
        connected: false,
        accountEmail: null,
        lastSyncedAt: null,
        emails: [],
        calendarEvents: [],
        driveFiles: [],
      };
    }

    if (!authStatus.connected) {
      return {
        source: "empty",
        connected: false,
        accountEmail: null,
        lastSyncedAt: null,
        emails: [],
        calendarEvents: [],
        driveFiles: [],
      };
    }

    try {
      const [emailsResult, calendarResult, driveResult] = await Promise.all([
        gmailService.fetchLatestEmails(request, 20),
        calendarService.fetchCalendarEvents(request, 20),
        driveService.retrieveDriveFiles(request, 20),
      ]);

      const sources = [emailsResult.data.source, calendarResult.data.source, driveResult.data.source];
      const liveSource = sources.includes("live") ? "live" : sources.includes("mock") ? "mock" : "empty";

      return {
        source: liveSource,
        connected: true,
        accountEmail: authStatus.accountEmail,
        lastSyncedAt: pickLastSyncedAt(emailsResult.data.items, calendarResult.data.items, driveResult.data.items),
        emails: normalizeEmailItems(
          emailsResult.data.items.map((item) => ({
            id: item.id,
            sender: item.sender,
            subject: item.subject,
            snippet: item.snippet,
            timestamp: item.receivedAt,
          })),
        ),
        calendarEvents: normalizeCalendarItems(
          calendarResult.data.items.map((item) => ({
            id: item.id,
            title: item.title,
            description: item.description,
            attendees: item.attendees,
            location: item.location,
            startTime: item.startTime,
            endTime: item.endTime,
          })),
        ),
        driveFiles: normalizeDriveItems(
          driveResult.data.items.map((item) => ({
            id: item.id,
            name: item.name,
            mimeType: item.mimeType,
            url: item.url ?? null,
            owners: item.owners,
            modifiedTime: item.modifiedTime,
          })),
        ),
      };
    } catch {
      return {
        source: "empty",
        connected: true,
        accountEmail: authStatus.accountEmail,
        lastSyncedAt: authStatus.lastSyncedAt,
        emails: [],
        calendarEvents: [],
        driveFiles: [],
      };
    }
  }
}

export const googleWorkspaceSyncService = new GoogleWorkspaceSyncService();
