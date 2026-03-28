import type { Plugin } from '@opencode-ai/plugin';
import {
  CONCLAVE_ROUTER_PROMPT,
  CAPTAIN_DEFAULT_PERSONA,
  CAPTAIN_STRUCTURE_SECTION,
  HARPER_DEFAULT_PERSONA,
  HARPER_FORMAT_SECTION,
  BENJAMIN_DEFAULT_PERSONA,
  BENJAMIN_FORMAT_SECTION,
  LUCAS_DEFAULT_PERSONA,
  LUCAS_FORMAT_SECTION,
} from './agents/prompts.ts';
import { createOrchestrateTool } from './tools/orchestrate.ts';
import { buildSubAgentPrompt } from './config/loader.ts';

export const ConclavePlugin: Plugin = async ({ client }) => {
  const orchestrateTool = createOrchestrateTool(client);

  return {
    tool: {
      conclave: orchestrateTool,
    },

    async config(config) {
      config.agent ??= {};
      config.command ??= {};

      // Snapshot existing user-provided agent configs before we write defaults.
      // This preserves model, temperature, and persona overrides from opencode.json.
      process.stderr.write(`[conclave] config hook  raw agent keys: ${JSON.stringify(Object.keys(config.agent ?? {}))}\n`);
      process.stderr.write(`[conclave] config hook  harper raw: ${JSON.stringify(config.agent?.['conclave-harper'])}\n`);
      const existing = {
        conclave: config.agent['conclave'] ?? {},
        captain: config.agent['conclave-captain'] ?? {},
        harper: config.agent['conclave-harper'] ?? {},
        benjamin: config.agent['conclave-benjamin'] ?? {},
        lucas: config.agent['conclave-lucas'] ?? {},
      };

      // Primary agent — visible as a tab in the OpenCode TUI
      config.agent['conclave'] = {
        ...existing.conclave,
        mode: 'primary',
        description: 'Multi-agent debate orchestrator (Captain + Harper + Benjamin + Lucas)',
        prompt: CONCLAVE_ROUTER_PROMPT,
        color: '#7C3AED',
        tools: { conclave: true },
      };

      // Sub-agents — not shown in tabs, addressable by child sessions.
      // OpenCode stores persona in two places: top-level `persona` AND `options.persona`.
      // Both are applied as the system prompt and would override the combined prompt we build.
      // We consume the user's persona into `prompt` and mirror it in `options.persona` so
      // whichever path OpenCode reads, it gets the full combined system prompt.
      function applyPersona(
        base: Record<string, unknown>,
        builtPrompt: string,
      ): Record<string, unknown> {
        const { persona: _, options, ...rest } = base;
        const mergedOptions =
          options && typeof options === 'object'
            ? { ...(options as Record<string, unknown>), persona: builtPrompt }
            : { persona: builtPrompt };
        return { ...rest, options: mergedOptions, prompt: builtPrompt };
      }

      config.agent['conclave-captain'] = {
        ...applyPersona(
          existing.captain as Record<string, unknown>,
          buildSubAgentPrompt(CAPTAIN_DEFAULT_PERSONA, CAPTAIN_STRUCTURE_SECTION, (existing.captain as Record<string, unknown>).persona),
        ),
        mode: 'subagent',
        description: 'Debate moderator: decomposes queries, critiques rounds, synthesizes answers',
      };

      config.agent['conclave-harper'] = {
        ...applyPersona(
          existing.harper as Record<string, unknown>,
          buildSubAgentPrompt(HARPER_DEFAULT_PERSONA, HARPER_FORMAT_SECTION, (existing.harper as Record<string, unknown>).persona),
        ),
        mode: 'subagent',
        description: 'Research & Facts specialist',
      };

      config.agent['conclave-benjamin'] = {
        ...applyPersona(
          existing.benjamin as Record<string, unknown>,
          buildSubAgentPrompt(BENJAMIN_DEFAULT_PERSONA, BENJAMIN_FORMAT_SECTION, (existing.benjamin as Record<string, unknown>).persona),
        ),
        mode: 'subagent',
        description: 'Logic, Math & Code specialist',
      };

      config.agent['conclave-lucas'] = {
        ...applyPersona(
          existing.lucas as Record<string, unknown>,
          buildSubAgentPrompt(LUCAS_DEFAULT_PERSONA, LUCAS_FORMAT_SECTION, (existing.lucas as Record<string, unknown>).persona),
        ),
        mode: 'subagent',
        description: 'Creative & Alternative Perspectives specialist',
      };

      // Slash command entry point — usable from any agent
      config.command['conclave'] = {
        description: 'Run a multi-agent debate on a question or task',
        template: 'Run a multi-agent debate on: $ARGUMENTS',
        agent: 'conclave',
        subtask: false,
      };
    },
  };
};
