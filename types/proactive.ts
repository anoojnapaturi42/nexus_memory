import type { ApiResponse } from "@/types/api";
import type { GoogleCalendarEventItem, GoogleDocMetadataItem, GoogleDriveFileItem, GoogleEmailItem } from "@/types/google-workspace";
import type { MemorySearchResult } from "@/types/memory-retrieval";

export type ProactiveSignalSource = "calendar" | "email" | "deadline" | "project" | "conversation" | "drive" | "memory";
export type ProactiveTriggerKind =
  | "before-meeting-memory-surface"
  | "deadline-reminder"
  | "calendar-block-suggestion"
  | "follow-up-task"
  | "drive-doc-recommendation";
export type ProactiveActionKind =
  | "surface-memory"
  | "send-reminder"
  | "suggest-calendar-block"
  | "generate-follow-up-task"
  | "recommend-drive-doc";
export type ProactiveRecommendationStatus = "pending" | "pending-approval" | "approved" | "executed" | "dismissed" | "skipped" | "failed";
export type ProactiveApprovalDecision = "approve" | "reject" | "dismiss";
export type ProactiveRunStatus = "idle" | "running" | "success" | "partial" | "failed";
export type ProactiveSeverity = "info" | "notice" | "warning" | "critical";

export type ProactiveSignal = {
  id: string;
  source: ProactiveSignalSource;
  label: string;
  summary: string;
  timestamp: string;
  metadata: Record<string, unknown>;
};

export type ProactiveExecutionLog = {
  id: string;
  runId: string;
  timestamp: string;
  level: "debug" | "info" | "success" | "warning" | "error";
  step: string;
  message: string;
  details?: Record<string, unknown>;
};

export type ProactiveRecommendation = {
  id: string;
  runId: string;
  triggerKind: ProactiveTriggerKind;
  actionKind: ProactiveActionKind;
  title: string;
  summary: string;
  explanation: string;
  whyNow: string;
  confidence: number;
  severity: ProactiveSeverity;
  status: ProactiveRecommendationStatus;
  createdAt: string;
  updatedAt: string;
  dueAt?: string | null;
  sourceSignals: ProactiveSignal[];
  relatedMemoryIds: string[];
  relatedConversationIds: string[];
  relatedDocumentIds: string[];
  relatedEmailIds: string[];
  relatedCalendarEventIds: string[];
  evidence: string[];
  proposedAction: Record<string, unknown>;
  approvalRequired: boolean;
  approvalReason?: string | null;
  traceId: string;
};

export type ProactiveNotification = {
  id: string;
  recommendationId?: string | null;
  type: "recommendation" | "approval" | "execution" | "info";
  title: string;
  message: string;
  severity: ProactiveSeverity;
  createdAt: string;
  readAt?: string | null;
};

export type ProactiveApprovalRequest = {
  recommendationId: string;
  title: string;
  summary: string;
  explanation: string;
  status: ProactiveRecommendationStatus;
  createdAt: string;
};

export type ProactiveSchedulerState = {
  enabled: boolean;
  intervalMinutes: number;
  lastRunAt?: string | null;
  nextRunAt?: string | null;
  status: "stopped" | "running";
};

export type ProactiveExecutionRun = {
  id: string;
  status: ProactiveRunStatus;
  startedAt: string;
  completedAt?: string | null;
  sourceCounts: Record<ProactiveSignalSource, number>;
  logs: ProactiveExecutionLog[];
  recommendations: ProactiveRecommendation[];
  notifications: ProactiveNotification[];
};

export type ProactiveSnapshotData = {
  scheduler: ProactiveSchedulerState;
  activeRun: ProactiveExecutionRun | null;
  latestRun: ProactiveExecutionRun | null;
  runs: ProactiveExecutionRun[];
  recommendations: ProactiveRecommendation[];
  approvals: ProactiveApprovalRequest[];
  notifications: ProactiveNotification[];
  logs: ProactiveExecutionLog[];
};

export type ProactiveSnapshotResponse = ApiResponse<ProactiveSnapshotData>;

export type ProactiveTriggerContext = {
  upcomingEvents: GoogleCalendarEventItem[];
  unreadEmails: GoogleEmailItem[];
  driveFiles: GoogleDriveFileItem[];
  documents: GoogleDocMetadataItem[];
  memories: MemorySearchResult[];
  conversations: Array<{ id: string; title: string; updatedAt: string; messageCount: number }>;
};
