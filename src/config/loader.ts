import type { OpencodeClient } from '@opencode-ai/sdk';
import type { ToolContext } from '@opencode-ai/plugin';
import type { ModelRef, SubAgentDef, ResolvedConfig } from '../types.ts';

const FALLBACK_MODEL: ModelRef = { providerID: 'anthropic', modelID: 'claude-sonnet-4-6' };

function parseModelString(model: string | undefined): ModelRef {
  if (!model) return FALLBACK_MODEL;
  const slash = model.indexOf('/');
  if (slash === -1) return { providerID: 'unknown', modelID: model };
  return {
    providerID: model.slice(0, slash),
    modelID: model.slice(slash + 1),
  };
}

/**
 * Reads config.agent['conclave-X'].model for each sub-agent.
 * Falls back to FALLBACK_MODEL when not configured.
 */
export async function resolveSubAgentModels(
  client: OpencodeClient,
  _context: ToolContext,
  subAgents: SubAgentDef[],
): Promise<ResolvedConfig> {
  const configResult = await client.config.get();
  const agentConfig =
    (configResult.data as { agent?: Record<string, { model?: string }> } | undefined)?.agent ?? {};

  const captainModel = parseModelString(agentConfig['conclave-captain']?.model);

  const resolvedSubAgents = subAgents.map((sa) => ({
    ...sa,
    model: parseModelString(agentConfig[sa.name]?.model),
  }));

  return { captain: captainModel, subAgents: resolvedSubAgents };
}
