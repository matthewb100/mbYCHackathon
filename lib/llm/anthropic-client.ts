/**
 * Shared Anthropic client. When HUD_API_KEY is set, all Claude calls go through
 * https://inference.hud.ai so they are traced on HUD's dashboard.
 */
import Anthropic from "@anthropic-ai/sdk";

const HUD_BASE = "https://inference.hud.ai";

export function getAnthropicClient(): Anthropic {
  const hudKey = (process.env.HUD_API_KEY ?? "").trim();
  if (hudKey) {
    return new Anthropic({
      apiKey: hudKey,
      baseURL: HUD_BASE,
    });
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY or HUD_API_KEY must be set");
  return new Anthropic({ apiKey });
}
