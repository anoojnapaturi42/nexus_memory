import type { AgentDefinition, AgentModule, AgentName } from "@/agents/types";

export type AgentRegistration = {
  definition: AgentDefinition;
  module: AgentModule;
  registeredAt: string;
};

export class AgentRegistry {
  private readonly registrations = new Map<AgentName, AgentRegistration>();

  register(module: AgentModule) {
    this.registrations.set(module.definition.id, {
      definition: module.definition,
      module,
      registeredAt: new Date().toISOString(),
    });
    return module;
  }

  registerMany(modules: AgentModule[]) {
    for (const module of modules) {
      this.register(module);
    }
    return this;
  }

  get(agentName: AgentName) {
    return this.registrations.get(agentName) ?? null;
  }

  has(agentName: AgentName) {
    return this.registrations.has(agentName);
  }

  list() {
    return Array.from(this.registrations.values()).map((registration) => ({
      definition: structuredClone(registration.definition),
      registeredAt: registration.registeredAt,
    }));
  }

  definitions() {
    return Array.from(this.registrations.values()).map((registration) => registration.definition);
  }
}

export const agentRegistry = new AgentRegistry();
