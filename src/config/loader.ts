import type { OpencodeClient } from '@opencode-ai/sdk';
import type { ToolContext } from '@opencode-ai/plugin';
import type { ModelRef, SubAgentDef, ResolvedConfig } from '../types.ts';

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
