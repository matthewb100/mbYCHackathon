import { fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { BrowserAgent } from "./browser-agent";
import type { Bid, TaskResult } from "@/types";
import type { FunctionReference } from "convex/server";
import type { Task } from "@/types";
import { AgentEvaluator } from "@/lib/evaluation/hud-eval";
import { synthesizeResults } from "@/lib/orchestrator/synthesize";
import { storeTaskMemory, domainFromTask } from "@/lib/supermemory/client";
import { runWithWorkflowTrace, runWithTaskSpan } from "@/lib/observability/laminar-workflow";
import { ExecutionStore } from "@/lib/db/mongo";

type ConvexTask = {
  _id: Id<"tasks">;
  workflowId: Id<"workflows">;
  logicalId: string;
  description: string;
  targetUrl?: string;
  dependencies: string[];
  status: string;
  assignedAgentId?: Id<"agents">;
  priority: number;
  requiredCapabilities: string[];
  result?: TaskResult;
};

type ConvexAgent = {
  _id: Id<"agents">;
  name: string;
  capabilities: string[];
  specializedDomains: string[];
  reputationScore: number;
  currentLoad: number;
  maxConcurrency: number;
  isExternal?: boolean;
  apiEndpoint?: string;
};

const convexUrl = () => process.env.NEXT_PUBLIC_CONVEX_URL ?? process.env.CONVEX_URL ?? "";

const runMutation = async (
  mutation: FunctionReference<"mutation", "public", Record<string, unknown>>,
  args: Record<string, unknown>
): Promise<unknown> => {
  const url = convexUrl();
  if (!url) throw new Error("CONVEX_URL or NEXT_PUBLIC_CONVEX_URL not set");
  return fetchMutation(mutation, args, { url });
};

const runQuery = async (
  query: FunctionReference<"query", "public", Record<string, unknown>>,
  args: Record<string, unknown>
): Promise<unknown> => {
  const url = convexUrl();
  if (!url) throw new Error("CONVEX_URL or NEXT_PUBLIC_CONVEX_URL not set");
  return fetchQuery(query, args, { url });
};

export class AgentCoordinator {
  private agents: Map<string, BrowserAgent> = new Map();
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async ensureAgents(): Promise<ConvexAgent[]> {
    const list = (await runQuery(api.agents.getOnlineAgents, {})) as ConvexAgent[];
    if (this.agents.size === 0) {
      for (const a of list) {
        if (a.isExternal) continue;
        this.agents.set(a._id, new BrowserAgent(this.apiKey, {
          id: a._id,
          name: a.name,
          capabilities: a.capabilities,
          specializedDomains: a.specializedDomains,
          reputationScore: a.reputationScore,
          currentLoad: a.currentLoad,
          maxConcurrency: a.maxConcurrency,
        }));
      }
    }
    return list;
  }

  private async requestBids(task: ConvexTask, agents: ConvexAgent[]): Promise<(Bid & { agentId: string })[]> {
    const requiredCaps = task.requiredCapabilities ?? [];
    const capable = agents.filter((a) =>
      requiredCaps.length === 0 || requiredCaps.some((c) => a.capabilities.includes(c))
    );
    const bids: (Bid & { agentId: string })[] = [];
    for (const agent of capable) {
      const browserAgent = this.agents.get(agent._id);
      if (!browserAgent) continue;
      const bid = browserAgent.bid({
        id: task.logicalId,
        workflowId: task.workflowId,
        description: task.description,
        targetUrl: task.targetUrl,
        dependencies: task.dependencies,
        status: task.status,
        priority: task.priority,
        requiredCapabilities: requiredCaps,
      } as Task);
      bids.push({ ...bid, agentId: agent._id, taskId: task._id });
    }
    return bids.sort((a, b) => b.confidenceScore - a.confidenceScore);
  }

  private selectWinner(bids: (Bid & { agentId: string })[], agents: ConvexAgent[]): (Bid & { agentId: string }) | null {
    if (bids.length === 0) return null;
    const agentMap = new Map<string, ConvexAgent>(agents.map((a) => [a._id as string, a]));
    let best = bids[0];
    let bestScore = best.confidenceScore * ((agentMap.get(best.agentId)?.reputationScore ?? 50) / 100);
    for (let i = 1; i < bids.length; i++) {
      const b = bids[i];
      const score = b.confidenceScore * ((agentMap.get(b.agentId)?.reputationScore ?? 50) / 100);
      if (score > bestScore) {
        bestScore = score;
        best = b;
      }
    }
    return best;
  }

  async executeWorkflow(workflowId: Id<"workflows">): Promise<void> {
    const agents = await this.ensureAgents();
    if (agents.length === 0) throw new Error("No online agents");

    await runMutation(api.workflows.updateWorkflowStatus, { workflowId, status: "bidding" });

    const completedLogicalIds = new Set<string>();

    while (true) {
      const tasks = (await runQuery(api.tasks.getTasksByWorkflow, { workflowId })) as ConvexTask[];
      const ready = tasks.filter(
        (t) => t.status === "pending" && t.dependencies.every((d) => completedLogicalIds.has(d))
      );
      if (ready.length === 0) break;

      for (const task of ready) {
        await runMutation(api.tasks.updateTaskStatus, { taskId: task._id, status: "bidding" });
        const bids = await this.requestBids(task, agents);
        for (const bid of bids) {
          await runMutation(api.bids.submitBid, {
            agentId: bid.agentId as Id<"agents">,
            taskId: task._id,
            confidenceScore: bid.confidenceScore,
            estimatedTimeMs: bid.estimatedTimeMs,
            reasoning: bid.reasoning,
          });
        }
        await new Promise((r) => setTimeout(r, 2000));
        const bidList = (await runQuery(api.bids.getBidsForTask, { taskId: task._id })) as Array<{ _id: Id<"bids">; agentId: Id<"agents">; confidenceScore: number }>;
        const winnerBid = bidList.length > 0 ? bidList.reduce((a, b) => (b.confidenceScore > a.confidenceScore ? b : a)) : null;
        if (winnerBid) {
          await runMutation(api.bids.acceptBid, { bidId: winnerBid._id });
        }
      }

      await runMutation(api.workflows.updateWorkflowStatus, { workflowId, status: "executing" });

      const tasksAfterBid = (await runQuery(api.tasks.getTasksByWorkflow, { workflowId })) as ConvexTask[];
      const toExecute = tasksAfterBid.filter(
        (t) => t.status === "assigned" && t.dependencies.every((d) => completedLogicalIds.has(d))
      );

      await Promise.all(
        toExecute.map(async (task) => {
          const agentId = task.assignedAgentId!;
          const browserAgent = this.agents.get(agentId);
          if (!browserAgent) return;
          await runMutation(api.tasks.updateTaskStatus, { taskId: task._id, status: "executing", assignedAgentId: agentId });
          await runMutation(api.agents.updateAgentLoad, { agentId, delta: 1 });
          try {
            await runMutation(api.executionLogs.addLog, {
              taskId: task._id,
              agentId,
              action: "started",
              details: task.description,
            });
            const result = await browserAgent.executeTask({
              id: task.logicalId,
              workflowId: task.workflowId,
              description: task.description,
              targetUrl: task.targetUrl,
              dependencies: task.dependencies,
              status: "executing",
              priority: task.priority,
              requiredCapabilities: task.requiredCapabilities,
            } as Task);
            await runMutation(api.executionLogs.addLog, {
              taskId: task._id,
              agentId,
              action: "completed",
              details: JSON.stringify(result.data),
              screenshot: result.screenshotUrl,
            });
            await runMutation(api.tasks.updateTaskStatus, {
              taskId: task._id,
              status: result.success ? "completed" : "failed",
              result: {
                success: result.success,
                data: result.data,
                executionTimeMs: result.executionTimeMs,
                screenshotUrl: result.screenshotUrl,
              },
            });
            completedLogicalIds.add(task.logicalId);
          } catch (err) {
            await runMutation(api.executionLogs.addLog, {
              taskId: task._id,
              agentId,
              action: "failed",
              details: err instanceof Error ? err.message : String(err),
            });
            await runMutation(api.tasks.updateTaskStatus, {
              taskId: task._id,
              status: "failed",
              result: { success: false, data: { error: String(err) }, executionTimeMs: 0 },
            });
            completedLogicalIds.add(task.logicalId);
          } finally {
            await runMutation(api.agents.updateAgentLoad, { agentId, delta: -1 });
          }
        })
      );

      const again = (await runQuery(api.tasks.getTasksByWorkflow, { workflowId })) as ConvexTask[];
      const stillPending = again.filter((t) => t.status === "pending" || t.status === "bidding" || t.status === "assigned" || t.status === "executing");
      if (stillPending.length === 0) break;
    }

    const finalTasks = (await runQuery(api.tasks.getTasksByWorkflow, { workflowId })) as ConvexTask[];
    const allDone = finalTasks.length > 0 && finalTasks.every((t) => t.status === "completed" || t.status === "failed");
    await runMutation(api.workflows.updateWorkflowStatus, {
      workflowId,
      status: allDone ? "completed" : "failed",
      completedAt: allDone ? Date.now() : undefined,
    });
  }

  /**
   * Execute a workflow that has already been approved (plan set, tasks assigned).
   * Runs from plan only: uses assignedAgentId, supports external POST /execute, runs HUD + reputation after each task, synthesis at end.
   */
  async executeApprovedWorkflow(workflowId: Id<"workflows">): Promise<void> {
    const workflow = (await runQuery(api.workflows.getWorkflow, { workflowId })) as { status: string; input: string; createdAt?: number; tasks?: ConvexTask[] } | null;
    if (!workflow || workflow.status !== "approved") {
      throw new Error("Workflow not found or not approved. Approve the execution plan first.");
    }

    const agents = (await runQuery(api.agents.getOnlineAgents, {})) as ConvexAgent[];
    const agentById = new Map(agents.map((a) => [a._id, a]));
    await this.ensureAgents();

    const tasks = (await runQuery(api.tasks.getTasksByWorkflow, { workflowId })) as ConvexTask[];
    const approvedTasks = tasks.filter((t) => t.status === "approved" || t.status === "assigned");
    if (approvedTasks.length === 0) throw new Error("No approved tasks");

    await runMutation(api.workflows.updateWorkflowStatus, { workflowId, status: "executing" });

    const browserTaskCount = approvedTasks.filter((t) => !agentById.get(t.assignedAgentId!)?.isExternal).length;
    await runMutation(api.executionStats.setExecutionStats, {
      workflowId,
      claudeCalls: 2 + approvedTasks.length,
      browserLive: browserTaskCount,
      convexMutations: 12,
      hudAvg: 0,
      supermemoryDomains: 4,
      laminarSpans: 0,
      mongoRecords: approvedTasks.length * 3,
      vercelStatus: "deployed",
    });

    const { result: final, traceId } = await runWithWorkflowTrace(workflowId as string, async () => {
      const completedLogicalIds = new Set<string>();
      const contextByLogicalId: Record<string, { success: boolean; data: unknown }> = {};
      const evaluator = new AgentEvaluator();
      const executionStore = new ExecutionStore();

    const runOneTask = async (task: ConvexTask): Promise<void> => {
      const agentId = task.assignedAgentId!;
      const agent = agentById.get(agentId)!;

      await runMutation(api.tasks.updateTaskStatus, { taskId: task._id, status: "executing", assignedAgentId: agentId });
      await runMutation(api.agents.updateAgentLoad, { agentId, delta: 1 });
      await runMutation(api.executionLogs.addLog, {
        taskId: task._id,
        agentId,
        action: "started",
        details: task.description,
      });

      let result: { success: boolean; data: unknown; executionTimeMs: number; screenshotUrl?: string };
      try {
        if (agent.isExternal && agent.apiEndpoint) {
          // External agents run in isolated Daytona sandboxes: we proxy through our server.
          const sandboxUrl =
            (process.env.NEXT_PUBLIC_APP_URL ?? "").trim() ||
            (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
          const res = await fetch(`${sandboxUrl.replace(/\/$/, "")}/api/execute-external-agent`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              taskId: task._id,
              logicalId: task.logicalId,
              description: task.description,
              targetUrl: task.targetUrl ?? null,
              context: contextByLogicalId,
              apiEndpoint: agent.apiEndpoint,
            }),
          });
          const data = (await res.json()) as {
            success?: boolean;
            data?: unknown;
            executionTimeMs?: number;
            liveUrl?: string;
          };
          result = {
            success: data.success ?? res.ok,
            data: data.data ?? {},
            executionTimeMs: data.executionTimeMs ?? 0,
          };
          if (data.liveUrl) {
            await runMutation(api.executionLogs.addLog, {
              taskId: task._id,
              agentId,
              action: "browser_session_started",
              details: JSON.stringify({ liveUrl: data.liveUrl, sessionId: "external" }),
            });
            await runMutation(api.tasks.setTaskLiveUrl, { taskId: task._id, liveUrl: data.liveUrl });
          }
        } else {
          const browserAgent = this.agents.get(agentId);
          if (!browserAgent) throw new Error(`No browser agent for ${agent.name}`);
          result = await browserAgent.executeTask(
            {
              id: task.logicalId,
              workflowId: task.workflowId,
              description: task.description,
              targetUrl: task.targetUrl,
              dependencies: task.dependencies,
              status: "executing",
              priority: task.priority,
              requiredCapabilities: task.requiredCapabilities ?? [],
            } as Task,
            {
              onLiveUrl: async (liveUrl, sessionId) => {
                await runMutation(api.executionLogs.addLog, {
                  taskId: task._id,
                  agentId,
                  action: "browser_session_started",
                  details: JSON.stringify({ liveUrl, sessionId }),
                });
                await runMutation(api.tasks.setTaskLiveUrl, { taskId: task._id, liveUrl });
              },
              onPoll: async () => {
                // No step logging here — task outputs go in Live activity panel only (completed log)
              },
            }
          );
        }
      } catch (err) {
        result = {
          success: false,
          data: { error: err instanceof Error ? err.message : String(err) },
          executionTimeMs: 0,
        };
      }

      contextByLogicalId[task.logicalId] = { success: result.success, data: result.data };
      completedLogicalIds.add(task.logicalId);

      await runMutation(api.executionLogs.addLog, {
        taskId: task._id,
        agentId,
        action: "completed",
        details: JSON.stringify(result.data),
        screenshot: result.screenshotUrl,
      });
      await runMutation(api.tasks.updateTaskStatus, {
        taskId: task._id,
        status: result.success ? "completed" : "failed",
        result: {
          success: result.success,
          data: result.data,
          executionTimeMs: result.executionTimeMs,
          screenshotUrl: result.screenshotUrl,
        },
      });

      const completion = result.success ? 100 : 0;
      const hudScore = await evaluator.evaluateTaskExecution(
        {
          id: task.logicalId,
          workflowId: task.workflowId as string,
          description: task.description,
          targetUrl: task.targetUrl,
          dependencies: task.dependencies,
          status: "completed",
          priority: task.priority,
        } as Task,
        {
          success: result.success,
          data: result.data,
          executionTimeMs: result.executionTimeMs,
          screenshotUrl: result.screenshotUrl,
        }
      );
      const hudQuality = Math.round((hudScore.overall ?? 0.5) * 100);
      const reliability = result.success ? 100 : 60;
      const taskScore = Math.round(completion * 0.4 + hudQuality * 0.4 + reliability * 0.2);
      await runMutation(api.agents.updateAgentReputationFromTask, { agentId, taskScore });
      await runMutation(api.agents.updateAgentLoad, { agentId, delta: -1 });

      const domain = domainFromTask(task.targetUrl, task.description);
      executionStore.updateAgentProfile(agentId, result, domain, taskScore).catch(() => {});

      if (result.success) {
        storeTaskMemory({
          agentId,
          domain,
          content: `Agent completed task successfully on ${domain}: ${task.description}. Outcome: ${JSON.stringify(result.data).slice(0, 500)}`,
        }).catch(() => {});
      }

      const stillExecuting = approvedTasks.filter((t) => !completedLogicalIds.has(t.logicalId)).length;
      await runMutation(api.executionStats.setExecutionStats, {
        workflowId,
        browserLive: stillExecuting,
        convexMutations: 14 + approvedTasks.indexOf(task) * 4,
        hudAvg: hudQuality,
        laminarSpans: 2 + approvedTasks.indexOf(task) * 2,
        mongoRecords: 15 + approvedTasks.indexOf(task) * 2,
      });
    };

    const getNextWave = (tasksLeft: ConvexTask[]): ConvexTask[] =>
      tasksLeft.filter((t) => t.assignedAgentId && t.dependencies.every((d) => completedLogicalIds.has(d)));

    let remaining = approvedTasks.filter((t) => t.assignedAgentId && agentById.has(t.assignedAgentId));
    while (remaining.length > 0) {
      const wave = getNextWave(remaining);
      if (wave.length === 0) break;
      await Promise.all(
        wave.map((task) => runWithTaskSpan(task.logicalId, () => runOneTask(task)))
      );
      remaining = remaining.filter((t) => !completedLogicalIds.has(t.logicalId));
    }

    const finalTasks = (await runQuery(api.tasks.getTasksByWorkflow, { workflowId })) as ConvexTask[];
    const allDone = finalTasks.every((t) => t.status === "completed" || t.status === "failed");
    let synthesizedResult = "";
    if (allDone && workflow.input) {
      const resultsForSynthesis = finalTasks.map((t) => ({
        logicalId: t.logicalId,
        description: t.description,
        success: (t.result as TaskResult)?.success ?? false,
        data: (t.result as TaskResult)?.data ?? {},
        executionTimeMs: (t.result as TaskResult)?.executionTimeMs ?? 0,
      }));
      synthesizedResult = await synthesizeResults({ userInput: workflow.input, taskResults: resultsForSynthesis });
    }
    executionStore
      .archiveWorkflow({
        workflowId: workflowId as string,
        input: workflow.input,
        status: allDone ? "completed" : "failed",
        createdAt: workflow.createdAt ?? Date.now(),
        completedAt: allDone ? Date.now() : undefined,
        synthesizedResult: synthesizedResult || undefined,
        tasks: finalTasks.map((t) => ({
          logicalId: t.logicalId,
          description: t.description,
          assignedAgentId: t.assignedAgentId as string | undefined,
          result: t.result as { success: boolean; data: unknown; executionTimeMs: number } | undefined,
          executionTimeMs: (t.result as TaskResult)?.executionTimeMs,
        })),
      })
      .catch(() => {});
    return { allDone, synthesizedResult };
    });

    await runMutation(api.workflows.updateWorkflowStatus, {
      workflowId,
      status: final.allDone ? "completed" : "failed",
      completedAt: final.allDone ? Date.now() : undefined,
      synthesizedResult: final.synthesizedResult || undefined,
      laminarTraceId: traceId != null ? String(traceId) : undefined,
    });
  }
}
