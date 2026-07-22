import type { AgentExecutionEvent } from "@/agents/types";

export type AgentEventListener = (event: AgentExecutionEvent) => void;

export class AgentEventBus {
  private readonly listeners = new Set<AgentEventListener>();

  subscribe(listener: AgentEventListener) {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(event: AgentExecutionEvent) {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  clear() {
    this.listeners.clear();
  }
}
