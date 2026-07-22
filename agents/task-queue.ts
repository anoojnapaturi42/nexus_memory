import type { AgentTask } from "@/agents/types";

export class AgentTaskQueue {
  private readonly items: AgentTask[] = [];

  enqueue(task: AgentTask) {
    this.items.push(task);
    this.items.sort((left, right) => {
      if (left.priority !== right.priority) return right.priority - left.priority;
      if (left.createdAt !== right.createdAt) return Date.parse(left.createdAt) - Date.parse(right.createdAt);
      return left.attempt - right.attempt;
    });
  }

  dequeue() {
    return this.items.shift() ?? null;
  }

  peek() {
    return this.items[0] ?? null;
  }

  isEmpty() {
    return this.items.length === 0;
  }

  get size() {
    return this.items.length;
  }

  snapshot() {
    return [...this.items];
  }

  clear() {
    this.items.length = 0;
  }
}
