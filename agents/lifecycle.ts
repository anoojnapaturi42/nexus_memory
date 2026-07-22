import type { AgentDefinition, AgentName } from "@/agents/types";
import type { AgentState } from "@/types/domain";
import { nowIso } from "@/agents/utils";

function toDomainStatus(status: "registered" | "idle" | "queued" | "running" | "waiting" | "succeeded" | "failed" | "cancelled"): AgentState["status"] {
  if (status === "succeeded") return "completed";
  if (status === "failed" || status === "cancelled") return "error";
  if (status === "running" || status === "queued" || status === "waiting") return "processing";
  return "idle";
}

export class AgentLifecycleManager {
  private readonly agentStates = new Map<AgentName, AgentState>();

  register(definition: AgentDefinition) {
    this.agentStates.set(definition.id, {
      agentName: definition.name,
      status: "idle",
      currentTask: "awaiting orchestration",
      startedAt: nowIso(),
      progressPercentage: 0,
    });
  }

  update(agentName: AgentName, patch: Partial<AgentState>) {
    const current = this.agentStates.get(agentName) ?? {
      agentName,
      status: "idle",
      currentTask: "awaiting orchestration",
      startedAt: nowIso(),
      progressPercentage: 0,
    };

    const next = structuredClone({
      ...current,
      ...patch,
      agentName: patch.agentName ?? current.agentName,
    });
    this.agentStates.set(agentName, next);
    return next;
  }

  setStatus(agentName: AgentName, status: "registered" | "idle" | "queued" | "running" | "waiting" | "succeeded" | "failed" | "cancelled", currentTask: string, progressPercentage: number) {
    return this.update(agentName, {
      status: toDomainStatus(status),
      currentTask,
      startedAt: nowIso(),
      progressPercentage,
    });
  }

  markQueued(agentName: AgentName, currentTask: string) {
    return this.setStatus(agentName, "queued", currentTask, 5);
  }

  markRunning(agentName: AgentName, currentTask: string, progressPercentage = 0) {
    return this.setStatus(agentName, "running", currentTask, progressPercentage);
  }

  markWaiting(agentName: AgentName, currentTask: string, progressPercentage = 50) {
    return this.setStatus(agentName, "waiting", currentTask, progressPercentage);
  }

  markSucceeded(agentName: AgentName, currentTask: string, progressPercentage = 100) {
    return this.setStatus(agentName, "succeeded", currentTask, progressPercentage);
  }

  markFailed(agentName: AgentName, currentTask: string, progressPercentage = 100) {
    return this.setStatus(agentName, "failed", currentTask, progressPercentage);
  }

  list() {
    return structuredClone(Array.from(this.agentStates.values()));
  }
}
