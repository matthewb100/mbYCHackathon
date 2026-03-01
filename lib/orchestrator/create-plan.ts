import { getAnthropicClient } from "@/lib/llm/anthropic-client";
import type { ExecutionPlan } from "@/types";

export interface AgentProfile {
  _id: string;
  name: string;
  capabilities: string[];
  specializedDomains: string[];
  reputationScore: number;
  pricePerTask?: number;
  isExternal?: boolean;
  currentLoad?: number;
  maxConcurrency?: number;
}

export interface BidProfile {
  taskId: string;
  logicalId?: string;
  agentId: string;
  agentName?: string;
  confidenceScore: number;
  estimatedTimeMs: number;
  price?: number;
  reasoning: string;
}

export interface TaskProfile {
  _id: string;
  logicalId: string;
  description: string;
  targetUrl?: string;
  dependencies: string[];
  priority: number;
  requiredCapabilities: string[];
}

const SYSTEM_PROMPT = `You are the AgentExchange orchestrator. Given a user's workflow request, the available agents in the marketplace, and the bids submitted, create the optimal execution plan.

Consider (in order of weight):
- Agent reputation scores (40%) — higher = more reliable
- Bid confidence scores (30%) — higher = more likely to succeed
- Agent load and capacity (25%) — each agent has currentLoad and maxConcurrency; an agent already at or near capacity is less attractive for additional tasks. When you assign a second task to the same agent, treat their effective score as ~30% lower for that assignment; a third task, ~30% lower again. Prefer spreading work across agents.
- Bid pricing (15%) — lower = cheaper for the user
- Estimated execution time (15%) — faster is better but reliability matters more

Rules:
1. For each task, assign exactly one agent that submitted a bid for that task. Use the agent's "name" field.
2. Identify which tasks can run in parallel (no dependencies between them) and which are sequential.
3. When multiple tasks can run in parallel, strongly prefer assigning them to different agents to maximize parallel execution speed. An agent executing 3 tasks simultaneously is slower than 3 agents executing 1 task each. Never assign the same agent to more than 2 tasks unless no other capable agent is available.
4. Use the "currentLoad" and "maxConcurrency" fields: if an agent already has tasks assigned (currentLoad), their effective score drops for additional tasks. Prefer agents with lower currentLoad when other factors are equal. An agent with currentLoad 1 and maxConcurrency 3 has effective score reduced by ~30% for the next task you assign them in this plan.
5. Weight reputation and confidence more heavily than price — reliability over saving cents.
6. Explain briefly why each agent was selected and why others were rejected.
7. If a task has no bids, assign the highest-reputation agent that has matching capabilities.
8. Return ONLY valid JSON, no markdown or extra text.

Response format:
{
  "tasks": [
    {
      "id": "task_1",
      "description": "...",
      "targetUrl": "https://... or null",
      "assignedAgent": "AgentName",
      "bidPrice": 0.12,
      "estimatedTime": "30s",
      "confidence": 0.95,
      "dependencies": [],
      "parallel": true
    }
  ],
  "totalEstimatedCost": 0.30,
  "totalEstimatedTime": "~45s (parallel)",
  "reasoning": "One paragraph explaining the plan."
}`;

interface ClaudePlanRaw {
  tasks: Array<{
    id: string;
    description: string;
    targetUrl?: string | null;
    assignedAgent: string;
    bidPrice: number;
    estimatedTime: string;
    confidence: number;
    dependencies: string[];
    parallel: boolean;
  }>;
  totalEstimatedCost: number;
  totalEstimatedTime: string;
  reasoning: string;
}

function parsePlan(text: string): ClaudePlanRaw {
  const trimmed = text.trim();
  const jsonStr = trimmed.startsWith("```")
    ? trimmed.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "").trim()
    : trimmed;
  return JSON.parse(jsonStr) as ClaudePlanRaw;
}

export async function createExecutionPlan(params: {
  userInput: string;
  agents: AgentProfile[];
  tasks: TaskProfile[];
  bidsByTask: Map<string, BidProfile[]>;
}): Promise<ExecutionPlan> {
  const { userInput, agents, tasks, bidsByTask } = params;
  const client = getAnthropicClient();

  const agentSummary = agents.map((a) => {
    const load = a.currentLoad ?? 0;
    const max = a.maxConcurrency ?? 3;
    const loadNote =
      load >= max
        ? "At capacity — avoid assigning more tasks unless no other option."
        : load > 0
          ? `Already has ${load} task(s) assigned; effective score drops ~30% for each additional task you assign this agent in this plan.`
          : "No current load; good candidate for parallel tasks.";
    return {
      id: a._id,
      name: a.name,
      capabilities: a.capabilities,
      specializedDomains: a.specializedDomains,
      reputationScore: a.reputationScore,
      pricePerTask: a.pricePerTask ?? 0.1,
      isExternal: a.isExternal ?? false,
      currentLoad: load,
      maxConcurrency: max,
      loadNote,
    };
  });

  const taskSummary = tasks.map((t) => ({
    logicalId: t.logicalId,
    description: t.description,
    targetUrl: t.targetUrl,
    dependencies: t.dependencies,
    requiredCapabilities: t.requiredCapabilities,
  }));

  const bidsSummary: Record<string, Array<{ agentName: string; agentId: string; confidenceScore: number; estimatedTimeMs: number; price: number; reasoning: string }>> = {};
  for (const [taskId, bids] of Array.from(bidsByTask.entries())) {
    bidsSummary[taskId] = bids.map((b) => ({
      agentName: b.agentName ?? b.agentId,
      agentId: b.agentId,
      confidenceScore: b.confidenceScore,
      estimatedTimeMs: b.estimatedTimeMs,
      price: b.price ?? 0.1,
      reasoning: b.reasoning,
    }));
  }

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `User request: ${userInput}\n\nAvailable agents:\n${JSON.stringify(agentSummary, null, 2)}\n\nTasks:\n${JSON.stringify(taskSummary, null, 2)}\n\nBids per task (key = task logicalId, same as in Tasks list):\n${JSON.stringify(bidsSummary, null, 2)}\n\nReturn the execution plan JSON only.`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const text = textBlock && "text" in textBlock ? textBlock.text : "";
  if (!text) throw new Error("Empty response from Claude");

  const raw = parsePlan(text);
  const nameToId = new Map(agents.map((a) => [a.name, a._id]));

  return {
    tasks: raw.tasks.map((t) => ({
      id: t.id,
      description: t.description,
      targetUrl: t.targetUrl ?? undefined,
      assignedAgent: t.assignedAgent,
      assignedAgentId: nameToId.get(t.assignedAgent),
      bidPrice: t.bidPrice,
      estimatedTime: t.estimatedTime,
      confidence: t.confidence,
      dependencies: t.dependencies ?? [],
      parallel: t.parallel ?? true,
    })),
    totalEstimatedCost: raw.totalEstimatedCost ?? 0,
    totalEstimatedTime: raw.totalEstimatedTime ?? "",
    reasoning: raw.reasoning ?? "",
  };
}
