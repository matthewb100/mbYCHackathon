import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const createTasks = mutation({
  args: {
    workflowId: v.id("workflows"),
    tasks: v.array(
      v.object({
        logicalId: v.string(),
        description: v.string(),
        targetUrl: v.optional(v.string()),
        dependencies: v.array(v.string()),
        priority: v.number(),
        requiredCapabilities: v.array(v.string()),
      })
    ),
  },
  handler: async (ctx, { workflowId, tasks }) => {
    const ids: string[] = [];
    for (const t of tasks) {
      const id = await ctx.db.insert("tasks", {
        workflowId,
        logicalId: t.logicalId,
        description: t.description,
        targetUrl: t.targetUrl,
        dependencies: t.dependencies,
        status: "pending",
        priority: t.priority,
        requiredCapabilities: t.requiredCapabilities,
      });
      ids.push(id);
    }
    return ids;
  },
});

export const updateTaskStatus = mutation({
  args: {
    taskId: v.id("tasks"),
    status: v.string(),
    assignedAgentId: v.optional(v.id("agents")),
    result: v.optional(
      v.object({
        success: v.boolean(),
        data: v.any(),
        executionTimeMs: v.number(),
        screenshotUrl: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, { taskId, status, assignedAgentId, result }) => {
    const task = await ctx.db.get(taskId);
    if (!task) return;
    const wasCompleted = task.status === "completed";
    const patch: {
      status: string;
      assignedAgentId?: typeof assignedAgentId;
      result?: typeof result;
    } = { status };
    if (assignedAgentId !== undefined) patch.assignedAgentId = assignedAgentId;
    if (result !== undefined) patch.result = result;
    await ctx.db.patch(taskId, patch);
    // Credit agent earnings when task first transitions to completed
    if (!wasCompleted && status === "completed" && task.assignedAgentId) {
      const price = task.assignedPrice ?? 0;
      if (price > 0) {
        const agent = await ctx.db.get(task.assignedAgentId);
        if (agent) {
          const tasksCompleted = (agent.tasksCompleted ?? 0) + 1;
          const earnings = (agent.earnings ?? 0) + price;
          await ctx.db.patch(task.assignedAgentId, { tasksCompleted, earnings });
        }
      }
    }
  },
});

export const getTasksByWorkflow = query({
  args: { workflowId: v.id("workflows") },
  handler: async (ctx, { workflowId }) => {
    return await ctx.db
      .query("tasks")
      .withIndex("by_workflow", (q) => q.eq("workflowId", workflowId))
      .collect();
  },
});

export const getPendingTasks = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("tasks")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
  },
});

export const setTaskLiveUrl = mutation({
  args: { taskId: v.id("tasks"), liveUrl: v.string() },
  handler: async (ctx, { taskId, liveUrl }) => {
    await ctx.db.patch(taskId, { liveUrl });
  },
});

export const getTaskLiveUrl = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, { taskId }) => {
    const task = await ctx.db.get(taskId);
    return task?.liveUrl ?? null;
  },
});
