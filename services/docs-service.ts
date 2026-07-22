import { randomUUID } from "node:crypto";
import { BaseService } from "@/services/base-service";
import { getMockDocumentMetadata } from "@/lib/google/google-fallback";
import { createGoogleWorkspaceClients, serializeGoogleRequest, withGoogleRetry } from "@/lib/google/google-client";
import type { GoogleDocMetadataItem, GoogleWorkspaceServiceResult } from "@/types/google-workspace";
import type { NextRequest } from "next/server";

export class DocsService extends BaseService {
  constructor() {
    super("/api/google/docs");
  }

  async fetchDocumentMetadata(request?: NextRequest, maxResults = 10): Promise<GoogleWorkspaceServiceResult<GoogleDocMetadataItem>> {
    const authState = await createGoogleWorkspaceClients(request);
    if (authState.kind === "mock") {
      return {
        status: "success",
        data: {
          source: "mock",
          items: getMockDocumentMetadata().slice(0, maxResults),
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

    return serializeGoogleRequest("docs", async () => {
      try {
        // docs api does not offer a general list endpoint for all documents,
        // so this service intentionally falls back to metadata fetched from
        // a curated set of docs surfaced through drive integrations.
        const response = await withGoogleRetry(async () => {
          const filesResponse = await authState.oauthClient.request<{
            files?: Array<{ id?: string; name?: string; modifiedTime?: string; owners?: Array<{ displayName?: string; emailAddress?: string }> }>;
          }>({
            url: "https://www.googleapis.com/drive/v3/files",
            method: "GET",
            params: {
              pageSize: maxResults,
              q: "mimeType = 'application/vnd.google-apps.document' and trashed = false",
              fields: "files(id,name,modifiedTime,owners(displayName,emailAddress))",
            },
          });
          return filesResponse.data.files ?? [];
        });

        const items = response.map((file) => ({
          id: file.id ?? randomUUID(),
          name: file.name ?? "(untitled document)",
          mimeType: "application/vnd.google-apps.document",
          modifiedTime: file.modifiedTime ?? new Date().toISOString(),
          owner: file.owners?.[0]?.displayName ?? file.owners?.[0]?.emailAddress ?? "unknown",
          url: file.id ? `https://docs.google.com/document/d/${file.id}` : null,
          wordCount: null,
        }));

        return {
          status: "success",
          data: {
            source: "live",
            items,
          },
        };
      } catch {
        if (process.env.NODE_ENV !== "production") {
          return {
            status: "success",
            data: {
              source: "mock",
              items: getMockDocumentMetadata().slice(0, maxResults),
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

export const docsService = new DocsService();
