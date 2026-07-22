"use client";

import { useCallback, useMemo } from "react";
import { useGoogleAuthStatus } from "@/hooks/use-google-auth-status";
import { useGoogleWorkspaceSyncQuery } from "@/hooks/use-google-workspace-sync";
import type { GoogleIntegrationStatus, GoogleOAuthStatusSuccess } from "@/types/auth";
import type { AgentState, Conversation, GoogleContextItem, Memory } from "@/types/domain";
import type {
  GoogleWorkspaceCalendarDTO,
  GoogleWorkspaceDriveDTO,
  GoogleWorkspaceEmailDTO,
  GoogleWorkspaceSyncSnapshot,
} from "@/types/google-workspace-sync";

type QueryLike<T> = {
  data: T;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<unknown>;
};

function formatTimestamp(timestamp: string) {
  return new Date(timestamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function sortByRecent<T extends { createdAt?: string; timestamp?: string; startTime?: string; modifiedTime?: string }>(items: T[]) {
  return [...items].sort((left, right) => {
    const leftValue = Date.parse(left.createdAt ?? left.timestamp ?? left.startTime ?? left.modifiedTime ?? "");
    const rightValue = Date.parse(right.createdAt ?? right.timestamp ?? right.startTime ?? right.modifiedTime ?? "");
    return rightValue - leftValue;
  });
}

function emailToContextItem(email: GoogleWorkspaceEmailDTO): GoogleContextItem {
  return {
    id: email.id,
    type: "email",
    title: email.subject,
    summary: `${email.sender} - ${email.snippet}`,
    createdAt: email.timestamp,
    participants: [email.sender],
    linkedMemoryIds: [],
  };
}

function calendarToContextItem(event: GoogleWorkspaceCalendarDTO): GoogleContextItem {
  return {
    id: event.id,
    type: "calendar",
    title: event.title,
    summary: event.description || `${event.attendees.length} attendees`,
    createdAt: event.startTime,
    participants: event.attendees,
    linkedMemoryIds: [],
  };
}

function driveToContextItem(file: GoogleWorkspaceDriveDTO): GoogleContextItem {
  return {
    id: file.id,
    type: "doc",
    title: file.name,
    summary: `${file.mimeType} - ${file.owners.join(", ") || "unknown owner"}`,
    createdAt: file.modifiedTime,
    participants: file.owners,
    linkedMemoryIds: [],
  };
}

function contextItemToMemory(item: GoogleContextItem, sourceApp: string): Memory {
  return {
    id: `${sourceApp}-${item.id}`,
    content: item.title,
    sourceApp,
    timestamp: item.createdAt,
    importanceScore: sourceApp === "gmail" ? 0.92 : sourceApp === "calendar" ? 0.85 : 0.78,
    embeddingId: `${item.id}-embedding`,
    relatedEntityIds: item.linkedMemoryIds,
    tags: [sourceApp, item.type],
  };
}

function buildDeadlines(items: GoogleContextItem[]) {
  const keywords = ["deadline", "due", "interview", "prep", "follow-up", "action", "submit"];
  return items.filter((item) => {
    const haystack = `${item.title} ${item.summary}`.toLowerCase();
    return keywords.some((keyword) => haystack.includes(keyword));
  });
}

function buildAgents(status: GoogleOAuthStatusSuccess | undefined): AgentState[] {
  const syncedAt = status?.lastSyncedAt ?? new Date().toISOString();
  const gmail = status?.integrations.find((integration) => integration.provider === "gmail");
  const calendar = status?.integrations.find((integration) => integration.provider === "calendar");
  const drive = status?.integrations.find((integration) => integration.provider === "drive");

  return [
    {
      agentName: "gmail sync",
      status: gmail?.status === "connected" ? "processing" : "idle",
      currentTask: gmail?.status === "connected" ? "fetching latest emails" : "awaiting google connection",
      startedAt: syncedAt,
      progressPercentage: gmail?.status === "connected" ? 100 : 0,
    },
    {
      agentName: "calendar sync",
      status: calendar?.status === "connected" ? "processing" : "idle",
      currentTask: calendar?.status === "connected" ? "fetching upcoming events" : "awaiting google connection",
      startedAt: syncedAt,
      progressPercentage: calendar?.status === "connected" ? 100 : 0,
    },
    {
      agentName: "drive sync",
      status: drive?.status === "connected" ? "processing" : "idle",
      currentTask: drive?.status === "connected" ? "fetching latest files" : "awaiting google connection",
      startedAt: syncedAt,
      progressPercentage: drive?.status === "connected" ? 100 : 0,
    },
  ];
}

function buildConnectedApps(status: GoogleOAuthStatusSuccess | undefined) {
  return (status?.integrations ?? []).map((integration: GoogleIntegrationStatus) => ({
    label: integration.label,
    meta:
      integration.status === "connected"
        ? `last synced ${integration.lastSyncedAt ? formatTimestamp(integration.lastSyncedAt) : "just now"}`
        : "disconnected",
    tone: integration.status === "connected" ? "Connected" : "Disconnected",
  }));
}

function buildGoogleContextItems(snapshot: GoogleWorkspaceSyncSnapshot | undefined): GoogleContextItem[] {
  if (!snapshot) return [];
  return [
    ...snapshot.emails.map(emailToContextItem),
    ...snapshot.calendarEvents.map(calendarToContextItem),
    ...snapshot.driveFiles.map(driveToContextItem),
  ];
}

function buildRecentCalendarActivity(snapshot: GoogleWorkspaceSyncSnapshot | undefined): GoogleContextItem[] {
  if (!snapshot) return [];
  return sortByRecent(snapshot.calendarEvents.map(calendarToContextItem)).slice(0, 3);
}

function buildRecentMemories(snapshot: GoogleWorkspaceSyncSnapshot | undefined): Memory[] {
  if (!snapshot) return [];

  const recentContexts = sortByRecent([
    ...snapshot.emails.map(emailToContextItem),
    ...snapshot.calendarEvents.map(calendarToContextItem),
    ...snapshot.driveFiles.map(driveToContextItem),
  ]).slice(0, 3);

  return recentContexts.map((item) =>
    contextItemToMemory(item, item.type === "doc" ? "drive" : item.type === "calendar" ? "calendar" : "gmail"),
  );
}

function toDashboardQueryLike<T>(
  data: T,
  query: { isLoading: boolean; isFetching: boolean; isError: boolean; error: Error | null; refetch: () => Promise<unknown> },
): QueryLike<T> {
  return {
    data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useDashboardData() {
  const workspaceSyncQuery = useGoogleWorkspaceSyncQuery();
  const authStatusQuery = useGoogleAuthStatus();

  const snapshot = workspaceSyncQuery.data;
  const authStatus = authStatusQuery.data;

  const googleContextItems = useMemo(() => buildGoogleContextItems(snapshot), [snapshot]);
  const recentMemories = useMemo(() => buildRecentMemories(snapshot), [snapshot]);
  const upcomingDeadlines = useMemo(() => buildDeadlines(googleContextItems).slice(0, 3), [googleContextItems]);
  const activeAgents = useMemo(() => buildAgents(authStatus), [authStatus]);
  const recentCalendarActivity = useMemo(() => buildRecentCalendarActivity(snapshot), [snapshot]);
  const connectedApps = useMemo(() => buildConnectedApps(authStatus), [authStatus]);

  const isLoading = workspaceSyncQuery.isLoading || authStatusQuery.isLoading;
  const isError = workspaceSyncQuery.isError || authStatusQuery.isError;
  const error = workspaceSyncQuery.error ?? authStatusQuery.error ?? null;

  const refetchAll = useCallback(() => {
    void workspaceSyncQuery.refetch();
    void authStatusQuery.refetch();
  }, [authStatusQuery.refetch, workspaceSyncQuery.refetch]);

  const tick = useMemo(
    () => ({
      mutate: refetchAll,
      isPending: workspaceSyncQuery.isFetching || authStatusQuery.isFetching,
    }),
    [authStatusQuery.isFetching, workspaceSyncQuery.isFetching, refetchAll],
  );

  return {
    memoriesQuery: toDashboardQueryLike(recentMemories, workspaceSyncQuery),
    googleContextQuery: toDashboardQueryLike(googleContextItems, workspaceSyncQuery),
    agentsQuery: toDashboardQueryLike(activeAgents, authStatusQuery),
    conversationsQuery: toDashboardQueryLike<Conversation[]>([], workspaceSyncQuery),
    recentMemories,
    upcomingDeadlines,
    activeAgents,
    recentCalendarActivity,
    connectedApps,
    conversations: [] as Conversation[],
    isLoading,
    isError,
    error,
    refetchAll,
    tick,
  };
}
