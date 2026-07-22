import type { AgentModule, AgentTask } from "@/agents/types";
import { createAgentId, extractJsonObject, normalizeText } from "@/agents/utils";

type MemoryLookupResult = {
  summary: string;
  highlights: string[];
  memories: Array<{ id: string; content: string; sourceApp: string; importanceScore: number }>;
  relatedEntityIds: string[];
};

export function createMemoryAgentModule(): AgentModule {
  return {
    definition: {
      id: "memory-agent",
      name: "memory agent",
      description: "retrieves relevant long-term memories and forwards the best candidates to research.",
      version: "0.1.0",
      defaultTaskType: "memory.scan",
      capabilities: ["vector search", "memory ranking", "relationship linking"],
    },
    canHandle(task: AgentTask) {
      return task.targetAgent === "memory-agent";
    },
    async run(context) {
      const currentMemories = context.sharedState.memories.slice(0, 4).map((memory) => ({
        id: memory.id,
        content: memory.content,
        sourceApp: memory.sourceApp,
        importanceScore: memory.importanceScore,
      }));

      const generated = await context.llm.generate({
        agentName: "memory-agent",
        taskType: context.task.type,
        systemPrompt:
          "you are the memory agent for google nexus memory. return concise json only with summary, highlights, memories, and relatedEntityIds. do not include markdown fences.",
        prompt: `analyze the user's request and synthesize the most relevant available memories.\n\nrequest: ${context.rootPrompt}\n\navailable memories:\n${JSON.stringify(currentMemories, null, 2)}\n\nreturn json with:\n- summary: one short paragraph\n- highlights: up to 4 bullet-like strings\n- memories: the memory records to carry forward\n- relatedEntityIds: related entity ids if any`,
        context: {
          prompt: normalizeText(context.rootPrompt),
          availableMemoryCount: currentMemories.length,
          memoryIds: currentMemories.map((memory) => memory.id),
        },
      });

      const parsed = extractJsonObject<MemoryLookupResult>(generated.text);
      const lookup: MemoryLookupResult = parsed ?? {
        summary: generated.text,
        highlights: currentMemories.slice(0, 3).map((memory) => memory.content),
        memories: currentMemories,
        relatedEntityIds: [],
      };

      context.sharedState.results.memoryFindings = lookup;
      context.log("success", "synthesized memory context from available workspace state.", {
        memoryIds: lookup.memories.map((memory) => memory.id),
        usage: generated.usage,
      });

      const nextTask = context.delegate(
        "research-agent",
        "research.scan",
        {
          query: context.rootPrompt,
          memoryIds: lookup.memories.map((memory) => memory.id),
          relatedEntityIds: lookup.relatedEntityIds,
        },
        {
          priority: 80,
          maxRetries: 1,
        },
      );

      return {
        status: "succeeded",
        progressPercentage: 24,
        summary: lookup.summary || generated.text,
        output: lookup,
        delegations: [nextTask],
        agentStatePatch: {
          currentTask: "ranking memory candidates",
          progressPercentage: 24,
        },
        llmUsage: generated.usage,
        artifacts: [
          {
            id: createAgentId("artifact"),
            kind: "memory-lookup",
            label: "memory lookup result",
            data: lookup,
            createdAt: context.now(),
          },
        ],
      };
    },
  };
}
