import type {
  AgentExecutionContext,
  AgentExecutionEvent,
  AgentExecutionEventType,
  AgentLanguageModelClient,
  AgentModule,
  AgentRunResult,
  AgentSharedState,
  AgentTask,
  AgentToolContext,
  AgentToolDefinition,
  AgentWorkflowInput,
  AgentWorkflowResult,
} from "@/agents/types";
import { AgentEventBus } from "@/agents/event-bus";
import { AgentLifecycleManager } from "@/agents/lifecycle";
import { createLanguageModelClient } from "@/agents/llm";
import { AgentRegistry, agentRegistry } from "@/agents/registry";
import { AgentTaskQueue } from "@/agents/task-queue";
import { AgentToolRegistry } from "@/agents/tools";
import { AgentTraceStore } from "@/agents/trace-store";
import { createAgentId, nowIso, normalizeText } from "@/agents/utils";

function createEvent(
  runId: string,
  traceId: string,
  type: AgentExecutionEventType,
  message: string,
  options?: Partial<Pick<AgentExecutionEvent, "agentName" | "taskId" | "level" | "data">>,
): AgentExecutionEvent {
  return {
    id: createAgentId("event"),
    runId,
    traceId,
    type,
    timestamp: nowIso(),
    level: options?.level ?? "info",
    message,
    agentName: options?.agentName,
    taskId: options?.taskId,
    data: options?.data,
  };
}

function createRootTask(input: AgentWorkflowInput, runId: string): AgentTask {
  return {
    id: createAgentId("task"),
    type: "workflow.start",
    targetAgent: input.entryAgent ?? "memory-agent",
    payload: { prompt: input.prompt, conversationId: input.conversationId ?? null },
    priority: 100,
    attempt: 0,
    maxRetries: 1,
    createdAt: nowIso(),
    correlationId: runId,
  };
}

function describeTaskStart(task: AgentTask) {
  if (task.targetAgent === "memory-agent") return "searching long-term vector memory...";
  if (task.targetAgent === "research-agent") return "scanning drive for interview resources...";
  if (task.targetAgent === "planner-agent") return "creating preparation milestones...";
  if (task.targetAgent === "scheduler-agent") return "generating optimized calendar blocks...";
  if (task.targetAgent === "email-agent") return "drafting follow-up communication...";
  return `running ${task.type}...`;
}

