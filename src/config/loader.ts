import type { OpencodeClient } from '@opencode-ai/sdk';
import type { ToolContext } from '@opencode-ai/plugin';
import type { ModelRef, SubAgentDef, ResolvedConfig } from '../types.ts';

/**
 * Resolves the final system prompt for a conclave agent.
 *
 * Priority order:
 *   1. userConfig.prompt  — full replacement (user wrote their own prompt)
 *   2. default + "\n\n" + userConfig.promptExtra  — append mode (user added instructions)
 *   3. default  — no customisation
 */
export function mergeAgentPrompt(
  defaultPrompt: string,
  userConfig: Record<string, unknown> | undefined,
): string {
  const userPrompt = typeof userConfig?.prompt === 'string' ? userConfig.prompt : null;
  const promptExtra = typeof userConfig?.promptExtra === 'string' ? userConfig.promptExtra : null;

  if (userPrompt) return userPrompt;
  if (promptExtra) return `${defaultPrompt}\n\n${promptExtra}`;
  return defaultPrompt;
}

function parseModelString(model: string | undefined, fallback: ModelRef): ModelRef {
  if (!model) return fallback;
  const slash = model.indexOf('/');
  if (slash === -1) return { providerID: 'unknown', modelID: model };
  return {
    providerID: model.slice(0, slash),
    modelID: model.slice(slash + 1),
  };
}

/**
 * Reads config.agent['conclave-X'].model for each sub-agent.
 * Falls back to the global config.model when a per-agent model is not configured.
 */
export async function resolveSubAgentModels(
  client: OpencodeClient,
  _context: ToolContext,
  subAgents: SubAgentDef[],
): Promise<ResolvedConfig> {
  const configResult = await client.config.get();
  const data = configResult.data as {
    model?: string;
    agent?: Record<string, { model?: string }>;
  } | undefined;

  const agentConfig = data?.agent ?? {};
  // Use the global OpenCode model as fallback (e.g. "github-copilot/claude-sonnet-4.5")
  const globalFallback = parseModelString(data?.model, { providerID: 'github-copilot', modelID: 'claude-sonnet-4.5' });

  const captainModel = parseModelString(agentConfig['conclave-captain']?.model, globalFallback);

  const resolvedSubAgents = subAgents.map((sa) => ({
    ...sa,
    model: parseModelString(agentConfig[sa.name]?.model, globalFallback),
  }));

  return { captain: captainModel, subAgents: resolvedSubAgents };
}
