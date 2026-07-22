import { mockAgentExecutionEngine } from "@/agents";
import type { AgentExecutionEvent, AgentWorkflowInput } from "@/agents/types";
import type { AgentLogEntry, AgentThoughtStep, ChatOrchestrationEvent } from "@/types/chat";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function logFromEvent(event: AgentExecutionEvent): AgentLogEntry {
  return {
    id: event.id,
    agentName: event.agentName ?? "agent",
    timestamp: event.timestamp,
    message: event.message,
    level: event.level === "error" ? "warning" : event.level === "success" ? "success" : "info",
  };
}

function stepFromEvent(event: AgentExecutionEvent): AgentThoughtStep {
  return {
    id: event.taskId ?? event.id,
    agentName: event.agentName ?? "agent",
    status: event.type === "task.failed" ? "error" : event.type === "task.completed" ? "completed" : "processing",
    progressPercentage: Number(event.data?.progressPercentage ?? (event.type === "task.completed" ? 100 : 25)),
    currentTask: event.message,
    timestamp: event.timestamp,
    logs: event.type === "agent.log" ? [logFromEvent(event)] : [],
  };
}

export async function* runMockChatOrchestration(input: {
  prompt: string;
  memories: AgentWorkflowInput["memories"];
  contextItems: AgentWorkflowInput["contextItems"];
  agents: AgentWorkflowInput["agentStates"];
}): AsyncGenerator<ChatOrchestrationEvent> {
  const stepMap = new Map<string, AgentThoughtStep>();
  let finalMessage = "";

  const workflow = mockAgentExecutionEngine.streamWorkflow({
    prompt: input.prompt,
    memories: input.memories,
    contextItems: input.contextItems,
    agentStates: input.agents,
    conversations: [],
    entryAgent: "memory-agent",
  });

  for await (const event of workflow) {
    if (event.type === "workflow.completed") {
      finalMessage = String(event.data?.finalMessage ?? "");
      continue;
    }

    if (event.type === "task.started") {
      const step = stepFromEvent(event);
      stepMap.set(step.id, step);
      yield { type: "step", step };
      continue;
    }

    if (event.type === "agent.log" || event.type === "task.completed" || event.type === "task.failed" || event.type === "task.retried") {
      const stepId = event.taskId ?? event.id;
      const step = stepMap.get(stepId) ?? stepFromEvent(event);
      step.status =
        event.type === "task.failed" ? "error" : event.type === "task.completed" ? "completed" : step.status;
      step.progressPercentage = Number(event.data?.progressPercentage ?? step.progressPercentage);
      step.currentTask = event.message;
      step.timestamp = event.timestamp;
      step.logs = [...step.logs, logFromEvent(event)];
      stepMap.set(stepId, step);
      yield { type: "step", step };
      continue;
    }
  }

  const chunks = finalMessage.split(/(\s+)/).filter(Boolean);
  for (const chunk of chunks) {
    yield { type: "chunk", chunk };
    await sleep(30);
  }

  yield { type: "complete", finalMessage };
}
