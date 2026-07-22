import { google, drive_v3 } from "googleapis";
import { randomUUID } from "node:crypto";
import { BaseService } from "@/services/base-service";
import { getMockDriveFiles } from "@/lib/google/google-fallback";
import { createGoogleWorkspaceClients, serializeGoogleRequest, withGoogleRetry } from "@/lib/google/google-client";
import type { GoogleDriveFileItem, GoogleWorkspaceServiceResult } from "@/types/google-workspace";
import type { NextRequest } from "next/server";

function mapDriveFile(file: drive_v3.Schema$File): GoogleDriveFileItem {
  return {
    id: file.id ?? randomUUID(),
    name: file.name ?? "(untitled file)",
    mimeType: file.mimeType ?? "application/octet-stream",
    url: file.webViewLink ?? null,
    modifiedTime: file.modifiedTime ?? new Date().toISOString(),
    owners: (file.owners ?? []).map((owner) => owner.displayName ?? owner.emailAddress ?? "unknown"),
    sizeBytes: file.size ? Number(file.size) : null,
  };
}

export class DriveService extends BaseService {
  constructor() {
    super("/api/google/drive");
  }

  async retrieveDriveFiles(request?: NextRequest, maxResults = 10): Promise<GoogleWorkspaceServiceResult<GoogleDriveFileItem>> {
    const authState = await createGoogleWorkspaceClients(request);
    if (authState.kind === "mock") {
      return {
        status: "success",
        data: {
          source: "mock",
          items: getMockDriveFiles().slice(0, maxResults),
        },
      };
    }
    if (authState.kind === "unavailable") {
      return {
        status: "success",
        data: {
          source: "unavailable",
          items: [],
        },
      };
    }

    const drive = google.drive({ version: "v3", auth: authState.oauthClient });

    return serializeGoogleRequest("drive", async () => {
      try {
        const response = await withGoogleRetry(() =>
          drive.files.list({
            pageSize: maxResults,
            orderBy: "modifiedTime desc",
            fields: "files(id,name,mimeType,webViewLink,modifiedTime,owners(displayName,emailAddress),size)",
            q: "trashed = false",
          }),
        );

        return {
          status: "success",
          data: {
            source: "live",
            items: (response.data.files ?? []).map(mapDriveFile),
          },
        };
      } catch {
        if (process.env.NODE_ENV !== "production") {
          return {
            status: "success",
            data: {
              source: "mock",
              items: getMockDriveFiles().slice(0, maxResults),
            },
          };
        }

        return {
          status: "success",
          data: {
            source: "unavailable",
            items: [],
          },
        };
      }
    });
  }
}

export const driveService = new DriveService();
