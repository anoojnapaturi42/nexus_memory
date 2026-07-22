import { createLanguageModelClient } from "@/agents";
import { conversationService } from "@/services/conversation-service";
import { googleWorkspaceService } from "@/services/google-workspace-service";
import { memoryRetrievalService } from "@/services/memory-retrieval-service";
import { ProactiveBackgroundScheduler } from "@/lib/proactive/scheduler";
import { evaluateProactiveRules } from "@/lib/proactive/rules";
import { createProactiveId, nowIso } from "@/lib/proactive/utils";
import { ProactiveEventBus } from "@/lib/proactive/event-bus";
import type {
  ProactiveApprovalRequest,
  ProactiveExecutionLog,
  ProactiveExecutionRun,
  ProactiveNotification,
  ProactiveRecommendation,
  ProactiveSchedulerState,
  ProactiveSignal,
  ProactiveSnapshotData,
  ProactiveTriggerContext,
} from "@/types/proactive";
import type { GoogleCalendarEventItem, GoogleDocMetadataItem, GoogleDriveFileItem, GoogleEmailItem } from "@/types/google-workspace";

type ProactiveRunOptions = {
  source?: "manual" | "scheduled";
  reason?: string;
};

type ProactiveDecision = "approve" | "reject" | "dismiss";

function createLog(runId: string, level: ProactiveExecutionLog["level"], step: string, message: string, details?: Record<string, unknown>): ProactiveExecutionLog {
  return {
    id: createProactiveId("log"),
    runId,
    timestamp: nowIso(),
    level,
    step,
    message,
    details,
  };
}

function mapConversationSummary(conversations: Array<{ id: string; messages: { timestamp: string }[]; updatedAt: string; title?: string }>) {
  return conversations.map((conversation) => ({
    id: conversation.id,
    title: conversation.title ?? "recent conversation",
    updatedAt: conversation.updatedAt,
    messageCount: conversation.messages.length,
  }));
}

function toApprovalRequest(recommendation: ProactiveRecommendation): ProactiveApprovalRequest {
  return {
    recommendationId: recommendation.id,
    title: recommendation.title,
    summary: recommendation.summary,
    explanation: recommendation.explanation,
    status: recommendation.status,
    createdAt: recommendation.createdAt,
  };
}

function combineSignals(groups: ProactiveSignal[][]) {
  return groups.flat().slice(0, 12);
}

function buildSourceCounts(
  upcomingEvents: GoogleCalendarEventItem[],
  unreadEmails: GoogleEmailItem[],
  driveFiles: GoogleDriveFileItem[],
  documents: GoogleDocMetadataItem[],
  conversations: Array<{ id: string; title: string; updatedAt: string; messageCount: number }>,
  memories: number,
) {
  return {
    calendar: upcomingEvents.length,
    email: unreadEmails.length,
    deadline: unreadEmails.filter((item) => /due|deadline|by tomorrow|tomorrow|urgent/i.test(`${item.subject} ${item.snippet}`)).length,
    project: Math.max(documents.length, conversations.length),
    conversation: conversations.length,
    drive: driveFiles.length,
    memory: memories,
  };
}

export class ProactiveAutomationService {
  private readonly eventBus = new ProactiveEventBus();
  private readonly llm = createLanguageModelClient();
  private scheduler: ProactiveBackgroundScheduler | null = null;
  private schedulerState: ProactiveSchedulerState = {
    enabled: false,
    intervalMinutes: 15,
    lastRunAt: null,
    nextRunAt: null,
    status: "stopped",
  };
  private activeRun: ProactiveExecutionRun | null = null;
  private runs: ProactiveExecutionRun[] = [];
  private recommendations: ProactiveRecommendation[] = [];
  private notifications: ProactiveNotification[] = [];
  private approvals: ProactiveApprovalRequest[] = [];
  private logs: ProactiveExecutionLog[] = [];

  subscribe(listener: Parameters<ProactiveEventBus["subscribe"]>[0]) {
    return this.eventBus.subscribe(listener);
  }

  private emitLog(runId: string, level: ProactiveExecutionLog["level"], step: string, message: string, details?: Record<string, unknown>) {
    const log = createLog(runId, level, step, message, details);
    this.logs = [log, ...this.logs].slice(0, 200);
    this.activeRun = this.activeRun
      ? {
          ...this.activeRun,
          logs: [log, ...this.activeRun.logs].slice(0, 200),
        }
      : this.activeRun;
    this.eventBus.emit({ type: "log.appended", runId, log, timestamp: log.timestamp });
    return log;
  }