function composeFinalMessage(sharedState: AgentSharedState, prompt: string) {
  const memoryFindings = sharedState.results.memoryFindings as
    | { memories: Array<{ id: string; content: string; sourceApp: string; importanceScore: number }> }
    | undefined;
  const researchFindings = sharedState.results.researchFindings as
    | { items: Array<{ id: string; type: string; title: string; summary: string }> }
    | undefined;
  const plan = sharedState.results.plan as
    | { milestones: string[]; weeklyFocus: string[]; supportingReferences: string[] }
    | undefined;
  const schedule = sharedState.results.schedule as
    | { blocks: Array<{ day: string; start: string; end: string; focus: string }> }
    | undefined;
  const emailDraft = sharedState.results.emailDraft as
    | { subject: string; body: string; recipients: string[] }
    | undefined;

  const lines: string[] = [
    `i parsed your request: "${normalizeText(prompt)}"`,
    "",
    `retrieved memories:`,
  ];

  for (const [index, memory] of (memoryFindings?.memories ?? []).slice(0, 3).entries()) {
    lines.push(`${index + 1}. ${memory.content.toLowerCase()} (source: ${memory.sourceApp.toLowerCase()}, score: ${memory.importanceScore.toFixed(2)})`);
  }

  lines.push("", "workspace context:", ...(researchFindings?.items ?? []).slice(0, 3).map((item, index) => `${index + 1}. ${item.title.toLowerCase()} - ${item.summary.toLowerCase()}`));
  lines.push("", "generated plan:", ...(plan?.milestones ?? []).map((milestone, index) => `${index + 1}. ${milestone.toLowerCase()}`));
  lines.push("", "calendar blocks:", ...(schedule?.blocks ?? []).map((block, index) => `${index + 1}. ${block.day.toLowerCase()} ${block.start}-${block.end}: ${block.focus.toLowerCase()}`));

  if (emailDraft) {
    lines.push(
      "",
      "email draft:",
      `subject: ${emailDraft.subject.toLowerCase()}`,
      `body: ${emailDraft.body.toLowerCase()}`,
      `recipients: ${emailDraft.recipients.map((recipient) => recipient.toLowerCase()).join(", ")}`,
    );
  }

  lines.push("", "the coordinator has stitched these signals into a single execution graph with memory retrieval, research, planning, and scheduling.");
  return lines.join("\n");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class AgentOrchestrator {
  private readonly registry: AgentRegistry;
  private readonly eventBus: AgentEventBus;
  private readonly traceStore: AgentTraceStore;
  private readonly lifecycle: AgentLifecycleManager;
  private readonly tools: AgentToolRegistry;
  private readonly llm: AgentLanguageModelClient;

  constructor(dependencies?: {
    registry?: AgentRegistry;
    eventBus?: AgentEventBus;
    traceStore?: AgentTraceStore;
    lifecycle?: AgentLifecycleManager;
    tools?: AgentToolRegistry;
    llm?: AgentLanguageModelClient;
  }) {
    this.registry = dependencies?.registry ?? agentRegistry;
    this.eventBus = dependencies?.eventBus ?? new AgentEventBus();
    this.traceStore = dependencies?.traceStore ?? new AgentTraceStore();
    this.lifecycle = dependencies?.lifecycle ?? new AgentLifecycleManager();
    this.tools = dependencies?.tools ?? new AgentToolRegistry();
    this.llm = dependencies?.llm ?? createLanguageModelClient();
  }

  registerAgent(module: AgentModule) {
    this.registry.register(module);
    this.lifecycle.register(module.definition);
    return this;
  }

  registerTool(tool: AgentToolDefinition<any, any>) {
    this.tools.register(tool);
    return this;
  }

  listAgentStates() {
    return this.lifecycle.list();
  }

  getTrace(runId: string) {
    return this.traceStore.list(runId);
  }

  subscribe(listener: (event: AgentExecutionEvent) => void) {
    return this.eventBus.subscribe(listener);
  }

  private createContext<TPayload>(
    workflowInput: AgentWorkflowInput,
    runId: string,
    traceId: string,
    task: AgentTask<TPayload>,
    sharedState: AgentSharedState,
    emitEvent: (event: AgentExecutionEvent) => void,
    queue: AgentTaskQueue,
  ): AgentExecutionContext<TPayload> {
    return {
      runId,
      traceId,
      rootPrompt: workflowInput.prompt,
      task,
      sharedState,
      llm: this.llm,
      emit: emitEvent,
      enqueue: (nextTask) => queue.enqueue(nextTask),
      delegate: (targetAgent, type, payload, options) => ({
        id: createAgentId("task"),
        type,
        targetAgent,
        sourceAgent: task.targetAgent,
        payload,
        priority: options?.priority ?? task.priority - 1,
        attempt: 0,
        maxRetries: options?.maxRetries ?? 1,
        createdAt: nowIso(),
        dueAt: options?.dueAt,
        correlationId: runId,
      }),
      invokeTool: async <TInput, TOutput>(toolName: string, toolInput: TInput) => {
        const startedAt = nowIso();
        const prompt = task.payload && typeof task.payload === "object" && "prompt" in task.payload ? String((task.payload as { prompt?: unknown }).prompt ?? workflowInput.prompt) : workflowInput.prompt;
        emitEvent(
          createEvent(runId, traceId, "tool.invoked", `invoking tool ${toolName}`, {
            agentName: task.targetAgent,
            taskId: task.id,
            level: "info",
            data: { toolName, input: toolInput },
          }),
        );

        try {
          const output = await this.tools.invoke<TInput, TOutput>(toolName, toolInput, {
            runId,
            taskId: task.id,
            agentName: task.targetAgent,
            prompt,
            sharedState,
          } satisfies AgentToolContext);

          emitEvent(
            createEvent(runId, traceId, "tool.completed", `tool ${toolName} completed`, {
              agentName: task.targetAgent,
              taskId: task.id,
              level: "success",
              data: { toolName, startedAt, completedAt: nowIso(), output },
            }),
          );

          return output;
        } catch (error) {
          emitEvent(
            createEvent(runId, traceId, "tool.completed", `tool ${toolName} failed`, {
              agentName: task.targetAgent,
              taskId: task.id,
              level: "error",
              data: { toolName, startedAt, completedAt: nowIso(), error: error instanceof Error ? error.message : "unknown error" },
            }),
          );
          throw error;
        }
      },
      log: (level, message, data) => {
        emitEvent(
          createEvent(runId, traceId, "agent.log", message, {
            agentName: task.targetAgent,
            taskId: task.id,
            level,
            data,
          }),
        );
      },
      now: nowIso,
    };
  }

  async *streamWorkflow(input: AgentWorkflowInput): AsyncGenerator<AgentExecutionEvent, AgentWorkflowResult> {
    const runId = createAgentId("run");
    const traceId = createAgentId("trace");
    const queue = new AgentTaskQueue();
    const events: AgentExecutionEvent[] = [];
    const sharedState: AgentSharedState = {
      memories: structuredClone(input.memories),
      contextItems: structuredClone(input.contextItems),
      agentStates: structuredClone(input.agentStates.length > 0 ? input.agentStates : this.lifecycle.list()),
      conversations: structuredClone(input.conversations ?? []),
      signals: [],
      artifacts: [],
      results: {},
    };

    const emitEvent = (event: AgentExecutionEvent) => {
      events.push(event);
      this.traceStore.append(event);
      this.eventBus.emit(event);
      return event;
    };

    const rootTask = createRootTask(input, runId);

    queue.enqueue(rootTask);
    emitEvent(createEvent(runId, traceId, "workflow.started", "agent workflow started", { level: "info", data: { prompt: input.prompt } }));
    yield events[events.length - 1];
    emitEvent(createEvent(runId, traceId, "task.enqueued", "root task queued", { taskId: rootTask.id, agentName: rootTask.targetAgent, data: { taskType: rootTask.type } }));
    yield events[events.length - 1];

    while (!queue.isEmpty()) {
      const task = queue.dequeue();
      if (!task) break;

      const registration = this.registry.get(task.targetAgent);
      if (!registration) {
        this.lifecycle.markFailed(task.targetAgent, task.type, 100);
        emitEvent(
          createEvent(runId, traceId, "task.failed", `no registered agent found for ${task.targetAgent}`, {
            agentName: task.targetAgent,
            taskId: task.id,
            level: "error",
          }),
        );
        yield events[events.length - 1];
        continue;
      }

      if (!registration.module.canHandle(task)) {
        this.lifecycle.markFailed(task.targetAgent, task.type, 100);
        emitEvent(
          createEvent(runId, traceId, "task.failed", `${task.targetAgent} cannot handle ${task.type}`, {
            agentName: task.targetAgent,
            taskId: task.id,
            level: "error",
          }),
        );
        yield events[events.length - 1];
        continue;
      }

      const currentState = this.lifecycle.markRunning(task.targetAgent, task.type, task.attempt > 0 ? 35 : 15);
      sharedState.agentStates = sharedState.agentStates.map((state) => (state.agentName === currentState.agentName ? currentState : state));

      emitEvent(
        createEvent(runId, traceId, "task.started", describeTaskStart(task), {
          agentName: task.targetAgent,
          taskId: task.id,
          level: "info",
          data: { taskType: task.type, progressPercentage: currentState.progressPercentage, state: currentState, currentTask: describeTaskStart(task) },
        }),
      );
      yield events[events.length - 1];

      try {
        const context = this.createContext(input, runId, traceId, task, sharedState, emitEvent, queue);
        const result: AgentRunResult = await registration.module.run(context);

        if (result.llmUsage) {
          const currentUsage = (sharedState.results.llmUsage as Record<string, unknown> | undefined) ?? {};
          sharedState.results.llmUsage = {
            ...currentUsage,
            [task.targetAgent]: result.llmUsage,
          };
        }

        if (result.agentStatePatch) {
          const updated = this.lifecycle.update(task.targetAgent, {
            ...currentState,
            ...result.agentStatePatch,
            status: result.status === "succeeded" ? "completed" : result.status === "failed" ? "error" : currentState.status,
          });
          sharedState.agentStates = sharedState.agentStates.map((state) => (state.agentName === updated.agentName ? updated : state));
        } else {
          const updated = this.lifecycle.update(task.targetAgent, {
            status: result.status === "succeeded" ? "completed" : result.status === "failed" ? "error" : currentState.status,
            currentTask: result.summary,
            progressPercentage: result.progressPercentage,
          });
          sharedState.agentStates = sharedState.agentStates.map((state) => (state.agentName === updated.agentName ? updated : state));
        }

        if (result.artifacts?.length) {
          sharedState.artifacts.push(...result.artifacts);
        }

        if (result.delegations?.length) {
          for (const delegation of result.delegations) {
            queue.enqueue(delegation);
            emitEvent(
              createEvent(runId, traceId, "agent.delegated", `${task.targetAgent} delegated to ${delegation.targetAgent}`, {
                agentName: task.targetAgent,
                taskId: task.id,
                level: "info",
                data: {
                  delegatedTaskId: delegation.id,
                  delegatedTaskType: delegation.type,
                  delegatedAgent: delegation.targetAgent,
                },
              }),
            );
            yield events[events.length - 1];
          }
        }

        emitEvent(
          createEvent(runId, traceId, "task.completed", `${task.targetAgent} completed ${task.type}`, {
            agentName: task.targetAgent,
              taskId: task.id,
              level: "success",
              data: {
                summary: result.summary,
                output: result.output,
                progressPercentage: result.progressPercentage,
                llmUsage: result.llmUsage,
              },
            }),
        );
        yield events[events.length - 1];
        await sleep(40);
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown failure";

        if (task.attempt < task.maxRetries) {
          const retryTask = {
            ...task,
            attempt: task.attempt + 1,
            createdAt: nowIso(),
            priority: task.priority - 1,
          };
          queue.enqueue(retryTask);
          emitEvent(
            createEvent(runId, traceId, "task.retried", `${task.targetAgent} retry scheduled`, {
              agentName: task.targetAgent,
              taskId: task.id,
              level: "warning",
              data: { retryAttempt: retryTask.attempt, error: message },
            }),
          );
          yield events[events.length - 1];
          continue;
        }

        this.lifecycle.markFailed(task.targetAgent, task.type, 100);
        emitEvent(
          createEvent(runId, traceId, "task.failed", `${task.targetAgent} failed: ${message}`, {
            agentName: task.targetAgent,
            taskId: task.id,
            level: "error",
            data: { error: message },
          }),
        );
        yield events[events.length - 1];
      }
    }

    const finalMessage = composeFinalMessage(sharedState, input.prompt);
    emitEvent(
      createEvent(runId, traceId, "workflow.completed", "agent workflow completed", {
        level: "success",
        data: {
          finalMessage,
          traceCount: events.length,
        },
      }),
    );
    yield events[events.length - 1];

    return {
      runId,
      finalMessage,
      events,
      trace: this.traceStore.list(runId),
      sharedState,
    };
  }

  async executeWorkflow(input: AgentWorkflowInput) {
    const iterator = this.streamWorkflow(input);
    let next = await iterator.next();
    while (!next.done) {
      next = await iterator.next();
    }
    return next.value;
  }
}
