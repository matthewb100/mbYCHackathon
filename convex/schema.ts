import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  workflows: defineTable({
    input: v.string(),
    status: v.string(), // 'decomposing' | 'bidding' | 'planned' | 'approved' | 'executing' | 'completed' | 'failed'
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
    executionPlanJson: v.optional(v.string()),
    totalEstimatedCost: v.optional(v.number()),
    totalEstimatedTime: v.optional(v.string()),
    synthesizedResult: v.optional(v.string()),
    laminarTraceId: v.optional(v.string()),
  }).index("by_created", ["createdAt"]),

  tasks: defineTable({
    workflowId: v.id("workflows"),
    logicalId: v.string(),
    description: v.string(),
    targetUrl: v.optional(v.string()),
    dependencies: v.array(v.string()),
    status: v.string(), // 'pending' | 'bidding' | 'planned' | 'assigned' | 'approved' | 'executing' | 'completed' | 'failed'
    assignedAgentId: v.optional(v.id("agents")),
    assignedPrice: v.optional(v.number()), // price paid to agent when task completes (from winning bid)
    priority: v.number(),
    result: v.optional(
      v.object({
        success: v.boolean(),
        data: v.any(),
        executionTimeMs: v.number(),
        screenshotUrl: v.optional(v.string()),
      })
    ),
    requiredCapabilities: v.array(v.string()),
    liveUrl: v.optional(v.string()),
  })
    .index("by_workflow", ["workflowId"])
    .index("by_status", ["status"]),

  agents: defineTable({
    name: v.string(),
    capabilities: v.array(v.string()),
    specializedDomains: v.array(v.string()),
    reputationScore: v.number(),
    currentLoad: v.number(),
    maxConcurrency: v.number(),
    isOnline: v.boolean(),
    pricePerTask: v.optional(v.number()),
    isExternal: v.optional(v.boolean()),
    apiEndpoint: v.optional(v.string()),
    tasksCompleted: v.optional(v.number()), // lifetime tasks completed (for earnings)
    earnings: v.optional(v.number()), // lifetime $ earned
  }).index("by_online", ["isOnline"]),

  bids: defineTable({
    agentId: v.id("agents"),
    taskId: v.id("tasks"),
    confidenceScore: v.number(),
    estimatedTimeMs: v.number(),
    price: v.optional(v.number()),
    reasoning: v.string(),
    status: v.string(), // 'pending' | 'accepted' | 'rejected'
  })
    .index("by_task", ["taskId"])
    .index("by_agent", ["agentId"]),

  executionLogs: defineTable({
    taskId: v.id("tasks"),
    agentId: v.id("agents"),
    action: v.string(),
    timestamp: v.number(),
    screenshot: v.optional(v.string()),
    details: v.optional(v.string()),
  }).index("by_task", ["taskId"]),

  // Live metrics for the dashboard tech bar (updated during workflow execution)
  executionStats: defineTable({
    workflowId: v.optional(v.id("workflows")),
    claudeCalls: v.number(),
    browserLive: v.number(),
    convexMutations: v.number(),
    hudAvg: v.number(),
    supermemoryDomains: v.number(),
    laminarSpans: v.number(),
    mongoRecords: v.number(),
    vercelStatus: v.string(),
    updatedAt: v.number(),
  }).index("by_workflow", ["workflowId"]),
});
