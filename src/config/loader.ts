import type { OpencodeClient } from '@opencode-ai/sdk';
import type { ToolContext } from '@opencode-ai/plugin';
import type { ModelRef, SubAgentDef, ResolvedConfig } from '../types.ts';

/**
 * Builds the final system prompt for a sub-agent by combining a persona section
 * with a fixed format section.
 *
 * The persona section (identity, role, focus) is replaceable via the `persona`
 * config field. The format section (JSON schema requirements) is always preserved.
 *
 * If userPersona is not a string, the default persona is used unchanged.
 */
export function buildSubAgentPrompt(
  defaultPersona: string,
  formatSection: string,
  userPersona?: unknown,
): string {
  const persona = typeof userPersona === 'string' ? userPersona : defaultPersona;
  return `${persona}\n\n${formatSection}`;
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
 * Reads config.agent['conclave-X'].model and .persona for each sub-agent at runtime.
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
    agent?: Record<string, { model?: string; persona?: string }>;
  } | undefined;

  const agentConfig = data?.agent ?? {};
  // Use the global OpenCode model as fallback (e.g. "github-copilot/claude-sonnet-4.5")
  const globalFallback = parseModelString(data?.model, { providerID: 'github-copilot', modelID: 'claude-sonnet-4.5' });

  const captainModel = parseModelString(agentConfig['conclave-captain']?.model, globalFallback);

  const resolvedSubAgents = subAgents.map((sa) => ({
    ...sa,
    model: parseModelString(agentConfig[sa.name]?.model, globalFallback),
    persona: agentConfig[sa.name]?.persona,
  }));

  return { captain: captainModel, subAgents: resolvedSubAgents };
}
