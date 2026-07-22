import { randomUUID } from "node:crypto";
import { BaseDatabaseRepository } from "@/repositories/database/base-repository";
import { mockDatabaseAgentLogs } from "@/mock/database";
import type { AgentLogEntry, AgentThoughtStep } from "@/types/chat";
import type {
  DatabaseAgentLogRecord,
  DatabaseJson,
  DatabaseListResult,
  DatabaseMutationResult,
} from "@/types/database";
import type { DatabaseRuntime } from "@/lib/database/client";
import { buildSelectByColumnQuery } from "@/lib/database/query-utils";

type AgentLogInsert = Omit<DatabaseAgentLogRecord, "created_at" | "updated_at"> & {
  created_at?: string;
  updated_at?: string;
};

function normalizeLogs(value: DatabaseJson | unknown): AgentLogEntry[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      id: String(item.id ?? randomUUID()),
      agentName: String(item.agentName ?? item.agent_name ?? "agent"),
      timestamp: String(item.timestamp ?? new Date().toISOString()),
      message: String(item.message ?? ""),
      level: (item.level as AgentLogEntry["level"]) ?? "info",
    }));
}

function toMetadata(input: AgentLogInsert): Record<string, DatabaseJson> {
  const metadata = input.metadata ?? {};
  const logs = (metadata.logs as unknown) ?? [];

  return {
    ...metadata,
    logs: Array.isArray(logs) ? logs : [],
  };
}

export class AgentLogDatabaseRepository extends BaseDatabaseRepository<
  DatabaseAgentLogRecord,
  AgentLogInsert,
  Partial<AgentLogInsert>
> {
  protected fallbackRows = mockDatabaseAgentLogs;

  constructor(runtime?: DatabaseRuntime) {
    super("agent_logs", runtime);
  }

  protected fromRow(row: Record<string, unknown>): DatabaseAgentLogRecord {
    return {
      id: String(row.id ?? randomUUID()),
      conversation_id: (row.conversation_id as string | null) ?? null,
      agent_name: String(row.agent_name ?? ""),
      status: String(row.status ?? "idle"),
      current_task: String(row.current_task ?? ""),
      started_at: String(row.started_at ?? new Date().toISOString()),
      finished_at: (row.finished_at as string | null) ?? null,
      progress_percentage: Number(row.progress_percentage ?? 0),
      metadata: (row.metadata as Record<string, DatabaseJson>) ?? {},
      created_at: String(row.created_at ?? new Date().toISOString()),
      updated_at: String(row.updated_at ?? new Date().toISOString()),
    };
  }

  protected toInsertPayload(input: AgentLogInsert): Record<string, unknown> {
    return {
      ...input,
      conversation_id: input.conversation_id ?? null,
      metadata: toMetadata(input),
      created_at: input.created_at ?? new Date().toISOString(),
      updated_at: input.updated_at ?? new Date().toISOString(),
    };
  }

  protected toUpdatePayload(input: Partial<AgentLogInsert>): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      ...input,
      updated_at: new Date().toISOString(),
    };

    if ("metadata" in payload) {
      payload.metadata = {
        ...(payload.metadata as Record<string, DatabaseJson> | undefined),
        logs: Array.isArray((payload.metadata as Record<string, unknown> | undefined)?.logs)
          ? ((payload.metadata as Record<string, unknown>).logs as DatabaseJson[])
          : [],
      };
    }

    return payload;
  }

  protected createFallbackRecord(input: AgentLogInsert): DatabaseAgentLogRecord {
    const now = new Date().toISOString();
    return {
      id: input.id ?? randomUUID(),
      conversation_id: input.conversation_id ?? null,
      agent_name: input.agent_name,
      status: input.status,
      current_task: input.current_task,
      started_at: input.started_at,
      finished_at: input.finished_at ?? null,
      progress_percentage: input.progress_percentage,
      metadata: toMetadata(input),
      created_at: input.created_at ?? now,
      updated_at: input.updated_at ?? now,
    };
  }

  protected applyFallbackUpdate(record: DatabaseAgentLogRecord, input: Partial<AgentLogInsert>): DatabaseAgentLogRecord {
    return {
      ...record,
      ...input,
      conversation_id: Object.prototype.hasOwnProperty.call(input, "conversation_id")
        ? input.conversation_id ?? null
        : record.conversation_id,
      metadata: input.metadata ? toMetadata({ ...record, ...input } as AgentLogInsert) : record.metadata,
      updated_at: new Date().toISOString(),
    };
  }

  toThoughtStep(record: DatabaseAgentLogRecord): AgentThoughtStep {
    return {
      id: record.id,
      agentName: record.agent_name,
      status: record.status as AgentThoughtStep["status"],
      progressPercentage: record.progress_percentage,
      currentTask: record.current_task,
      timestamp: record.started_at,
      logs: normalizeLogs(record.metadata.logs),
    };
  }

  async listByConversationId(
    conversationId: string,
    limit = 100,
    offset = 0,
  ): Promise<DatabaseListResult<DatabaseAgentLogRecord>> {
    if (this.pool) {
      try {
        const { text, values } = buildSelectByColumnQuery("agent_logs", "conversation_id", conversationId, {
          limit,
          offset,
          orderBy: "started_at desc",
        });
        const result = await this.pool.query(text, values);
        return {
          source: "postgres",
          items: result.rows.map((row) => this.fromRow(row as Record<string, unknown>)),
        };
      } catch {
        // fall through to the next available source
      }
    }

    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from("agent_logs")
          .select("*")
          .eq("conversation_id", conversationId)
          .order("started_at", { ascending: false })
          .range(offset, offset + limit - 1);

        if (!error) {
          return {
            source: "supabase",
            items: (data ?? []).map((row) => this.fromRow(row as Record<string, unknown>)),
          };
        }
      } catch {
        // fall through to the mock repository snapshot
      }
    }

    return {
      source: "mock",
      items: this.cloneFallbackRows()
        .filter((row) => row.conversation_id === conversationId)
        .slice(offset, offset + limit),
    };
  }

  async saveThoughtSteps(
    conversationId: string,
    steps: AgentThoughtStep[],
  ): Promise<DatabaseMutationResult<DatabaseAgentLogRecord>[]> {
    const saved: DatabaseMutationResult<DatabaseAgentLogRecord>[] = [];

    for (const step of steps) {
      const payload: AgentLogInsert = {
        id: step.id,
        conversation_id: conversationId,
        agent_name: step.agentName,
        status: step.status,
        current_task: step.currentTask,
        started_at: step.timestamp,
        finished_at: step.status === "completed" || step.status === "error" ? step.timestamp : null,
        progress_percentage: step.progressPercentage,
        metadata: {
          logs: step.logs,
          stepId: step.id,
        },
      };

      const existing = await this.getById(step.id);
      const result = existing.item ? await this.update(step.id, payload) : await this.insert(payload);
      if (result) {
        saved.push(result);
      }
    }

    return saved;
  }

  async getThoughtSteps(conversationId: string): Promise<AgentThoughtStep[]> {
    const result = await this.listByConversationId(conversationId);
    return result.items.map((item) => this.toThoughtStep(item));
  }
}

export const agentLogDatabaseRepository = new AgentLogDatabaseRepository();
