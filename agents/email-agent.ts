import type { AgentModule, AgentTask } from "@/agents/types";
import { createAgentId, extractJsonObject, normalizeText } from "@/agents/utils";

type EmailDraftResult = {
  summary: string;
  subject: string;
  body: string;
  recipients: string[];
};

export function createEmailAgentModule(): AgentModule {
  return {
    definition: {
      id: "email-agent",
      name: "email agent",
      description: "drafts concise follow-ups and communication artifacts.",
      version: "0.1.0",
      defaultTaskType: "email.compose",
      capabilities: ["email drafting", "follow-up generation", "communication summarization"],
    },
    canHandle(task: AgentTask) {
      return task.targetAgent === "email-agent";
    },
    async run(context) {
      const planMilestones = (context.sharedState.results.plan as { milestones: string[] } | undefined)?.milestones ?? [];

      const generated = await context.llm.generate({
        agentName: "email-agent",
        taskType: context.task.type,
        systemPrompt:
          "you are the email agent for google nexus memory. return concise json only with summary, subject, body, and recipients. do not include markdown fences.",
        prompt: `draft a concise follow-up communication.\n\nrequest: ${context.rootPrompt}\n\nplan milestones:\n${JSON.stringify(planMilestones, null, 2)}\n\nreturn json with:\n- summary: one short paragraph\n- subject: a short email subject\n- body: the message body\n- recipients: an array of suggested recipients`,
        context: {
          milestones: planMilestones,
          prompt: normalizeText(context.rootPrompt),
        },
      });

      const parsed = extractJsonObject<EmailDraftResult>(generated.text);
      const draft: EmailDraftResult = parsed ?? {
        summary: generated.text,
        subject: `follow up: ${context.rootPrompt.slice(0, 40)}`.trim(),
        body: `hi,\n\nfollowing up on the request: ${context.rootPrompt}\n\nbest,\ngoogle nexus memory`,
        recipients: [],
      };

      context.sharedState.results.emailDraft = draft;
      context.log("success", "prepared a communication draft for review.", {
        recipients: draft.recipients.length,
        usage: generated.usage,
      });

      return {
        status: "succeeded",
        progressPercentage: 80,
        summary: draft.summary || generated.text,
        output: draft,
        agentStatePatch: {
          currentTask: "drafting communication",
          progressPercentage: 80,
        },
        llmUsage: generated.usage,
        artifacts: [
          {
            id: createAgentId("artifact"),
            kind: "email-draft",
            label: draft.subject,
            data: draft,
            createdAt: context.now(),
          },
        ],
      };
    },
  };
}
