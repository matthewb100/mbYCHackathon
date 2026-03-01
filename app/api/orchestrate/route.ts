import { NextResponse } from "next/server";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { createExecutionPlan } from "@/lib/orchestrator/create-plan";
import { BrowserAgent } from "@/lib/agents/browser-agent";
import { searchMemoriesByDomain, domainFromTask } from "@/lib/supermemory/client";
import type { Task } from "@/types";

const convexUrl = () => process.env.NEXT_PUBLIC_CONVEX_URL ?? process.env.CONVEX_URL ?? "";
const browserUseKey = () => (process.env.BROWSER_USE_API_KEY ?? "").trim();

type AgentDoc = {
  _id: Id<"agents">;
  name: string;
  capabilities: string[];
  specializedDomains: string[];
  reputationScore: number;
  pricePerTask?: number;
  isExternal?: boolean;
  apiEndpoint?: string;
  currentLoad?: number;
  maxConcurrency?: number;
};

type TaskDoc = {
  _id: Id<"tasks">;
  logicalId: string;
  description: string;
  targetUrl?: string;
  dependencies: string[];
  requiredCapabilities: string[];
  priority: number;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const workflowId = body?.workflowId as Id<"workflows"> | undefined;
    if (!workflowId) {
      return NextResponse.json({ error: "Missing workflowId" }, { status: 400 });
    }

    const url = convexUrl();
    if (!url) return NextResponse.json({ error: "Convex not configured" }, { status: 500 });

    const workflow = await fetchQuery(api.workflows.getWorkflow, { workflowId }, { url }) as { input: string; status: string; tasks: TaskDoc[] } | null;
    if (!workflow) return NextResponse.json({ error: "Workflow not found" }, { status: 404 });

    const agents = await fetchQuery(api.agents.getOnlineAgents, {}, { url }) as AgentDoc[];
    if (!agents.length) return NextResponse.json({ error: "No online agents" }, { status: 400 });

    const tasks = workflow.tasks as TaskDoc[];
    if (!tasks.length) return NextResponse.json({ error: "No tasks" }, { status: 400 });

    await fetchMutation(api.workflows.updateWorkflowStatus, { workflowId, status: "bidding" }, { url });

    const internalKey = browserUseKey();
    const agentMap = new Map<string, BrowserAgent>();
    if (internalKey) {
      for (const a of agents) {
        if (!a.isExternal) {
          agentMap.set(a._id, new BrowserAgent(internalKey, {
            id: a._id,
            name: a.name,
            capabilities: a.capabilities,
            specializedDomains: a.specializedDomains,
            reputationScore: a.reputationScore,
            currentLoad: 0,
            maxConcurrency: 3,
            pricePerTask: a.pricePerTask,
          }));
        }
      }
    }

    for (const task of tasks) {
      await fetchMutation(api.tasks.updateTaskStatus, { taskId: task._id, status: "bidding" }, { url });
      const requiredCaps = task.requiredCapabilities ?? [];
      const eligible = agents.filter(
        (a) => requiredCaps.length === 0 || requiredCaps.some((c) => a.capabilities.includes(c))
      );

      for (const agent of eligible) {
        let confidenceScore = 0.5;
        let estimatedTimeMs = 20000;
        let price = agent.pricePerTask ?? 0.1;
        let reasoning = "Eligible for task.";

        if (agent.isExternal && agent.apiEndpoint) {
          try {
            const base = agent.apiEndpoint.replace(/\/$/, "");
            const res = await fetch(`${base}/bid`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                taskId: task._id,
                description: task.description,
                targetUrl: task.targetUrl ?? null,
              }),
            });
            if (res.ok) {
              const data = (await res.json()) as { confidenceScore?: number; estimatedTimeMs?: number; price?: number; reasoning?: string };
              confidenceScore = data.confidenceScore ?? 0.5;
              estimatedTimeMs = data.estimatedTimeMs ?? 20000;
              price = data.price ?? price;
              reasoning = data.reasoning ?? reasoning;
            }
          } catch {
            reasoning = "External bid request failed.";
          }
        } else {
          const browserAgent = agentMap.get(agent._id);
          if (browserAgent) {
            const bid = browserAgent.bid({
              id: task.logicalId,
              workflowId,
              description: task.description,
              targetUrl: task.targetUrl,
              dependencies: task.dependencies,
              status: "bidding",
              priority: 0,
              requiredCapabilities: requiredCaps,
            } as Task);
            confidenceScore = bid.confidenceScore;
            estimatedTimeMs = bid.estimatedTimeMs;
            price = agent.pricePerTask ?? 0.1;
            reasoning = bid.reasoning;
          }
        }

        const domain = domainFromTask(task.targetUrl, task.description);
        const priorMemories = await searchMemoriesByDomain(domain, agent._id);
        if (priorMemories.length > 0) {
          confidenceScore = Math.min(1, confidenceScore + 0.1);
          const summary = priorMemories.slice(0, 2).map((m) => m.content).join("; ");
          reasoning = `${reasoning} [Prior success on this domain: ${summary}]`;
        }

        await fetchMutation(
          api.bids.submitBid,
          {
            agentId: agent._id,
            taskId: task._id,
            confidenceScore,
            estimatedTimeMs,
            price,
            reasoning,
          },
          { url }
        );
      }
    }

    await new Promise((r) => setTimeout(r, 2000));

    const bidsByTask = new Map<string, Array<{ taskId: string; agentId: string; agentName?: string; confidenceScore: number; estimatedTimeMs: number; price?: number; reasoning: string }>>();
    const nameById = new Map(agents.map((a) => [a._id, a.name]));

    for (const task of tasks) {
      const bidList = await fetchQuery(api.bids.getBidsForTask, { taskId: task._id }, { url }) as Array<{
        agentId: Id<"agents">;
        confidenceScore: number;
        estimatedTimeMs: number;
        price?: number;
        reasoning: string;
      }>;
      bidsByTask.set(task.logicalId, bidList.map((b) => ({
        taskId: task._id,
        agentId: b.agentId,
        agentName: nameById.get(b.agentId),
        confidenceScore: b.confidenceScore,
        estimatedTimeMs: b.estimatedTimeMs,
        price: b.price,
        reasoning: b.reasoning,
      })));
    }

    const plan = await createExecutionPlan({
      userInput: workflow.input,
      agents: agents.map((a) => ({
        _id: a._id,
        name: a.name,
        capabilities: a.capabilities,
        specializedDomains: a.specializedDomains,
        reputationScore: a.reputationScore,
        pricePerTask: a.pricePerTask,
        isExternal: a.isExternal,
        currentLoad: a.currentLoad ?? 0,
        maxConcurrency: a.maxConcurrency ?? 3,
      })),
      tasks: tasks.map((t) => ({
        _id: t._id,
        logicalId: t.logicalId,
        description: t.description,
        targetUrl: t.targetUrl,
        dependencies: t.dependencies,
        priority: 0,
        requiredCapabilities: t.requiredCapabilities ?? [],
      })),
      bidsByTask,
    });

    const taskAssignments = plan.tasks
      .filter((t) => t.assignedAgentId)
      .map((t) => ({ logicalId: t.id, assignedAgentId: t.assignedAgentId as Id<"agents"> }));

    await fetchMutation(
      api.workflows.setExecutionPlan,
      {
        workflowId,
        executionPlanJson: JSON.stringify(plan),
        totalEstimatedCost: plan.totalEstimatedCost,
        totalEstimatedTime: plan.totalEstimatedTime,
        taskAssignments,
      },
      { url }
    );

    return NextResponse.json({ plan, workflowId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Orchestration failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
