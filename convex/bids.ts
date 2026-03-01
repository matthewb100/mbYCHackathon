import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";

export const submitBid = mutation({
  args: {
    agentId: v.id("agents"),
    taskId: v.id("tasks"),
    confidenceScore: v.number(),
    estimatedTimeMs: v.number(),
    price: v.optional(v.number()),
    reasoning: v.string(),
  },
  handler: async (ctx, { agentId, taskId, confidenceScore, estimatedTimeMs, price, reasoning }) => {
    return await ctx.db.insert("bids", {
      agentId,
      taskId,
      confidenceScore,
      estimatedTimeMs,
      price: price ?? 0,
      reasoning,
      status: "pending",
    });
  },
});

export const acceptBid = mutation({
  args: { bidId: v.id("bids") },
  handler: async (ctx, { bidId }) => {
    const bid = await ctx.db.get(bidId);
    if (!bid || (bid.status as string) !== "pending") return;
    await ctx.db.patch(bidId, { status: "accepted" });
    await ctx.db.patch(bid.taskId as Id<"tasks">, {
      status: "assigned",
      assignedAgentId: bid.agentId as Id<"agents">,
    });
    // Reject other pending bids for this task
    const allBids = await ctx.db
      .query("bids")
      .withIndex("by_task", (q) => q.eq("taskId", bid.taskId as Id<"tasks">))
      .collect();
    for (const b of allBids) {
      if (b._id !== bidId && (b.status as string) === "pending") {
        await ctx.db.patch(b._id as Id<"bids">, { status: "rejected" });
      }
    }
  },
});

export const getBidsForTask = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, { taskId }) => {
    return await ctx.db
      .query("bids")
      .withIndex("by_task", (q) => q.eq("taskId", taskId))
      .collect();
  },
});
