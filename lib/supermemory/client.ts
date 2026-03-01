/**
 * Supermemory integration: store navigation context after task success,
 * search by domain during bidding to boost confidence and reasoning.
 */

const SUPERMEMORY_BASE = "https://api.supermemory.ai";
const CONTAINER_TAG = "agent_exchange";

function getApiKey(): string {
  return (process.env.SUPERMEMORY_API_KEY ?? "").trim();
}

export interface StoreMemoryInput {
  agentId: string;
  domain: string;
  content: string;
}

/**
 * Store a memory after an agent successfully completes a task.
 * Content should describe what worked (e.g. navigation path, outcome).
 */
export async function storeTaskMemory(input: StoreMemoryInput): Promise<void> {
  const apiKey = getApiKey();
  if (!apiKey) return;
  try {
    const res = await fetch(`${SUPERMEMORY_BASE}/v4/memories`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        containerTag: CONTAINER_TAG,
        memories: [
          {
            content: input.content,
            isStatic: false,
            metadata: {
              agentId: input.agentId,
              domain: input.domain,
            },
          },
        ],
      }),
    });
    if (!res.ok) return;
  } catch {
    // non-blocking
  }
}

export interface SearchMemoriesResult {
  content: string;
  agentId?: string;
  domain?: string;
}

/**
 * Search memories for a given domain, optionally filtered by agent.
 * Used during bidding to boost confidence when agent has prior success.
 */
export async function searchMemoriesByDomain(
  domain: string,
  agentId?: string
): Promise<SearchMemoriesResult[]> {
  const apiKey = getApiKey();
  if (!apiKey || !domain) return [];
  try {
    const body: Record<string, unknown> = {
      q: domain,
      containerTag: CONTAINER_TAG,
      searchMode: "hybrid",
      limit: 5,
      threshold: 0.4,
    };
    if (agentId) {
      body.filters = {
        AND: [
          { key: "agentId", value: agentId },
          { key: "domain", value: domain },
        ],
      };
    }
    const res = await fetch(`${SUPERMEMORY_BASE}/v4/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      results?: Array<{ memory?: string; chunk?: { text?: string }; metadata?: Record<string, string> }>;
    };
    const results = data.results ?? [];
    return results
      .map((r) => ({
        content: r.memory ?? r.chunk?.text ?? "",
        agentId: r.metadata?.agentId,
        domain: r.metadata?.domain,
      }))
      .filter((r) => r.content.length > 0);
  } catch {
    return [];
  }
}

/** Extract domain from task targetUrl or description for storage/search. */
export function domainFromTask(targetUrl?: string | null, description?: string): string {
  if (targetUrl) {
    try {
      const u = new URL(targetUrl);
      return u.hostname.replace(/^www\./, "");
    } catch {
      // fallback
    }
  }
  if (description) {
    const m = description.match(/(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (m) return m[1];
  }
  return "unknown";
}
