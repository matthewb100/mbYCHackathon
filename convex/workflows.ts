import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const createWorkflow = mutation({
  args: { input: v.string() },
  handler: async (ctx, { input }) => {
    const id = await ctx.db.insert("workflows", {
      input,
      status: "decomposing",
      createdAt: Date.now(),
    });
    return id;
  },
});

export const updateWorkflowStatus = mutation({
  args: {
    workflowId: v.id("workflows"),
    status: v.string(),
    completedAt: v.optional(v.number()),
    executionPlanJson: v.optional(v.string()),
    totalEstimatedCost: v.optional(v.number()),
    totalEstimatedTime: v.optional(v.string()),
    synthesizedResult: v.optional(v.string()),
    laminarTraceId: v.optional(v.string()),
  },
  handler: async (ctx, { workflowId, status, completedAt, executionPlanJson, totalEstimatedCost, totalEstimatedTime, synthesizedResult, laminarTraceId }) => {
    const patch: Record<string, unknown> = { status };
    if (completedAt !== undefined) patch.completedAt = completedAt;
    if (executionPlanJson !== undefined) patch.executionPlanJson = executionPlanJson;
    if (totalEstimatedCost !== undefined) patch.totalEstimatedCost = totalEstimatedCost;
    if (totalEstimatedTime !== undefined) patch.totalEstimatedTime = totalEstimatedTime;
    if (synthesizedResult !== undefined) patch.synthesizedResult = synthesizedResult;
    if (laminarTraceId !== undefined) patch.laminarTraceId = laminarTraceId;
    await ctx.db.patch(workflowId, patch);
  },
});

export const setExecutionPlan = mutation({
  args: {
    workflowId: v.id("workflows"),
    executionPlanJson: v.string(),
    totalEstimatedCost: v.number(),
    totalEstimatedTime: v.string(),
    taskAssignments: v.array(v.object({
      logicalId: v.string(),
      assignedAgentId: v.id("agents"),
      assignedPrice: v.optional(v.number()),
    })),
  },
  handler: async (ctx, { workflowId, executionPlanJson, totalEstimatedCost, totalEstimatedTime, taskAssignments }) => {
    await ctx.db.patch(workflowId, {
      status: "planned",
      executionPlanJson,
      totalEstimatedCost,
      totalEstimatedTime,
    });
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_workflow", (q) => q.eq("workflowId", workflowId))
      .collect();
    for (const ta of taskAssignments) {
      const task = tasks.find((t) => t.logicalId === ta.logicalId);
      if (task) {
        await ctx.db.patch(task._id, {
          status: "assigned",
          assignedAgentId: ta.assignedAgentId,
          ...(ta.assignedPrice !== undefined && ta.assignedPrice !== null ? { assignedPrice: ta.assignedPrice } : {}),
        });
      }
    }
  },
});

export const approveWorkflow = mutation({
  args: { workflowId: v.id("workflows") },
  handler: async (ctx, { workflowId }) => {
    await ctx.db.patch(workflowId, { status: "approved" });
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_workflow", (q) => q.eq("workflowId", workflowId))
      .collect();
    for (const task of tasks) {
      if (task.status === "assigned") {
        await ctx.db.patch(task._id, { status: "approved" });
      }
    }
  },
});

export const getWorkflow = query({
  args: { workflowId: v.id("workflows") },
  handler: async (ctx, { workflowId }) => {
    const workflow = await ctx.db.get(workflowId);
    if (!workflow) return null;
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_workflow", (q) => q.eq("workflowId", workflowId))
      .collect();
    return { ...workflow, _id: workflow._id, tasks };
  },
});
