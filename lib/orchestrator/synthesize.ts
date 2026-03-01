/**
 * Synthesis: single Claude call to compile user request + all task results into a summary.
 * Uses HUD inference when HUD_API_KEY is set so the call is traced.
 */

import { getAnthropicClient } from "@/lib/llm/anthropic-client";

export interface TaskResultForSynthesis {
  logicalId: string;
  description: string;
  success: boolean;
  data: unknown;
  executionTimeMs: number;
}

export async function synthesizeResults(params: {
  userInput: string;
  taskResults: TaskResultForSynthesis[];
}): Promise<string> {
  const { userInput, taskResults } = params;
  let client;
  try {
    client = getAnthropicClient();
  } catch {
    return "Synthesis skipped (no API key).";
  }
  const resultsText = taskResults
    .map(
      (t) =>
        `[${t.logicalId}] ${t.description}\nSuccess: ${t.success}\nTime: ${t.executionTimeMs}ms\nData: ${JSON.stringify(t.data)}\n`
    )
    .join("\n");

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `The user asked: "${userInput}"\n\nWe executed the following tasks. Summarize the outcomes in a clear, concise paragraph for the user.\n\n${resultsText}`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const text = textBlock && "text" in textBlock ? textBlock.text : "";
  return text || "No summary generated.";
}
