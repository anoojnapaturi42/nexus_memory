import { google, gmail_v1 } from "googleapis";
import { randomUUID } from "node:crypto";
import { BaseService } from "@/services/base-service";
import { getMockLatestEmails } from "@/lib/google/google-fallback";
import { createGoogleWorkspaceClients, serializeGoogleRequest, withGoogleRetry } from "@/lib/google/google-client";
import type { GoogleEmailItem, GoogleWorkspaceServiceResult } from "@/types/google-workspace";
import type { NextRequest } from "next/server";

function mapGmailMessage(message: gmail_v1.Schema$Message): GoogleEmailItem {
  const headers = message.payload?.headers ?? [];
  const headerMap = new Map(headers.map((header) => [header.name?.toLowerCase() ?? "", header.value ?? ""]));

  return {
    id: message.id ?? randomUUID(),
    threadId: message.threadId ?? message.id ?? randomUUID(),
    subject: headerMap.get("subject") || "(no subject)",
    snippet: message.snippet ?? "",
    sender: headerMap.get("from") || "unknown sender",
    receivedAt: new Date(Number(message.internalDate ?? Date.now())).toISOString(),
    labelIds: message.labelIds ?? [],
    isUnread: !(message.labelIds ?? []).includes("UNREAD"),
  };
}

export class GmailService extends BaseService {
  constructor() {
    super("/api/google/gmail");
  }

  async fetchLatestEmails(request?: NextRequest, maxResults = 10): Promise<GoogleWorkspaceServiceResult<GoogleEmailItem>> {
    const authState = await createGoogleWorkspaceClients(request);
    if (authState.kind === "mock") {
      return {
        status: "success",
        data: {
          source: "mock",
          items: getMockLatestEmails().slice(0, maxResults),
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

    const gmail = google.gmail({ version: "v1", auth: authState.oauthClient });

    return serializeGoogleRequest("gmail", async () => {
      try {
        const messages = await withGoogleRetry(async () => {
          const response = await gmail.users.messages.list({
            userId: "me",
            maxResults,
            q: "newer_than:14d",
          });
          return response.data.messages ?? [];
        });

        const fetched = await withGoogleRetry(async () => {
          const detailed = await Promise.all(
            messages.map(async (message) => {
              const response = await gmail.users.messages.get({
                userId: "me",
                id: message.id ?? "",
                format: "metadata",
                metadataHeaders: ["Subject", "From"],
              });
              return response.data;
            }),
          );
          return detailed.map(mapGmailMessage);
        });

        return {
          status: "success",
          data: {
            source: "live",
            items: fetched,
          },
        };
      } catch {
        if (process.env.NODE_ENV !== "production") {
          return {
            status: "success",
            data: {
              source: "mock",
              items: getMockLatestEmails().slice(0, maxResults),
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

export const gmailService = new GmailService();
