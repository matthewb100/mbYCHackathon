export interface Workflow {
  id: string;
  input: string; // raw user input
  tasks: Task[];
  status:
    | "decomposing"
    | "bidding"
    | "executing"
    | "completed"
    | "failed";
  createdAt: number;
  completedAt?: number;
}

export interface Task {
  id: string;
  workflowId: string;
  description: string; // what the agent needs to do
  targetUrl?: string; // starting URL if known
  dependencies: string[]; // task IDs that must complete first
  status:
    | "pending"
    | "bidding"
    | "assigned"
    | "executing"
    | "completed"
    | "failed";
  assignedAgentId?: string;
  result?: TaskResult;
  priority: number; // execution order (0 = can start immediately)
}

export interface TaskResult {
  success: boolean;
  data: unknown; // extracted data, screenshots, etc.
  executionTimeMs: number;
  screenshotUrl?: string;
}

export interface Agent {
  id: string;
  name: string;
  capabilities: string[];
  specializedDomains: string[];
  reputationScore: number; // 0-100; new agents start at 50
  currentLoad: number;
  maxConcurrency: number;
  pricePerTask?: number; // cost in dollars
  isExternal?: boolean;
  apiEndpoint?: string; // for external agents: base URL for /bid and /execute
}

export interface Bid {
  agentId: string;
  taskId: string;
  confidenceScore: number; // 0-1
  estimatedTimeMs: number;
  price?: number; // cost in dollars
  reasoning: string;
}

/** Execution plan produced by Claude from marketplace + bids */
export interface ExecutionPlanTask {
  id: string;
  description: string;
  targetUrl?: string | null;
  assignedAgent: string; // agent name
  assignedAgentId?: string;
  bidPrice: number;
  estimatedTime: string;
  confidence: number;
  dependencies: string[];
  parallel: boolean;
}

export interface ExecutionPlan {
  tasks: ExecutionPlanTask[];
  totalEstimatedCost: number;
  totalEstimatedTime: string;
  reasoning: string;
}
