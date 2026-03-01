import { MongoClient, type Collection } from "mongodb";
import type { Workflow, Task, TaskResult } from "@/types";

const uri = () => process.env.MONGODB_URI ?? "";
let client: MongoClient | null = null;

async function getClient(): Promise<MongoClient> {
  const u = uri();
  if (!u) throw new Error("MONGODB_URI not set");
  if (!client) client = new MongoClient(u);
  return client;
}

export interface WorkflowSummary {
  workflowId: string;
  input: string;
  status: string;
  taskCount: number;
  completedAt?: number;
  createdAt: number;
}

/** Full archive payload: user input, task results, agent assignments, execution times. */
export interface WorkflowArchiveRecord {
  workflowId: string;
  input: string;
  status: string;
  createdAt: number;
  completedAt?: number;
  synthesizedResult?: string;
  tasks: Array<{
    logicalId: string;
    description: string;
    assignedAgentId?: string;
    result?: { success: boolean; data: unknown; executionTimeMs: number };
    executionTimeMs?: number;
  }>;
}

export interface AgentStats {
  agentId: string;
  totalTasks: number;
  successRate: number;
  avgScore: number;
  avgExecutionTimeMs: number;
  domains: string[];
}

export class ExecutionStore {
  private async workflows(): Promise<Collection<WorkflowSummary & { _id?: string }>> {
    const c = await getClient();
    return c.db().collection("workflow_history");
  }

  private async agentProfiles(): Promise<Collection<Record<string, unknown>>> {
    const c = await getClient();
    return c.db().collection("agent_profiles");
  }

  private async metrics(): Promise<Collection<Record<string, unknown>>> {
    const c = await getClient();
    return c.db().collection("execution_metrics");
  }

  async archiveWorkflow(workflow: Workflow, tasks: Task[]): Promise<void>;
  async archiveWorkflow(record: WorkflowArchiveRecord): Promise<void>;
  async archiveWorkflow(
    workflowOrRecord: Workflow | WorkflowArchiveRecord,
    tasks?: Task[]
  ): Promise<void> {
    if (!uri()) return;
    try {
      const col = await this.workflows();
      if (tasks !== undefined && "id" in workflowOrRecord) {
        const w = workflowOrRecord as Workflow;
        await col.insertOne({
          workflowId: w.id,
          input: w.input,
          status: w.status,
          taskCount: tasks.length,
          completedAt: w.completedAt,
          createdAt: w.createdAt,
        } as WorkflowSummary & { _id?: string });
        return;
      }
      const r = workflowOrRecord as WorkflowArchiveRecord;
      await col.insertOne({
        workflowId: r.workflowId,
        input: r.input,
        status: r.status,
        taskCount: r.tasks?.length ?? 0,
        completedAt: r.completedAt,
        createdAt: r.createdAt,
        synthesizedResult: r.synthesizedResult,
        tasks: r.tasks ?? [],
      } as WorkflowSummary & { _id?: string });
    } catch {
      // non-blocking
    }
  }

  async updateAgentProfile(
    agentId: string,
    taskResult: TaskResult,
    domain: string,
    taskScore?: number
  ): Promise<void> {
    if (!uri()) return;
    try {
      const col = await this.agentProfiles();
      const update: Record<string, unknown> = {
        $inc: {
          totalTasks: 1,
          successCount: taskResult.success ? 1 : 0,
          ...(typeof taskScore === "number" && !Number.isNaN(taskScore) ? { totalScore: taskScore } : {}),
        },
        $push: { domains: domain },
        $set: { lastUpdated: Date.now() },
      };
      await col.updateOne({ agentId }, update, { upsert: true });
    } catch {
      // ignore
    }
  }

  async getAgentStats(agentId: string): Promise<AgentStats | null> {
    if (!uri()) return null;
    try {
      const col = await this.agentProfiles();
      const doc = (await col.findOne({ agentId })) as {
        totalTasks?: number;
        successCount?: number;
        totalScore?: number;
        domains?: string[];
      } | null;
      if (!doc) return null;
      const total = doc.totalTasks ?? 0;
      const success = doc.successCount ?? 0;
      const totalScore = doc.totalScore ?? 0;
      return {
        agentId,
        totalTasks: total,
        successRate: total > 0 ? success / total : 0,
        avgScore: total > 0 ? totalScore / total : 0,
        avgExecutionTimeMs: 0,
        domains: Array.from(new Set(doc.domains ?? [])),
      };
    } catch {
      return null;
    }
  }

  async getWorkflowHistory(limit: number): Promise<WorkflowSummary[]> {
    if (!uri()) return [];
    try {
      const col = await this.workflows();
      const cursor = col.find({}).sort({ createdAt: -1 }).limit(limit);
      return (await cursor.toArray()) as WorkflowSummary[];
    } catch {
      return [];
    }
  }
}
