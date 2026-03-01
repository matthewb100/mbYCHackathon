import { getAnthropicClient } from "@/lib/llm/anthropic-client";
import type { Task } from "@/types";

const SYSTEM_PROMPT = `You are the orchestrator for Swarm, a multi-agent coordination platform.
Your job is to decompose a user's workflow request into atomic sub-tasks that
individual browser agents can execute independently on live websites.

Rules:
1. Each task should be completable by a single browser agent on a single website
2. Tasks should be as atomic as possible — one clear action per task
3. Identify dependencies between tasks (which tasks need results from others)
4. Assign priority levels (0 = no dependencies, can start immediately)
5. Include target URLs when you can infer them
6. Think about which tasks can run in PARALLEL vs which are sequential

Respond with ONLY a JSON array of task objects with these fields:
- id: string (task_1, task_2, etc.)
- description: string (clear instruction for a browser agent)
- targetUrl: string | null
- dependencies: string[] (IDs of tasks that must complete first)
- priority: number (0 = immediate, higher = later)
- requiredCapabilities: string[] (what the agent needs to be able to do)

Example input: 'Research our top 3 competitors, find their pricing pages, and draft a comparison'
Example output: [
  {"id": "task_1", "description": "Search Google for competitors of [company] and identify top 3", "targetUrl": "https://google.com", "dependencies": [], "priority": 0, "requiredCapabilities": ["web-search", "data-extraction"]},
  {"id": "task_2", "description": "Navigate to competitor 1 website and find pricing page, extract all plan details", "targetUrl": null, "dependencies": ["task_1"], "priority": 1, "requiredCapabilities": ["navigation", "data-extraction"]},
  {"id": "task_3", "description": "Navigate to competitor 2 website and find pricing page, extract all plan details", "targetUrl": null, "dependencies": ["task_1"], "priority": 1, "requiredCapabilities": ["navigation", "data-extraction"]},
  {"id": "task_4", "description": "Navigate to competitor 3 website and find pricing page, extract all plan details", "targetUrl": null, "dependencies": ["task_1"], "priority": 1, "requiredCapabilities": ["navigation", "data-extraction"]},
  {"id": "task_5", "description": "Compile extracted pricing data into a structured comparison table", "targetUrl": null, "dependencies": ["task_2", "task_3", "task_4"], "priority": 2, "requiredCapabilities": ["data-synthesis"]}
]`;

interface ClaudeTaskRaw {
  id: string;
  description: string;
  targetUrl: string | null;
  dependencies: string[];
  priority: number;
  requiredCapabilities?: string[];
}

function parseTasksFromResponse(
  text: string,
  workflowId: string
): Task[] {
  const trimmed = text.trim();
  const jsonStr = trimmed.startsWith("```")
    ? trimmed.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "")
    : trimmed;
  const raw: ClaudeTaskRaw[] = JSON.parse(jsonStr);
  if (!Array.isArray(raw)) {
    throw new Error("Response is not a JSON array");
  }
  return raw.map((t) => ({
    id: t.id,
    workflowId,
    description: typeof t.description === "string" ? t.description : String(t.description),
    targetUrl: t.targetUrl ?? undefined,
    dependencies: Array.isArray(t.dependencies) ? t.dependencies : [],
    status: "pending" as const,
    priority: typeof t.priority === "number" ? t.priority : 0,
  }));
}

export async function decomposeWorkflow(
  input: string,
  workflowId: string = ""
): Promise<Task[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY ?? process.env.HUD_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY or HUD_API_KEY is not set");
  }

  const client = getAnthropicClient();

  const getText = (response: { content: Array<{ type: string; text?: string }> }) => {
    const block = response.content.find((b) => b.type === "text");
    return block && "text" in block ? block.text : "";
  };

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Decompose this workflow into sub-tasks. Respond with ONLY the JSON array, no other text.\n\nUser request: ${input}`,
          },
        ],
      });

      const text = getText(response);
      if (!text) {
        throw new Error("Empty response from Claude");
      }
      return parseTasksFromResponse(text, workflowId);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt === 0 && lastError.message.includes("JSON")) {
        continue;
      }
      throw lastError;
    }
  }

  throw lastError ?? new Error("Failed to decompose workflow");
}
