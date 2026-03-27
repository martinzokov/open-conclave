import { tool } from '@opencode-ai/plugin';
import type { ToolContext } from '@opencode-ai/plugin';
import type { OpencodeClient } from '@opencode-ai/sdk';

export function createOrchestrateTool(client: OpencodeClient) {
  return tool({
    description:
      'Run a multi-agent debate to produce a high-quality synthesized answer. ' +
      'Spawns parallel sub-agents (Harper: research, Benjamin: logic/code, Lucas: creative), ' +
      'runs debate rounds with a Captain moderator, and applies early stopping when consensus is reached.',
    args: {
      query: tool.schema.string().describe('The question or task to deliberate on'),
      maxRounds: tool.schema
        .number()
        .int()
        .min(1)
        .max(10)
        .optional()
        .describe('Maximum debate rounds (default: 5)'),
      debug: tool.schema
        .boolean()
        .optional()
        .describe('Return full debate transcript in addition to answer (default: false)'),
    },
    async execute(
      args: { query: string; maxRounds?: number; debug?: boolean },
      context: ToolContext,
    ): Promise<string> {
      // Inline import to avoid circular dependencies at module load time
      const { resolveSubAgentModels } = await import('../config/loader.ts');
      const { CaptainOrchestrator } = await import('../orchestrator/captain.ts');
      const { DEFAULT_SUB_AGENTS } = await import('../agents/prompts.ts');

      const resolvedConfig = await resolveSubAgentModels(client, context, [...DEFAULT_SUB_AGENTS]);
      const captain = new CaptainOrchestrator(client, context, resolvedConfig);
      return captain.run({
        query: args.query,
        maxRounds: args.maxRounds ?? 5,
        debug: args.debug ?? false,
      });
    },
  });
}