  private emitNotification(runId: string, notification: ProactiveNotification) {
    this.notifications = [notification, ...this.notifications].slice(0, 100);
    this.activeRun = this.activeRun
      ? {
          ...this.activeRun,
          notifications: [notification, ...this.activeRun.notifications].slice(0, 100),
        }
      : this.activeRun;
    this.eventBus.emit({ type: "notification.created", runId, notification, timestamp: notification.createdAt });
  }

  private emitRecommendation(runId: string, recommendation: ProactiveRecommendation) {
    this.recommendations = [recommendation, ...this.recommendations.filter((item) => item.id !== recommendation.id)].slice(0, 100);
    this.activeRun = this.activeRun
      ? {
          ...this.activeRun,
          recommendations: [recommendation, ...this.activeRun.recommendations.filter((item) => item.id !== recommendation.id)].slice(0, 100),
        }
      : this.activeRun;
    this.eventBus.emit({ type: recommendation.status === "approved" || recommendation.status === "executed" ? "recommendation.updated" : "recommendation.created", runId, recommendation, timestamp: recommendation.updatedAt });
  }

  async getContext(): Promise<ProactiveTriggerContext> {
    const [calendarResult, emailResult, driveResult, documentResult, conversations, memorySearchResult] = await Promise.all([
      googleWorkspaceService.fetchCalendarEvents(undefined, 10),
      googleWorkspaceService.fetchLatestEmails(undefined, 10),
      googleWorkspaceService.retrieveDriveFiles(undefined, 10),
      googleWorkspaceService.fetchDocumentMetadata(undefined, 10),
      conversationService.list(),
      memoryRetrievalService.search({
        query: "recent meeting and deadline context",
        limit: 5,
      }),
    ]);

    const upcomingEvents = calendarResult.data.items
      .filter((event) => Date.parse(event.startTime) >= Date.now())
      .sort((left, right) => Date.parse(left.startTime) - Date.parse(right.startTime))
      .slice(0, 6);

    const unreadEmails = emailResult.data.items.filter((email) => email.isUnread).slice(0, 8);
    const driveFiles = driveResult.data.items.slice(0, 8);
    const documents = documentResult.data.items.slice(0, 8);
    const recentConversations = mapConversationSummary(
      conversations.map((conversation) => ({
        id: conversation.id,
        messages: conversation.messages,
        updatedAt: conversation.updatedAt,
      })),
    ).slice(0, 6);

    const context: ProactiveTriggerContext = {
      upcomingEvents,
      unreadEmails,
      driveFiles,
      documents,
      memories: memorySearchResult.data.items,
      conversations: recentConversations,
    };

    return context;
  }

