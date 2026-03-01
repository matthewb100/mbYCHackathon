/**
 * Browser Use Cloud API v2 with live session URLs.
 * - Create: POST /tasks → { id, sessionId }
 * - Live URL: GET /sessions/{sessionId} → { liveUrl }
 * - Poll: GET /tasks/{taskId} every 3s until completed/failed
 * - Stop: PATCH /sessions/{sessionId} { action: "stop" }
 * Headers: X-Browser-Use-API-Key, Content-Type: application/json
 */

import type { Agent, Bid, Task, TaskResult } from "@/types";

const DEFAULT_BASE_URL = "https://api.browser-use.com/api/v2";
const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 50; // 150s
const TASK_TIMEOUT_MS = 150_000;

export interface ExecuteTaskOptions {
  onLiveUrl?: (liveUrl: string, sessionId: string) => void | Promise<void>;
  onPoll?: (data: { status?: string; step?: string; action?: string; [key: string]: unknown }) => void | Promise<void>;
}

export class BrowserAgent {
  private apiKey: string;
  private baseUrl: string;
  private agentProfile: Agent;

  constructor(apiKey: string, agentProfile: Agent, baseUrl?: string) {
    this.apiKey = (apiKey ?? "").trim();
    const base = (baseUrl ?? process.env.BROWSER_USE_API_URL ?? DEFAULT_BASE_URL).toString().trim().replace(/\/+$/, "");
    this.baseUrl = base;
    this.agentProfile = agentProfile;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    if (!this.apiKey) {
      throw new Error("BROWSER_USE_API_KEY is not set or empty. Add it to your .env and restart the dev server.");
    }
    const pathNorm = path.startsWith("/") ? path : `/${path}`;
    const url = `${this.baseUrl}${pathNorm}`;
    const headers: Record<string, string> = {
      "X-Browser-Use-API-Key": this.apiKey,
      "Content-Type": "application/json",
    };
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Browser Use API ${res.status}: ${text || res.statusText}`);
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      return { raw: text } as T;
    }
  }

  async executeTask(task: Task, options?: ExecuteTaskOptions): Promise<TaskResult> {
    const start = Date.now();
    const { onLiveUrl, onPoll } = options ?? {};
    let lastError: Error | null = null;
    const taskDescription =
      task.targetUrl && task.targetUrl.trim()
        ? `Open ${task.targetUrl.trim()} and then: ${task.description}`
        : task.description;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const createRes = await this.request<Record<string, unknown>>("POST", "/tasks", { task: taskDescription });
        const taskId = String(createRes.id ?? (createRes as { id?: string }).id ?? "");
        if (!taskId) throw new Error("No task id in response: " + JSON.stringify(createRes));

        let sessionId: string | undefined =
          (createRes.sessionId as string) ??
          (createRes.session_id as string) ??
          (createRes.browserSessionId as string);
        let liveUrl: string | null =
          (createRes.liveUrl as string) ??
          (createRes.live_url as string) ??
          (createRes.viewerUrl as string) ??
          (createRes.viewer_url as string) ??
          (createRes.streamUrl as string) ??
          null;

        if (!liveUrl && sessionId) {
          try {
            const sessionRes = await this.request<Record<string, unknown>>("GET", `/sessions/${sessionId}`);
            liveUrl =
              (sessionRes.liveUrl as string) ??
              (sessionRes.live_url as string) ??
              (sessionRes.viewerUrl as string) ??
              (sessionRes.viewer_url as string) ??
              (sessionRes.streamUrl as string) ??
              null;
          } catch {
            // continue
          }
        }

        // Poll GET /tasks/{taskId} for session or live URL (backend may attach after a short delay)
        for (let i = 0; i < 12 && !liveUrl; i++) {
          await new Promise((r) => setTimeout(r, 1000));
          try {
            const taskRes = await this.request<Record<string, unknown>>("GET", `/tasks/${taskId}`);
            liveUrl =
              (taskRes.liveUrl as string) ??
              (taskRes.live_url as string) ??
              (taskRes.viewerUrl as string) ??
              (taskRes.viewer_url as string) ??
              (taskRes.streamUrl as string) ??
              (taskRes.stream_url as string) ??
              null;
            const sid =
              (taskRes.sessionId as string) ??
              (taskRes.session_id as string) ??
              (taskRes.browserSessionId as string);
            if (sid) sessionId = sid;
            if (!liveUrl && sessionId) {
              const sessionRes = await this.request<Record<string, unknown>>("GET", `/sessions/${sessionId}`);
              liveUrl =
                (sessionRes.liveUrl as string) ??
                (sessionRes.live_url as string) ??
                (sessionRes.viewerUrl as string) ??
                (sessionRes.viewer_url as string) ??
                (sessionRes.streamUrl as string) ??
                null;
            }
            if (liveUrl) break;
          } catch {
            // continue polling
          }
        }

        if (liveUrl && onLiveUrl) {
          await Promise.resolve(onLiveUrl(liveUrl, sessionId ?? ""));
        }

        const result = await this.pollForResult(taskId, sessionId ?? undefined, start, onPoll);
        return result;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < 2) await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }

    throw lastError ?? new Error("executeTask failed after retries");
  }

  private async pollForResult(
    taskId: string,
    sessionId: string | undefined,
    startTime: number,
    onPoll?: ExecuteTaskOptions["onPoll"]
  ): Promise<TaskResult> {
    let polls = 0;
    while (polls < MAX_POLLS) {
      if (Date.now() - startTime > TASK_TIMEOUT_MS) {
        if (sessionId) {
          try {
            await this.request("PATCH", `/sessions/${sessionId}`, { action: "stop" });
          } catch {
            // ignore
          }
        }
        return {
          success: false,
          data: { error: "Task timeout" },
          executionTimeMs: Date.now() - startTime,
        };
      }

      const taskView = await this.request<{
        status?: string;
        output?: unknown;
        screenshot_url?: string;
        screenshot?: string;
        step?: string;
        action?: string;
        nextGoal?: string;
        [key: string]: unknown;
      }>("GET", `/tasks/${taskId}`);

      const status = (taskView.status ?? "").toLowerCase();
      if (onPoll) {
        await Promise.resolve(
          onPoll({
            status,
            step: taskView.step ?? taskView.nextGoal,
            action: taskView.action,
            ...taskView,
          })
        );
      }

      if (status === "completed" || status === "finished") {
        if (sessionId) {
          try {
            await this.request("PATCH", `/sessions/${sessionId}`, { action: "stop" });
          } catch {
            // ignore
          }
        }
        const executionTimeMs = Date.now() - startTime;
        const data = taskView.output ?? taskView;
        const screenshotUrl = taskView.screenshot_url ?? taskView.screenshot;
        return {
          success: true,
          data: typeof data === "object" && data !== null ? data : { output: data },
          executionTimeMs,
          screenshotUrl: typeof screenshotUrl === "string" ? screenshotUrl : undefined,
        };
      }
      if (status === "stopped" || status === "failed" || status === "error") {
        if (sessionId) {
          try {
            await this.request("PATCH", `/sessions/${sessionId}`, { action: "stop" });
          } catch {
            // ignore
          }
        }
        return {
          success: false,
          data: taskView.output ?? taskView ?? { status },
          executionTimeMs: Date.now() - startTime,
        };
      }

      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      polls++;
    }

    if (sessionId) {
      try {
        await this.request("PATCH", `/sessions/${sessionId}`, { action: "stop" });
      } catch {
        // ignore
      }
    }
    return {
      success: false,
      data: { error: "Poll timeout" },
      executionTimeMs: Date.now() - startTime,
    };
  }

  bid(task: Task): Bid {
    const requiredCaps = (task as Task & { requiredCapabilities?: string[] }).requiredCapabilities ?? [];
    let confidence = 0;
    if (requiredCaps.length > 0) {
      const match = requiredCaps.filter((c) => this.agentProfile.capabilities.includes(c)).length;
      confidence += 0.3 * (match / requiredCaps.length);
    } else {
      confidence += 0.3;
    }
    const domain = task.targetUrl ? new URL(task.targetUrl).hostname.replace(/^www\./, "") : "";
    if (domain && this.agentProfile.specializedDomains.some((d) => domain.includes(d))) {
      confidence += 0.3;
    } else if (!domain) {
      confidence += 0.15;
    }
    confidence += 0.2 * (this.agentProfile.reputationScore / 100);
    const loadFactor = this.agentProfile.currentLoad < this.agentProfile.maxConcurrency ? 0.2 : 0.05;
    confidence += loadFactor;
    confidence = Math.min(1, Math.max(0, confidence));
    const estimatedTimeMs = 15_000 + Math.random() * 10_000;
    const reasoning = `Capabilities match; reputation ${this.agentProfile.reputationScore}; load ${this.agentProfile.currentLoad}/${this.agentProfile.maxConcurrency}.`;
    return {
      agentId: this.agentProfile.id,
      taskId: task.id,
      confidenceScore: confidence,
      estimatedTimeMs,
      reasoning,
    };
  }
}
