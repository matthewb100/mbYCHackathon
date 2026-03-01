/**
 * Supermemory integration for agent navigation memory.
 * Store/recall navigation paths per domain to boost agent confidence.
 */

export interface NavigationStep {
  action: "click" | "type" | "navigate" | "scroll" | "extract";
  selector?: string;
  value?: string;
  url?: string;
  timestamp: number;
}

export interface NavigationMemory {
  domain: string;
  agentId: string;
  steps: NavigationStep[];
  timestamp: number;
}

const DEFAULT_BASE = "https://api.supermemory.ai/v1";

export class AgentMemory {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey?: string, baseUrl?: string) {
    this.apiKey = apiKey ?? process.env.SUPERMEMORY_API_KEY ?? "";
    this.baseUrl = baseUrl ?? process.env.SUPERMEMORY_API_URL ?? DEFAULT_BASE;
  }

  async storeNavigation(agentId: string, domain: string, steps: NavigationStep[]): Promise<void> {
    if (!this.apiKey) return;
    try {
      await fetch(`${this.baseUrl}/memory`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({ agentId, domain, steps, timestamp: Date.now(), source: "swarm" }),
      });
    } catch {
      // non-blocking
    }
  }

  async recallNavigation(domain: string): Promise<NavigationMemory | null> {
    if (!this.apiKey) return null;
    try {
      const res = await fetch(`${this.baseUrl}/memory?domain=${encodeURIComponent(domain)}`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data as NavigationMemory;
    } catch {
      return null;
    }
  }

  async getAgentExperience(agentId: string): Promise<string[]> {
    if (!this.apiKey) return [];
    try {
      const res = await fetch(`${this.baseUrl}/memory/agent/${encodeURIComponent(agentId)}`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { domains?: string[] };
      return data.domains ?? [];
    } catch {
      return [];
    }
  }
}
