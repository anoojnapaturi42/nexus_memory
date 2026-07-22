import type { AgentModule, AgentTask } from "@/agents/types";
import { createAgentId, extractJsonObject, normalizeText } from "@/agents/utils";

type PlanningResult = {
  summary: string;
  milestones: string[];
  weeklyFocus: string[];
  supportingReferences: string[];
};

export function createPlannerAgentModule(): AgentModule {
  return {
    definition: {
      id: "planner-agent",
      name: "planner agent",
      description: "turns evidence into a concrete execution plan and delegates scheduling.",
      version: "0.1.0",
      defaultTaskType: "planning.build",
      capabilities: ["milestone planning", "goal decomposition", "workflow orchestration"],
    },
    canHandle(task: AgentTask) {
      return task.targetAgent === "planner-agent";
    },
    async run(context) {
      const research = context.sharedState.results.researchFindings as
        | { items: Array<{ id: string; title: string; summary: string }> }
        | undefined;

      const memoryLookup = context.sharedState.results.memoryFindings as
        | { memories: Array<{ id: string; content: string }> }
        | undefined;

      const generated = await context.llm.generate({
        agentName: "planner-agent",
        taskType: context.task.type,
        systemPrompt:
          "you are the planner agent for google nexus memory. return concise json only with summary, milestones, weeklyFocus, and supportingReferences. do not include markdown fences.",
        prompt: `turn the available evidence into a concrete execution plan.\n\nrequest: ${context.rootPrompt}\n\nmemory ids: ${JSON.stringify(memoryLookup?.memories.map((memory) => memory.id) ?? [])}\n\nresearch item ids: ${JSON.stringify(research?.items.map((item) => item.id) ?? [])}\n\navailable memory highlights:\n${JSON.stringify(memoryLookup?.memories.slice(0, 5) ?? [], null, 2)}\n\navailable research notes:\n${JSON.stringify(research?.items.slice(0, 5) ?? [], null, 2)}\n\nreturn json with:\n- summary: one short paragraph\n- milestones: 3 to 6 actionable milestones\n- weeklyFocus: 2 to 4 weekly focus areas\n- supportingReferences: ids or labels of useful references`,
        context: {
          memoryLookup,
          research,
          prompt: normalizeText(context.rootPrompt),
        },
      });

      const parsed = extractJsonObject<PlanningResult>(generated.text);
      const plan: PlanningResult = parsed ?? {
        summary: generated.text,
        milestones: [
          "review the core constraints and goals.",
          "build focused practice loops with checkpoint reviews.",
          "finish with timed simulations and correction passes.",
        ],
        weeklyFocus: [
          "week 1: fundamentals and structure.",
          "week 2: implementation drills and review.",
          "week 3: timed practice and refinement.",
        ],
        supportingReferences: [],
      };

      context.sharedState.results.plan = plan;
      context.log("success", "created preparation milestones and workflow structure.", {
        milestoneCount: plan.milestones.length,
        usage: generated.usage,
      });

      const delegations = [
        context.delegate(
          "scheduler-agent",
          "schedule.optimize",
          {
            query: context.rootPrompt,
            milestones: plan.milestones,
            weeklyFocus: plan.weeklyFocus,
          },
          {
            priority: 60,
            maxRetries: 1,
          },
        ),
      ];

      const prompt = normalizeText(context.rootPrompt);
      if (prompt.includes("email") || prompt.includes("send") || prompt.includes("follow up")) {
        delegations.push(
          context.delegate(
            "email-agent",
            "email.compose",
            {
              query: context.rootPrompt,
              milestones: plan.milestones,
            },
            {
              priority: 50,
              maxRetries: 1,
            },
          ),
        );
      }

      return {
        status: "succeeded",
        progressPercentage: 70,
        summary: plan.summary || generated.text,
        output: plan,
        delegations,
        agentStatePatch: {
          currentTask: "decomposing goals into milestones",
          progressPercentage: 70,
        },
        llmUsage: generated.usage,
        artifacts: [
          {
            id: createAgentId("artifact"),
            kind: "planning-result",
            label: "planning output",
            data: plan,
            createdAt: context.now(),
          },
        ],
      };
    },
  };
}
