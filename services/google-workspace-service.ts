import type { NextRequest } from "next/server";
import { calendarService } from "@/services/calendar-service";
import { docsService } from "@/services/docs-service";
import { driveService } from "@/services/drive-service";
import { gmailService } from "@/services/gmail-service";
import { googleWorkspaceSyncService } from "@/services/google/workspace-sync.service";
import type {
  GoogleCalendarEventItem,
  GoogleDocMetadataItem,
  GoogleDriveFileItem,
  GoogleEmailItem,
  GoogleWorkspaceServiceResult,
} from "@/types/google-workspace";
import type { GoogleWorkspaceSyncSnapshot } from "@/types/google-workspace-sync";

export class GoogleWorkspaceService {
  fetchLatestEmails(request?: NextRequest, maxResults = 10): Promise<GoogleWorkspaceServiceResult<GoogleEmailItem>> {
    return gmailService.fetchLatestEmails(request, maxResults);
  }

  fetchCalendarEvents(request?: NextRequest, maxResults = 10): Promise<GoogleWorkspaceServiceResult<GoogleCalendarEventItem>> {
    return calendarService.fetchCalendarEvents(request, maxResults);
  }

  retrieveDriveFiles(request?: NextRequest, maxResults = 10): Promise<GoogleWorkspaceServiceResult<GoogleDriveFileItem>> {
    return driveService.retrieveDriveFiles(request, maxResults);
  }

  fetchDocumentMetadata(request?: NextRequest, maxResults = 10): Promise<GoogleWorkspaceServiceResult<GoogleDocMetadataItem>> {
    return docsService.fetchDocumentMetadata(request, maxResults);
  }

  syncWorkspace(request?: NextRequest): Promise<GoogleWorkspaceSyncSnapshot> {
    return googleWorkspaceSyncService.syncWorkspace(request);
  }
}

export const googleWorkspaceService = new GoogleWorkspaceService();
