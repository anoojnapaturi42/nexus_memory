import type { AgentToolContext, AgentToolDefinition } from "@/agents/types";

export class AgentToolRegistry {
  private readonly tools = new Map<string, AgentToolDefinition<any, any>>();

  register<TInput = unknown, TOutput = unknown>(tool: AgentToolDefinition<TInput, TOutput>) {
    this.tools.set(tool.name, tool);
    return tool;
  }

  has(toolName: string) {
    return this.tools.has(toolName);
  }

  list() {
    return Array.from(this.tools.values());
  }

  async invoke<TInput = unknown, TOutput = unknown>(toolName: string, input: TInput, context: AgentToolContext) {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`unknown tool: ${toolName}`);
    }

    return tool.invoke(input, context) as Promise<TOutput>;
  }
}
