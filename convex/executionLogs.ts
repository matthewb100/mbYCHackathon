import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const addLog = mutation({
  args: {
    taskId: v.id("tasks"),
    agentId: v.id("agents"),
    action: v.string(),
    screenshot: v.optional(v.string()),
    details: v.optional(v.string()),
  },
  handler: async (ctx, { taskId, agentId, action, screenshot, details }) => {
    return await ctx.db.insert("executionLogs", {
      taskId,
      agentId,
      action,
      timestamp: Date.now(),
      screenshot,
      details,
    });
  },
});

export const getLogsForTask = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, { taskId }) => {
    const logs = await ctx.db
      .query("executionLogs")
      .withIndex("by_task", (q) => q.eq("taskId", taskId))
      .collect();
    return logs.sort((a, b) => (a.timestamp as number) - (b.timestamp as number));
  },
});

export const getAllLogs = query({
  handler: async (ctx) => {
    const logs = await ctx.db.query("executionLogs").collect();
    return logs.sort((a, b) => (b.timestamp as number) - (a.timestamp as number));
  },
});

export const getLogsForWorkflow = query({
  args: { workflowId: v.id("workflows") },
  handler: async (ctx, { workflowId }) => {
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_workflow", (q) => q.eq("workflowId", workflowId))
      .collect();
    const taskIds = new Set(tasks.map((t) => t._id));
    const logs = await ctx.db.query("executionLogs").collect();
    return logs
      .filter((log) => taskIds.has(log.taskId))
      .sort((a, b) => (b.timestamp as number) - (a.timestamp as number));
  },
});
