import { createEmailAgentModule } from "@/agents/email-agent";
import { AgentOrchestrator } from "@/agents/orchestrator";
import { createMemoryAgentModule } from "@/agents/memory-agent";
import { createPlannerAgentModule } from "@/agents/planner-agent";
import { createResearchAgentModule } from "@/agents/research-agent";
import { createSchedulerAgentModule } from "@/agents/scheduler-agent";
import type { AgentToolDefinition } from "@/agents/types";
import { getMockGoogleContextItems, getMockMemories } from "@/mock/runtime";

function scoreQuery(query: string, candidate: string) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  let score = 0;
  for (const word of words) {
    if (candidate.toLowerCase().includes(word)) score += 1;
  }
  return score;
}

export function createMockAgentExecutionEngine() {
  const engine = new AgentOrchestrator();

  const memoryLookupTool: AgentToolDefinition<{ query: string; limit: number }, { memories: Array<{ id: string; content: string; sourceApp: string; importanceScore: number }>; relatedEntityIds: string[] }> = {
    name: "memory.lookup",
    description: "mock semantic memory search",
    async invoke(input) {
      const memories = getMockMemories()
        .map((memory) => ({
          id: memory.id,
          content: memory.content,
          sourceApp: memory.sourceApp,
          importanceScore: memory.importanceScore,
          score: scoreQuery(input.query, memory.content) + memory.importanceScore,
        }))
        .sort((left, right) => right.score - left.score)
        .slice(0, input.limit)
        .map(({ score, ...memory }) => memory);

      return {
        memories,
        relatedEntityIds: Array.from(new Set(memories.flatMap((memory) => [memory.id]))),
      };
    },
  };

  const workspaceSearchTool: AgentToolDefinition<
    { query: string; memoryIds: string[]; limit: number },
    { items: Array<{ id: string; type: string; title: string; summary: string }>; highlightedSources: string[] }
  > = {
    name: "workspace.search",
    description: "mock workspace context search",
    async invoke(input) {
      const items = getMockGoogleContextItems()
        .map((item) => ({
          id: item.id,
          type: item.type,
          title: item.title,
          summary: item.summary,
          score: scoreQuery(input.query, `${item.title} ${item.summary}`),
        }))
        .sort((left, right) => right.score - left.score)
        .slice(0, input.limit)
        .map(({ score, ...item }) => item);

      return {
        items,
        highlightedSources: items.map((item) => item.title),
      };
    },
  };

  const planningComposeTool: AgentToolDefinition<
    { query: string; memories: string[]; researchItems: string[] },
    { milestones: string[]; weeklyFocus: string[]; supportingReferences: string[] }
  > = {
    name: "planning.compose",
    description: "mock planning synthesis",
    async invoke(input) {
      return {
        milestones: [
          "review core fundamentals and baseline patterns.",
          "build focused interview drills and timed practice cycles.",
          "close the loop with reflection, error logs, and final mock sessions.",
        ],
        weeklyFocus: [
          "week 1: retrieval practice and topic mapping.",
          "week 2: implementation drills and system design reviews.",
          "week 3: interview simulation and correction passes.",
        ],
        supportingReferences: [...input.memories, ...input.researchItems].slice(0, 6),
      };
    },
  };

  const emailComposeTool: AgentToolDefinition<
    { query: string; milestones: string[] },
    { subject: string; body: string; recipients: string[] }
  > = {
    name: "email.compose",
    description: "mock email drafting",
    async invoke(input) {
      return {
        subject: `follow up on ${input.query.slice(0, 24).toLowerCase() || "workspace update"}`,
        body: `i created a draft follow-up based on the latest plan: ${input.milestones.slice(0, 2).join(" ")}`,
        recipients: ["team@example.com"],
      };
    },
  };

  const calendarOptimizeTool: AgentToolDefinition<
    { query: string; milestones: string[]; weeklyFocus: string[] },
    { blocks: Array<{ day: string; start: string; end: string; focus: string }> }
  > = {
    name: "calendar.optimize",
    description: "mock calendar optimization",
    async invoke(input) {
      const focus = input.weeklyFocus[0] ?? "deep work and review";
      return {
        blocks: [
          { day: "monday", start: "07:30", end: "09:00", focus },
          { day: "wednesday", start: "18:30", end: "20:00", focus: input.milestones[0] ?? focus },
          { day: "friday", start: "07:30", end: "09:00", focus: input.milestones[1] ?? "mock interviews and correction passes" },
        ],
      };
    },
  };

  engine
    .registerTool(memoryLookupTool)
    .registerTool(workspaceSearchTool)
    .registerTool(planningComposeTool)
    .registerTool(emailComposeTool)
    .registerTool(calendarOptimizeTool)
    .registerAgent(createMemoryAgentModule())
    .registerAgent(createResearchAgentModule())
    .registerAgent(createPlannerAgentModule())
    .registerAgent(createEmailAgentModule())
    .registerAgent(createSchedulerAgentModule());

  return engine;
}

export const mockAgentExecutionEngine = createMockAgentExecutionEngine();