  private async buildRecommendations(
    runId: string,
    context: ProactiveTriggerContext,
    source: NonNullable<ProactiveRunOptions["source"]>,
    reason?: string,
  ) {
    const baseRecommendations = evaluateProactiveRules(context);
    const memorySignals = context.memories.slice(0, 3).map((result) => ({
      id: createProactiveId("signal"),
      source: "memory" as const,
      label: result.memory.content,
      summary: `rank ${result.rank.toFixed(0)} candidate from memory retrieval`,
      timestamp: nowIso(),
      metadata: {
        memoryId: result.memory.id,
        score: result.score,
        sourceApp: result.memory.sourceApp,
      },
    }));

    const augmented = await Promise.all(
      baseRecommendations.map(async (recommendation) => {
        const aiSummary = await this.llm.generate({
          agentName: "planner-agent",
          taskType: "planning.build",
          systemPrompt:
            "you are the proactive planning assistant for google nexus memory. respond with a short plain-language explanation and no markdown fences.",
          prompt: `explain a proactive recommendation for google nexus memory: ${recommendation.summary}`,
          context: {
            recommendation,
            source,
            reason: reason ?? "scheduled proactive analysis",
          },
        });

        const requiresApproval = recommendation.approvalRequired;
        const status: ProactiveRecommendation["status"] = requiresApproval ? "pending-approval" : "executed";
        const updatedAt = nowIso();
        const finalRecommendation: ProactiveRecommendation = {
          id: createProactiveId("recommendation"),
          runId,
          triggerKind: recommendation.triggerKind,
          actionKind: recommendation.actionKind,
          title: recommendation.title,
          summary: recommendation.summary,
          explanation: `${recommendation.explanation} ai assist: ${aiSummary.text}`,
          whyNow: recommendation.whyNow,
          confidence: recommendation.confidence,
          severity: recommendation.severity,
          status,
          createdAt: updatedAt,
          updatedAt,
          dueAt: recommendation.dueAt,
          sourceSignals: combineSignals([recommendation.signals, memorySignals]),
          relatedMemoryIds: context.memories.slice(0, 3).map((item) => item.memory.id),
          relatedConversationIds: context.conversations.slice(0, 2).map((item) => item.id),
          relatedDocumentIds: context.documents.slice(0, 3).map((item) => item.id),
          relatedEmailIds: context.unreadEmails.slice(0, 3).map((item) => item.id),
          relatedCalendarEventIds: context.upcomingEvents.slice(0, 3).map((item) => item.id),
          evidence: recommendation.evidence,
          proposedAction:
            recommendation.actionKind === "surface-memory"
              ? { type: "surface-memory", memoryIds: context.memories.slice(0, 3).map((item) => item.memory.id) }
              : recommendation.actionKind === "send-reminder"
                ? { type: "send-reminder", emailIds: context.unreadEmails.slice(0, 3).map((item) => item.id) }
                : recommendation.actionKind === "suggest-calendar-block"
                  ? {
                      type: "suggest-calendar-block",
                      calendarEventIds: context.upcomingEvents.slice(0, 3).map((item) => item.id),
                      suggestedWindow: recommendation.dueAt,
                    }
                  : recommendation.actionKind === "generate-follow-up-task"
                    ? { type: "generate-follow-up-task", emailIds: context.unreadEmails.slice(0, 3).map((item) => item.id) }
                    : { type: "recommend-drive-doc", documentIds: context.documents.slice(0, 3).map((item) => item.id) },
          approvalRequired: requiresApproval,
          approvalReason: requiresApproval ? "this action can affect your calendar or task list and needs explicit approval." : null,
          traceId: createProactiveId("trace"),
        };

        return finalRecommendation;
      }),
    );

    for (const recommendation of augmented) {
      this.emitRecommendation(runId, recommendation);
      this.emitLog(runId, "info", "recommendation-engine", `generated ${recommendation.triggerKind}`, {
        recommendationId: recommendation.id,
        actionKind: recommendation.actionKind,
        approvalRequired: recommendation.approvalRequired,
      });

      if (recommendation.approvalRequired) {
        const approval = toApprovalRequest(recommendation);
        this.approvals = [approval, ...this.approvals.filter((item) => item.recommendationId !== approval.recommendationId)];
        this.emitNotification(runId, {
          id: createProactiveId("notification"),
          recommendationId: recommendation.id,
          type: "approval",
          title: recommendation.title,
          message: recommendation.approvalReason ?? "approval required",
          severity: recommendation.severity,
          createdAt: nowIso(),
          readAt: null,
        });
      } else {
        this.emitNotification(runId, {
          id: createProactiveId("notification"),
          recommendationId: recommendation.id,
          type: "recommendation",
          title: recommendation.title,
          message: recommendation.whyNow,
          severity: recommendation.severity,
          createdAt: nowIso(),
          readAt: null,
        });
      }
    }

    return augmented;
  }

  async runScan(options: ProactiveRunOptions = {}) {
    const runId = createProactiveId("run");
    const startedAt = nowIso();
    this.activeRun = {
      id: runId,
      status: "running",
      startedAt,
      completedAt: null,
      sourceCounts: {
        calendar: 0,
        email: 0,
        deadline: 0,
        project: 0,
        conversation: 0,
        drive: 0,
        memory: 0,
      },
      logs: [],
      recommendations: [],
      notifications: [],
    };

    this.eventBus.emit({ type: "run.started", runId, timestamp: startedAt });
    this.emitLog(runId, "info", "scheduler", "proactive scan started", {
      source: options.source ?? "manual",
      reason: options.reason ?? "manual scan request",
    });

    const context = await this.getContext();
    const sourceCounts = buildSourceCounts(
      context.upcomingEvents,
      context.unreadEmails,
      context.driveFiles,
      context.documents,
      context.conversations,
      context.memories.length,
    );

    if (this.activeRun) {
      this.activeRun = {
        ...this.activeRun,
        sourceCounts,
      };
    }

    this.emitLog(runId, "info", "signals", "workspace signals collected", {
      calendarEvents: context.upcomingEvents.length,
      unreadEmails: context.unreadEmails.length,
      driveFiles: context.driveFiles.length,
      documents: context.documents.length,
      conversations: context.conversations.length,
      memories: context.memories.length,
    });

    const recommendations = await this.buildRecommendations(runId, context, options.source ?? "manual", options.reason);
    const completedAt = nowIso();
    const status: ProactiveExecutionRun["status"] = recommendations.length > 0 ? "success" : "partial";
    const completionLog = this.emitLog(runId, "success", "scheduler", "proactive scan completed", {
      recommendationCount: recommendations.length,
      status,
    });

    const run: ProactiveExecutionRun = {
      id: runId,
      status,
      startedAt,
      completedAt,
      sourceCounts,
      logs: this.activeRun?.logs ?? [completionLog],
      recommendations,
      notifications: this.activeRun?.notifications ?? [],
    };

    this.activeRun = null;
    this.runs = [run, ...this.runs].slice(0, 20);
    this.schedulerState = {
      ...this.schedulerState,
      lastRunAt: completedAt,
      nextRunAt: this.schedulerState.enabled
        ? new Date(Date.parse(completedAt) + this.schedulerState.intervalMinutes * 60_000).toISOString()
        : null,
    };

    this.eventBus.emit({ type: "run.completed", runId, timestamp: completedAt });

    return run;
  }

