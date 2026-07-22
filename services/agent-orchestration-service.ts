//wraps the internal agent coordinator 
import { mockAgentExecutionEngine } from "@/agents";
import type { AgentExecutionEvent, AgentWorkflowInput, AgentWorkflowResult } from "@/agents/types";
import type { AgentModule, AgentName } from "@/agents/types";

export class AgentOrchestrationService {
  constructor(private readonly engine = mockAgentExecutionEngine) {}

  streamWorkflow(input: AgentWorkflowInput): AsyncGenerator<AgentExecutionEvent, AgentWorkflowResult> {
    return this.engine.streamWorkflow(input);
  }

  executeWorkflow(input: AgentWorkflowInput) {
    return this.engine.executeWorkflow(input);
  }

  registerAgent(module: AgentModule) {
    this.engine.registerAgent(module);
    return this;
  }

  listAgentStates() {
    return this.engine.listAgentStates();
  }

  getTrace(runId: string) {
    return this.engine.getTrace(runId);
  }

  subscribe(listener: (event: AgentExecutionEvent) => void) {
    return this.engine.subscribe(listener);
  }

  getAgentState(agentName: AgentName) {
    const normalized = agentName.replace(/-/g, " ").toLowerCase();
    return (
      this.listAgentStates().find((state) => {
        const stateName = state.agentName.toLowerCase();
        return stateName === normalized || stateName.replace(/\s+/g, "-") === agentName;
      }) ?? null
    );
  }
}

export const agentOrchestrationService = new AgentOrchestrationService();
