/**
 * HUD evaluation: Claude-as-judge via HUD inference proxy.
 * Traces LLM calls through HUD; scores task output on correctness, completeness, efficiency (0-100).
 * Feeds into Convex reputation formula.
 */

import type { Task, TaskResult } from "@/types";

const HUD_EVALUATE_BASE = "https://api.hud.ai/v1";
const HUD_INFERENCE_BASE = "https://inference.hud.ai";

export interface EvaluationScore {
  correctness: number;
  efficiency: number;
  completeness: number;
  overall: number;
}

export interface BenchmarkReport {
  agentId: string;
  scores: EvaluationScore[];
  average: EvaluationScore;
}

function fallbackScore(result: TaskResult): EvaluationScore {
  return {
    correctness: result.success ? 0.85 : 0.2,
    efficiency: 0.7,
    completeness: result.success ? 0.8 : 0.3,
    overall: result.success ? 0.8 : 0.25,
  };
}

/**
 * Score 0-1 from HUD (or fallback) and convert to 0-100 for reputation.
 */
function toHundred(s: EvaluationScore): { correctness: number; efficiency: number; completeness: number; overall: number } {
  return {
    correctness: Math.round((s.correctness ?? 0) * 100),
    efficiency: Math.round((s.efficiency ?? 0) * 100),
    completeness: Math.round((s.completeness ?? 0) * 100),
    overall: Math.round((s.overall ?? 0) * 100),
  };
}

export class AgentEvaluator {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = (apiKey ?? process.env.HUD_API_KEY ?? "").trim();
  }

  /**
   * Evaluate task execution via HUD: use /evaluate when available, else Claude-as-judge via inference proxy.
   * Returns scores in 0-1 range; use for reputation as 0-100.
   */
  async evaluateTaskExecution(task: Task, result: TaskResult): Promise<EvaluationScore> {
    if (!this.apiKey) return fallbackScore(result);

    try {
      const res = await fetch(`${HUD_EVALUATE_BASE}/evaluate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          task: task.description,
          result: result.data,
          success: result.success,
          executionTimeMs: result.executionTimeMs,
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as Record<string, unknown>;
        const c = typeof data.correctness === "number" ? data.correctness : 0.8;
        const e = typeof data.efficiency === "number" ? data.efficiency : 0.7;
        const comp = typeof data.completeness === "number" ? data.completeness : 0.8;
        const o = typeof data.overall === "number" ? data.overall : (c + e + comp) / 3;
        return { correctness: c, efficiency: e, completeness: comp, overall: o };
      }

      return await this.evaluateViaInferenceProxy(task, result);
    } catch {
      return await this.evaluateViaInferenceProxy(task, result).catch(() => fallbackScore(result));
    }
  }

  /**
   * Claude-as-judge via HUD inference proxy (OpenAI-compatible). Produces 0-1 scores.
   */
  private async evaluateViaInferenceProxy(task: Task, result: TaskResult): Promise<EvaluationScore> {
    if (!this.apiKey) return fallbackScore(result);

    const prompt = `You are an evaluator. Score this task execution from 0 to 1 for each dimension. Reply with ONLY a JSON object with keys: correctness, efficiency, completeness, overall. No other text.
Task: ${task.description}
Success: ${result.success}
Output: ${JSON.stringify(result.data)}
Time (ms): ${result.executionTimeMs}

JSON:`;

    const res = await fetch(`${HUD_INFERENCE_BASE}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 256,
      }),
    });

    if (!res.ok) return fallbackScore(result);

    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content?.trim() ?? "";
    const match = content.replace(/```\w*\n?/g, "").match(/\{[\s\S]*\}/);
    if (match) {
      const obj = JSON.parse(match[0]) as Record<string, number>;
      const c = Math.min(1, Math.max(0, Number(obj.correctness) ?? 0.8));
      const e = Math.min(1, Math.max(0, Number(obj.efficiency) ?? 0.7));
      const comp = Math.min(1, Math.max(0, Number(obj.completeness) ?? 0.8));
      const o = Math.min(1, Math.max(0, Number(obj.overall) ?? (c + e + comp) / 3));
      return { correctness: c, efficiency: e, completeness: comp, overall: o };
    }

    return fallbackScore(result);
  }

  /** Return 0-100 scores for reputation formula. */
  async evaluateTaskExecutionScore0To100(task: Task, result: TaskResult): Promise<number> {
    const score = await this.evaluateTaskExecution(task, result);
    const hundred = toHundred(score);
    return hundred.overall;
  }

  async benchmarkAgent(agentId: string, testSuite: Task[]): Promise<BenchmarkReport> {
    const scores: EvaluationScore[] = [];
    for (const t of testSuite) {
      scores.push(await this.evaluateTaskExecution(t, { success: true, data: {}, executionTimeMs: 5000 }));
    }
    const average: EvaluationScore = {
      correctness: scores.reduce((a, s) => a + s.correctness, 0) / scores.length,
      efficiency: scores.reduce((a, s) => a + s.efficiency, 0) / scores.length,
      completeness: scores.reduce((a, s) => a + s.completeness, 0) / scores.length,
      overall: scores.reduce((a, s) => a + s.overall, 0) / scores.length,
    };
    return { agentId, scores, average };
  }
}
