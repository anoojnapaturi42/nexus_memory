import type { ProactiveExecutionLog, ProactiveNotification, ProactiveRecommendation } from "@/types/proactive";

export type ProactiveEvent =
  | { type: "run.started"; runId: string; timestamp: string }
  | { type: "run.completed"; runId: string; timestamp: string }
  | { type: "log.appended"; runId: string; log: ProactiveExecutionLog; timestamp: string }
  | { type: "recommendation.created"; runId: string; recommendation: ProactiveRecommendation; timestamp: string }
  | { type: "recommendation.updated"; runId: string; recommendation: ProactiveRecommendation; timestamp: string }
  | { type: "notification.created"; runId: string; notification: ProactiveNotification; timestamp: string };

export type ProactiveEventListener = (event: ProactiveEvent) => void;

export class ProactiveEventBus {
  private readonly listeners = new Set<ProactiveEventListener>();

  subscribe(listener: ProactiveEventListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(event: ProactiveEvent) {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  clear() {
    this.listeners.clear();
  }
}
