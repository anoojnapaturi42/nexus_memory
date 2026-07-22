import type {
  ProactiveActionKind,
  ProactiveRecommendation,
  ProactiveSignal,
  ProactiveSignalSource,
  ProactiveTriggerContext,
  ProactiveTriggerKind,
} from "@/types/proactive";
import { clamp, createProactiveId, formatRelativeHours, hoursBetween, nowIso } from "./utils";

type RuleDefinition = {
  triggerKind: ProactiveTriggerKind;
  actionKind: ProactiveActionKind;
  title: string;
  severity: "info" | "notice" | "warning" | "critical";
  approvalRequired: boolean;
  matches: (context: ProactiveTriggerContext) => boolean;
  buildSignals: (context: ProactiveTriggerContext) => ProactiveSignal[];
  buildExplanation: (context: ProactiveTriggerContext) => { summary: string; explanation: string; whyNow: string; evidence: string[]; confidence: number; dueAt?: string | null };
};

function queryWords(text: string) {
  return text
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.replace(/[^a-z0-9]/g, ""))
    .filter((word) => word.length > 2);
}

function scoreOverlap(a: string, b: string) {
  const words = new Set(queryWords(a));
  let overlap = 0;
  for (const word of queryWords(b)) {
    if (words.has(word)) overlap += 1;
  }
  return overlap;
}

function buildSignal(source: ProactiveSignalSource, label: string, summary: string, metadata: Record<string, unknown>): ProactiveSignal {
  return {
    id: createProactiveId("signal"),
    source,
    label,
    summary,
    timestamp: nowIso(),
    metadata,
  };
}

