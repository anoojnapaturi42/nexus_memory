import type { AgentModule, AgentTask } from "@/agents/types";
import { createAgentId, extractJsonObject, normalizeText } from "@/agents/utils";

type ResearchLookupResult = {
  summary: string;
  highlights: string[];
  items: Array<{ id: string; type: string; title: string; summary: string }>;
  highlightedSources: string[];
};

export function createResearchAgentModule(): AgentModule {
  return {
    definition: {
      id: "research-agent",
      name: "research agent",
      description: "scans workspace sources and prepares supporting context for the planner.",
      version: "0.1.0",
      defaultTaskType: "research.scan",
      capabilities: ["workspace scan", "source clustering", "reference extraction"],
    },
    canHandle(task: AgentTask) {
      return task.targetAgent === "research-agent";
    },
    async run(context) {
      const availableContextItems = context.sharedState.contextItems.slice(0, 6).map((item) => ({
        id: item.id,
        type: item.type,
        title: item.title,
        summary: item.summary,
      }));
      const memoryIds = (context.sharedState.results.memoryFindings as { memories: Array<{ id: string }> } | undefined)?.memories.map((memory) => memory.id) ?? [];

      const generated = await context.llm.generate({
        agentName: "research-agent",
        taskType: context.task.type,
        systemPrompt:
          "you are the research agent for google nexus memory. return concise json only with summary, highlights, items, and highlightedSources. do not include markdown fences.",
        prompt: `analyze the available workspace context and produce supporting research notes for this request.\n\nrequest: ${context.rootPrompt}\n\nmemory ids from earlier reasoning: ${JSON.stringify(memoryIds)}\n\navailable workspace context:\n${JSON.stringify(availableContextItems, null, 2)}\n\nreturn json with:\n- summary: one short paragraph\n- highlights: up to 4 strings\n- items: an array of relevant source items\n- highlightedSources: ids or labels for the most useful sources`,
        context: {
          prompt: normalizeText(context.rootPrompt),
          memoryIds,
          contextItemCount: availableContextItems.length,
        },
      });

      const parsed = extractJsonObject<ResearchLookupResult>(generated.text);
      const lookup: ResearchLookupResult = parsed ?? {
        summary: generated.text,
        highlights: availableContextItems.slice(0, 3).map((item) => item.summary),
        items: availableContextItems,
        highlightedSources: availableContextItems.slice(0, 3).map((item) => item.id),
      };

      context.sharedState.results.researchFindings = lookup;
      context.log("success", "gathered supporting workspace context for planning.", {
        itemCount: lookup.items.length,
        usage: generated.usage,
      });

      const nextTask = context.delegate(
        "planner-agent",
        "planning.build",
        {
          query: context.rootPrompt,
          memoryIds: (context.sharedState.results.memoryFindings as { memories: Array<{ id: string }> } | undefined)?.memories.map((memory) => memory.id) ?? [],
          researchItemIds: lookup.items.map((item) => item.id),
        },
        {
          priority: 70,
          maxRetries: 1,
        },
      );

      return {
        status: "succeeded",
        progressPercentage: 45,
        summary: lookup.summary || generated.text,
        output: lookup,
        delegations: [nextTask],
        agentStatePatch: {
          currentTask: "assembling workspace evidence",
          progressPercentage: 45,
        },
        llmUsage: generated.usage,
        artifacts: [
          {
            id: createAgentId("artifact"),
            kind: "research-lookup",
            label: "research result",
            data: lookup,
            createdAt: context.now(),
          },
        ],
      };
    },
  };
}
