/**
 * Daytona sandbox integration.
 * Wraps Daytona API for isolated execution environments per agent.
 * For demo: can run without actual sandboxing (direct execution).
 */

export interface SandboxSession {
  sessionId: string;
  agentId: string;
  createdAt: number;
}

export class SandboxManager {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey?: string, baseUrl?: string) {
    this.apiKey = apiKey ?? process.env.DAYTONA_API_KEY ?? "";
    this.baseUrl = baseUrl ?? process.env.DAYTONA_API_URL ?? "https://api.daytona.io";
  }

  async createSandbox(agentId: string): Promise<SandboxSession> {
    if (!this.apiKey) {
      return { sessionId: `local-${agentId}-${Date.now()}`, agentId, createdAt: Date.now() };
    }
    try {
      const res = await fetch(`${this.baseUrl}/v1/sandboxes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ agentId, metadata: { source: "agent-exchange" } }),
      });
      if (!res.ok) throw new Error(`Daytona ${res.status}: ${await res.text()}`);
      const data = (await res.json()) as { id?: string; sessionId?: string };
      return {
        sessionId: data.sessionId ?? data.id ?? `daytona-${Date.now()}`,
        agentId,
        createdAt: Date.now(),
      };
    } catch {
      return { sessionId: `local-${agentId}-${Date.now()}`, agentId, createdAt: Date.now() };
    }
  }

  async destroySandbox(sessionId: string): Promise<void> {
    if (!this.apiKey || sessionId.startsWith("local-")) return;
    try {
      await fetch(`${this.baseUrl}/v1/sandboxes/${sessionId}`, { method: "DELETE", headers: { Authorization: `Bearer ${this.apiKey}` } });
    } catch {
      // ignore
    }
  }

  async executeInSandbox<T = unknown>(sessionId: string, code: string): Promise<T> {
    if (sessionId.startsWith("local-") || !this.apiKey) {
      return undefined as T;
    }
    try {
      const res = await fetch(`${this.baseUrl}/v1/sandboxes/${sessionId}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<T>;
    } catch {
      return undefined as T;
    }
  }
}
