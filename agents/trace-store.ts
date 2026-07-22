import type { AgentExecutionEvent, AgentTraceEntry } from "@/agents/types";

export class AgentTraceStore {
  private readonly tracesByRunId = new Map<string, AgentTraceEntry[]>();

  append(event: AgentExecutionEvent) {
    const trace = this.tracesByRunId.get(event.runId) ?? [];
    trace.push({
      id: event.id,
      runId: event.runId,
      agentName: event.agentName,
      taskId: event.taskId,
      type: event.type,
      level: event.level,
      message: event.message,
      timestamp: event.timestamp,
      data: event.data,
    });
    this.tracesByRunId.set(event.runId, trace);
  }

  list(runId: string) {
    return structuredClone(this.tracesByRunId.get(runId) ?? []);
  }

  clear(runId: string) {
    this.tracesByRunId.delete(runId);
  }
}
