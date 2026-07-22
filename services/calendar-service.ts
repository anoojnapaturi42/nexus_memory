//fetches calendar data  
import { google, calendar_v3 } from "googleapis";
import { randomUUID } from "node:crypto";
import { BaseService } from "@/services/base-service";
import { getMockCalendarEvents } from "@/lib/google/google-fallback";
import { createGoogleWorkspaceClients, serializeGoogleRequest, withGoogleRetry } from "@/lib/google/google-client";
import type { GoogleCalendarEventItem, GoogleWorkspaceServiceResult } from "@/types/google-workspace";
import type { NextRequest } from "next/server";

function mapCalendarEvent(event: calendar_v3.Schema$Event): GoogleCalendarEventItem {
  return {
    id: event.id ?? randomUUID(),
    title: event.summary ?? "(untitled event)",
    description: event.description ?? "",
    startTime: event.start?.dateTime ?? event.start?.date ?? new Date().toISOString(),
    endTime: event.end?.dateTime ?? event.end?.date ?? new Date().toISOString(),
    attendees: (event.attendees ?? []).map((attendee) => attendee.email ?? "unknown"),
    location: event.location ?? null,
    source: "google calendar",
  };
}

export class CalendarService extends BaseService {
  constructor() {
    super("/api/google/calendar");
  }

  async fetchCalendarEvents(request?: NextRequest, maxResults = 10): Promise<GoogleWorkspaceServiceResult<GoogleCalendarEventItem>> {
    const authState = await createGoogleWorkspaceClients(request);
    if (authState.kind === "mock") {
      return {
        status: "success",
        data: {
          source: "mock",
          items: getMockCalendarEvents().slice(0, maxResults),
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

    const calendar = google.calendar({ version: "v3", auth: authState.oauthClient });

    return serializeGoogleRequest("calendar", async () => {
      try {
        const response = await withGoogleRetry(() =>
          calendar.events.list({
            calendarId: "primary",
            maxResults,
            singleEvents: true,
            orderBy: "startTime",
            timeMin: new Date().toISOString(),
          }),
        );

        const items = (response.data.items ?? []).map(mapCalendarEvent);
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
              items: getMockCalendarEvents().slice(0, maxResults),
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

export const calendarService = new CalendarService();
