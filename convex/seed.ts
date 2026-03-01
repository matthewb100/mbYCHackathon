import { action } from "./_generated/server";
import { api } from "./_generated/api";

export const seedAgents = action({
  args: {},
  handler: async (ctx): Promise<{ seeded: number; ids?: string[]; message?: string }> => {
    return await ctx.runMutation(api.agents.seedAgentsMutation, {});
  },
});
