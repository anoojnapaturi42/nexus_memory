import type { AgentModule, AgentTask } from "@/agents/types";
import { createAgentId, extractJsonObject, normalizeText } from "@/agents/utils";

type SchedulerResult = {
  summary: string;
  blocks: Array<{
    day: string;
    start: string;
    end: string;
    focus: string;
  }>;
};

export function createSchedulerAgentModule(): AgentModule {
  return {
    definition: {
      id: "scheduler-agent",
      name: "scheduler agent",
      description: "builds optimized calendar blocks for the final plan.",
      version: "0.1.0",
      defaultTaskType: "schedule.optimize",
      capabilities: ["calendar planning", "work block optimization", "time boxing"],
    },
    canHandle(task: AgentTask) {
      return task.targetAgent === "scheduler-agent";
    },
    async run(context) {
      const plan = context.sharedState.results.plan as { milestones: string[]; weeklyFocus: string[] } | undefined;

      const generated = await context.llm.generate({
        agentName: "scheduler-agent",
        taskType: context.task.type,
        systemPrompt:
          "you are the scheduler agent for google nexus memory. return concise json only with summary and blocks. do not include markdown fences.",
        prompt: `build optimized calendar blocks for this request.\n\nrequest: ${context.rootPrompt}\n\nplan milestones:\n${JSON.stringify(plan?.milestones ?? [], null, 2)}\n\nweekly focus:\n${JSON.stringify(plan?.weeklyFocus ?? [], null, 2)}\n\nreturn json with:\n- summary: one short paragraph\n- blocks: an array of calendar blocks with day, start, end, and focus`,
        context: {
          plan,
          prompt: normalizeText(context.rootPrompt),
        },
      });

      const parsed = extractJsonObject<SchedulerResult>(generated.text);
      const schedule: SchedulerResult = parsed ?? {
        summary: generated.text,
        blocks: [
          { day: "monday", start: "09:00", end: "11:00", focus: "deep work" },
          { day: "wednesday", start: "13:00", end: "15:00", focus: "practice and review" },
          { day: "friday", start: "10:00", end: "11:30", focus: "simulation and reflection" },
        ],
      };

      context.sharedState.results.schedule = schedule;
      context.log("success", "generated optimized calendar blocks.", {
        blockCount: schedule.blocks.length,
        usage: generated.usage,
      });

      return {
        status: "succeeded",
        progressPercentage: 100,
        summary: schedule.summary || generated.text,
        output: schedule,
        agentStatePatch: {
          currentTask: "generating optimized calendar blocks",
          progressPercentage: 100,
        },
        llmUsage: generated.usage,
        artifacts: [
          {
            id: createAgentId("artifact"),
            kind: "schedule-result",
            label: "calendar blocks",
            data: schedule,
            createdAt: context.now(),
          },
        ],
      };
    },
  };
}
