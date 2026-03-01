import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const registerAgent = mutation({
  args: {
    name: v.string(),
    capabilities: v.array(v.string()),
    specializedDomains: v.array(v.string()),
    reputationScore: v.optional(v.number()),
    pricePerTask: v.optional(v.number()),
    isExternal: v.optional(v.boolean()),
    apiEndpoint: v.optional(v.string()),
  },
  handler: async (ctx, { name, capabilities, specializedDomains, reputationScore, pricePerTask, isExternal, apiEndpoint }) => {
    const rep = reputationScore ?? (isExternal ? 50 : 85);
    return await ctx.db.insert("agents", {
      name,
      capabilities,
      specializedDomains,
      reputationScore: rep,
      currentLoad: 0,
      maxConcurrency: 3,
      isOnline: true,
      pricePerTask: pricePerTask ?? 0.1,
      isExternal: isExternal ?? false,
      apiEndpoint: apiEndpoint ?? undefined,
      tasksCompleted: 0,
      earnings: 0,
    });
  },
});

export const updateAgentReputation = mutation({
  args: { agentId: v.id("agents"), newScore: v.number() },
  handler: async (ctx, { agentId, newScore }) => {
    await ctx.db.patch(agentId, { reputationScore: Math.min(100, Math.max(0, newScore)) });
  },
});

/** Reputation update from a single task: newRep = oldRep*0.8 + taskScore*0.2 (taskScore 0-100). */
export const updateAgentReputationFromTask = mutation({
  args: { agentId: v.id("agents"), taskScore: v.number() },
  handler: async (ctx, { agentId, taskScore }) => {
    const agent = await ctx.db.get(agentId);
    if (!agent) return;
    const oldRep = agent.reputationScore as number;
    const newRep = Math.min(100, Math.max(0, oldRep * 0.8 + Math.min(100, Math.max(0, taskScore)) * 0.2));
    await ctx.db.patch(agentId, { reputationScore: newRep });
  },
});

export const updateAgentLoad = mutation({
  args: { agentId: v.id("agents"), delta: v.number() },
  handler: async (ctx, { agentId, delta }) => {
    const agent = await ctx.db.get(agentId);
    if (!agent) return;
    const currentLoad = Math.max(0, (agent.currentLoad as number) + delta);
    await ctx.db.patch(agentId, { currentLoad });
  },
});

export const getOnlineAgents = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("agents")
      .withIndex("by_online", (q) => q.eq("isOnline", true))
      .collect();
  },
});

export const getAgentById = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, { agentId }) => {
    return await ctx.db.get(agentId);
  },
});

export const getAllAgents = query({
  handler: async (ctx) => {
    return await ctx.db.query("agents").collect();
  },
});

const SEED_AGENTS = [
  {
    name: "FlightBooker",
    capabilities: ["booking", "checkout", "navigation"],
    specializedDomains: ["google.com/travel", "kayak.com", "skyscanner.com"],
    reputationScore: 92,
    pricePerTask: 0.12,
  },
  {
    name: "PetOwnerFinder",
    capabilities: ["form-filling", "booking", "navigation", "web-search"],
    specializedDomains: ["rover.com", "wag.com", "chewy.com", "petfinder.com"],
    reputationScore: 88,
    pricePerTask: 0.08,
  },
  {
    name: "DataMiner",
    capabilities: ["data-extraction", "table-parsing", "web-search"],
    specializedDomains: ["crunchbase.com", "linkedin.com", "pitchbook.com"],
    reputationScore: 94,
    pricePerTask: 0.1,
  },
  {
    name: "HomeServices",
    capabilities: ["data-extraction", "navigation", "booking"],
    specializedDomains: ["thumbtack.com", "taskrabbit.com", "angieslist.com"],
    reputationScore: 85,
    pricePerTask: 0.1,
  },
  {
    name: "DealScout",
    capabilities: ["comparison", "data-extraction", "navigation"],
    specializedDomains: ["stripe.com", "vercel.com", "cloudflare.com", "g2.com", "capterra.com"],
    reputationScore: 89,
    pricePerTask: 0.09,
  },
  {
    name: "ExternalAgent",
    capabilities: ["booking", "navigation"],
    specializedDomains: [],
    reputationScore: 50,
    pricePerTask: 0.07,
    isExternal: true,
    apiEndpoint: "",
  },
];

export const seedAgentsMutation = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("agents").first();
    if (existing) return { seeded: 0, message: "Agents already seeded" };
    const ids = [];
    for (const a of SEED_AGENTS) {
      const id = await ctx.db.insert("agents", {
        name: a.name,
        capabilities: a.capabilities,
        specializedDomains: a.specializedDomains,
        reputationScore: a.reputationScore,
        currentLoad: 0,
        maxConcurrency: 3,
        isOnline: true,
        pricePerTask: a.pricePerTask ?? 0.1,
        isExternal: a.isExternal ?? false,
        apiEndpoint: a.apiEndpoint ?? undefined,
        tasksCompleted: 0,
        earnings: 0,
      });
      ids.push(id);
    }
    return { seeded: ids.length, ids };
  },
});
