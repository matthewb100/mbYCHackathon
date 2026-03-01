import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const DEFAULT_STATS = {
  claudeCalls: 0,
  browserLive: 0,
  convexMutations: 0,
  hudAvg: 0,
  supermemoryDomains: 0,
  laminarSpans: 0,
  mongoRecords: 0,
  vercelStatus: "deployed",
};

export const setExecutionStats = mutation({
  args: {
    workflowId: v.optional(v.id("workflows")),
    claudeCalls: v.optional(v.number()),
    browserLive: v.optional(v.number()),
    convexMutations: v.optional(v.number()),
    hudAvg: v.optional(v.number()),
    supermemoryDomains: v.optional(v.number()),
    laminarSpans: v.optional(v.number()),
    mongoRecords: v.optional(v.number()),
    vercelStatus: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db.query("executionStats").first();
    const updates = {
      ...(existing
        ? {
            workflowId: args.workflowId ?? existing.workflowId,
            claudeCalls: args.claudeCalls ?? existing.claudeCalls,
            browserLive: args.browserLive ?? existing.browserLive,
            convexMutations: args.convexMutations ?? existing.convexMutations,
            hudAvg: args.hudAvg ?? existing.hudAvg,
            supermemoryDomains: args.supermemoryDomains ?? existing.supermemoryDomains,
            laminarSpans: args.laminarSpans ?? existing.laminarSpans,
            mongoRecords: args.mongoRecords ?? existing.mongoRecords,
            vercelStatus: args.vercelStatus ?? existing.vercelStatus,
          }
        : {
            workflowId: args.workflowId,
            claudeCalls: args.claudeCalls ?? DEFAULT_STATS.claudeCalls,
            browserLive: args.browserLive ?? DEFAULT_STATS.browserLive,
            convexMutations: args.convexMutations ?? DEFAULT_STATS.convexMutations,
            hudAvg: args.hudAvg ?? DEFAULT_STATS.hudAvg,
            supermemoryDomains: args.supermemoryDomains ?? DEFAULT_STATS.supermemoryDomains,
            laminarSpans: args.laminarSpans ?? DEFAULT_STATS.laminarSpans,
            mongoRecords: args.mongoRecords ?? DEFAULT_STATS.mongoRecords,
            vercelStatus: args.vercelStatus ?? DEFAULT_STATS.vercelStatus,
          }),
      updatedAt: now,
    };
    if (existing) {
      await ctx.db.patch(existing._id, updates);
      return existing._id;
    }
    return await ctx.db.insert("executionStats", updates);
  },
});

export const getExecutionStats = query({
  handler: async (ctx) => {
    const row = await ctx.db.query("executionStats").first();
    if (!row) {
      return { ...DEFAULT_STATS, updatedAt: 0 };
    }
    return {
      workflowId: row.workflowId,
      claudeCalls: row.claudeCalls,
      browserLive: row.browserLive,
      convexMutations: row.convexMutations,
      hudAvg: row.hudAvg,
      supermemoryDomains: row.supermemoryDomains,
      laminarSpans: row.laminarSpans,
      mongoRecords: row.mongoRecords,
      vercelStatus: row.vercelStatus,
      updatedAt: row.updatedAt,
    };
  },
});