  startScheduler(intervalMinutes = this.schedulerState.intervalMinutes) {
    this.schedulerState = {
      ...this.schedulerState,
      enabled: true,
      intervalMinutes,
      status: "running",
      nextRunAt: new Date(Date.now() + intervalMinutes * 60_000).toISOString(),
    };

    this.scheduler?.stop();
    this.scheduler = new ProactiveBackgroundScheduler(async () => {
      await this.runScan({ source: "scheduled", reason: "scheduler tick" });
    }, intervalMinutes * 60_000);
    this.scheduler.start();

    this.emitLog(createProactiveId("run"), "info", "scheduler", "background scheduler started", {
      intervalMinutes,
    });

    return this.schedulerState;
  }

  stopScheduler() {
    this.scheduler?.stop();
    this.scheduler = null;
    this.schedulerState = {
      ...this.schedulerState,
      enabled: false,
      status: "stopped",
      nextRunAt: null,
    };
    return this.schedulerState;
  }

  async approveRecommendation(recommendationId: string) {
    return this.decideRecommendation(recommendationId, "approve");
  }

  async rejectRecommendation(recommendationId: string) {
    return this.decideRecommendation(recommendationId, "reject");
  }

  private async decideRecommendation(recommendationId: string, decision: ProactiveDecision) {
    const recommendation = this.recommendations.find((item) => item.id === recommendationId);
    if (!recommendation) {
      throw new Error("recommendation not found");
    }

    const updatedAt = nowIso();
    let nextStatus: ProactiveRecommendation["status"] = recommendation.status;

    if (decision === "approve") {
      nextStatus = "approved";
    } else if (decision === "reject" || decision === "dismiss") {
      nextStatus = "dismissed";
    }

    const updated: ProactiveRecommendation = {
      ...recommendation,
      status: nextStatus,
      updatedAt,
    };

    this.recommendations = this.recommendations.map((item) => (item.id === recommendationId ? updated : item));
    this.approvals = this.approvals.filter((item) => item.recommendationId !== recommendationId);
    this.notifications = [
      {
        id: createProactiveId("notification"),
        recommendationId,
        type: (decision === "approve" ? "execution" : "info") as ProactiveNotification["type"],
        title: updated.title,
        message:
          decision === "approve"
            ? "the recommendation was approved and is ready to execute."
            : "the recommendation was dismissed.",
        severity: updated.severity,
        createdAt: updatedAt,
        readAt: null,
      },
      ...this.notifications,
    ].slice(0, 100);

    this.logs = [
      createLog(updated.runId, decision === "approve" ? "success" : "warning", "approval", `${decision}ed recommendation`, {
        recommendationId,
        title: updated.title,
      }),
      ...this.logs,
    ].slice(0, 200);

    this.eventBus.emit({
      type: "recommendation.updated",
      runId: updated.runId,
      recommendation: updated,
      timestamp: updatedAt,
    });

    return updated;
  }

  getSnapshot(): ProactiveSnapshotData {
    return {
      scheduler: structuredClone(this.schedulerState),
      activeRun: this.activeRun ? structuredClone(this.activeRun) : null,
      latestRun: this.runs[0] ? structuredClone(this.runs[0]) : null,
      runs: structuredClone(this.runs),
      recommendations: structuredClone(this.recommendations),
      approvals: structuredClone(this.approvals),
      notifications: structuredClone(this.notifications),
      logs: structuredClone(this.logs),
    };
  }
}

export const proactiveAutomationService = new ProactiveAutomationService();