const rules: RuleDefinition[] = [
  {
    triggerKind: "before-meeting-memory-surface",
    actionKind: "surface-memory",
    title: "surface relevant memories before meetings",
    severity: "notice",
    approvalRequired: false,
    matches: (context) => context.upcomingEvents.length > 0,
    buildSignals: (context) =>
      context.upcomingEvents.slice(0, 3).map((event) =>
        buildSignal("calendar", event.title, `meeting starts at ${event.startTime}`, {
          eventId: event.id,
          attendees: event.attendees,
        }),
      ),
    buildExplanation: (context) => {
      const event = context.upcomingEvents[0];
      const matchedMemories = context.memories.slice(0, 3);
      const dueAt = event?.startTime ?? null;

      return {
        summary: event ? `prepare for "${event.title}"` : "prepare for the next meeting",
        explanation: `the memory engine found ${matchedMemories.length} relevant memories and linked them to the next meeting window.`,
        whyNow: event ? `the meeting starts in ${formatRelativeHours(hoursBetween(nowIso(), event.startTime))}.` : "a meeting is coming up soon.",
        evidence: [
          ...matchedMemories.map((memory) => memory.memory.content),
          ...(event ? [`calendar event: ${event.title}`] : []),
        ],
        confidence: clamp(0.72 + matchedMemories.length * 0.05, 0.7, 0.97),
        dueAt,
      };
    },
  },
  {
    triggerKind: "deadline-reminder",
    actionKind: "send-reminder",
    title: "remind about approaching deadlines",
    severity: "warning",
    approvalRequired: false,
    matches: (context) => context.unreadEmails.length > 0 || context.conversations.length > 0,
    buildSignals: (context) =>
      context.unreadEmails.slice(0, 3).map((email) =>
        buildSignal("email", email.subject, email.snippet, {
          emailId: email.id,
          sender: email.sender,
          receivedAt: email.receivedAt,
        }),
      ),
    buildExplanation: (context) => {
      const email = context.unreadEmails[0];
      const relatedConversation = context.conversations[0];
      return {
        summary: email ? `deadline reminder from "${email.subject}"` : "deadline reminder needed",
        explanation: "the inbox contains a likely deadline signal and the engine marked it for proactive follow-up.",
        whyNow: email ? `email was received ${formatRelativeHours(hoursBetween(email.receivedAt, nowIso()))} ago.` : "recent workspace activity suggests a deadline is approaching.",
        evidence: [
          ...(email ? [email.snippet, `sender: ${email.sender}`] : []),
          ...(relatedConversation ? [`conversation: ${relatedConversation.title}`] : []),
        ],
        confidence: clamp(0.7 + (email ? 0.12 : 0), 0.68, 0.95),
      };
    },
  },
  {
    triggerKind: "calendar-block-suggestion",
    actionKind: "suggest-calendar-block",
    title: "suggest calendar blocks for active projects",
    severity: "notice",
    approvalRequired: true,
    matches: (context) => context.documents.length > 0 || context.conversations.length > 0,
    buildSignals: (context) => [
      ...context.documents.slice(0, 3).map((doc) =>
        buildSignal("drive", doc.name, "project support document detected", {
          documentId: doc.id,
          mimeType: doc.mimeType,
        }),
      ),
      ...context.conversations.slice(0, 2).map((conversation) =>
        buildSignal("conversation", conversation.title, "active project conversation", {
          conversationId: conversation.id,
          messageCount: conversation.messageCount,
        }),
      ),
    ],
    buildExplanation: (context) => {
      const projectDoc = context.documents[0];
      const conversation = context.conversations[0];
      return {
        summary: `reserve focus time for ${projectDoc?.name ?? conversation?.title ?? "active projects"}`,
        explanation: "the engine detected active project signals and prepared a calendar block suggestion for user approval.",
        whyNow: "protecting a focus block early prevents work from fragmenting later in the week.",
        evidence: [
          ...(projectDoc ? [`drive doc: ${projectDoc.name}`] : []),
          ...(conversation ? [`conversation: ${conversation.title}`] : []),
        ],
        confidence: clamp(0.66 + (projectDoc ? 0.1 : 0) + (conversation ? 0.05 : 0), 0.66, 0.91),
      };
    },
  },
  {
    triggerKind: "follow-up-task",
    actionKind: "generate-follow-up-task",
    title: "generate follow-up tasks from emails",
    severity: "notice",
    approvalRequired: true,
    matches: (context) => context.unreadEmails.some((email) => scoreOverlap(email.subject, email.snippet) > 0),
    buildSignals: (context) =>
      context.unreadEmails.slice(0, 2).map((email) =>
        buildSignal("email", email.subject, email.snippet, {
          emailId: email.id,
          threadId: email.threadId,
        }),
      ),
    buildExplanation: (context) => {
      const email = context.unreadEmails[0];
      return {
        summary: `follow up on ${email?.subject ?? "inbox updates"}`,
        explanation: "the email classifier detected actionable language and turned it into a task proposal.",
        whyNow: "this kind of follow-up becomes harder to recover if it sits in the inbox too long.",
        evidence: [email?.snippet ?? "unread mail with action cues", email?.sender ? `sender: ${email.sender}` : "sender unknown"].filter(Boolean),
        confidence: clamp(0.71 + (email ? 0.08 : 0), 0.7, 0.94),
      };
    },
  },
  {
    triggerKind: "drive-doc-recommendation",
    actionKind: "recommend-drive-doc",
    title: "recommend relevant drive docs",
    severity: "info",
    approvalRequired: false,
    matches: (context) => context.driveFiles.length > 0,
    buildSignals: (context) =>
      context.driveFiles.slice(0, 3).map((file) =>
        buildSignal("drive", file.name, "recent file updated in drive", {
          fileId: file.id,
          mimeType: file.mimeType,
          modifiedTime: file.modifiedTime,
        }),
      ),
    buildExplanation: (context) => {
      const file = context.driveFiles[0];
      const doc = context.documents[0];
      return {
        summary: `recommend ${doc?.name ?? file?.name ?? "a drive document"}`,
        explanation: "recent drive activity suggests a document that should be surfaced alongside the current context.",
        whyNow: "recommendations are strongest immediately after a related update or meeting signal.",
        evidence: [
          ...(file ? [`drive file: ${file.name}`] : []),
          ...(doc ? [`document metadata: ${doc.name}`] : []),
        ],
        confidence: clamp(0.63 + (file ? 0.12 : 0), 0.62, 0.89),
      };
    },
  },
];

export function evaluateProactiveRules(context: ProactiveTriggerContext) {
  return rules
    .filter((rule) => rule.matches(context))
    .map((rule) => {
      const explanation = rule.buildExplanation(context);
      const signals = rule.buildSignals(context);
      return {
        triggerKind: rule.triggerKind,
        actionKind: rule.actionKind,
        title: rule.title,
        severity: rule.severity,
        approvalRequired: rule.approvalRequired,
        explanation: explanation.explanation,
        summary: explanation.summary,
        whyNow: explanation.whyNow,
        confidence: explanation.confidence,
        dueAt: explanation.dueAt ?? null,
        evidence: explanation.evidence,
        signals,
      };
    });
}
