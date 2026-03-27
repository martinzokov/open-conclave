import type { Plugin } from '@opencode-ai/plugin';
import {
  CONCLAVE_ROUTER_PROMPT,
  CAPTAIN_PROMPT,
  HARPER_PROMPT,
  BENJAMIN_PROMPT,
  LUCAS_PROMPT,
} from './agents/prompts.ts';
import { createOrchestrateTool } from './tools/orchestrate.ts';

export const ConclavePlugin: Plugin = async ({ client }) => {
  const orchestrateTool = createOrchestrateTool(client);

  return {
    tool: {
      conclave: orchestrateTool,
    },

    async config(config) {
      config.agent ??= {};
      config.command ??= {};

      // Primary agent — visible as a tab in the OpenCode TUI
      config.agent['conclave'] = {
        mode: 'primary',
        description: 'Multi-agent debate orchestrator (Captain + Harper + Benjamin + Lucas)',
        prompt: CONCLAVE_ROUTER_PROMPT,
        color: '#7C3AED',
        tools: { conclave: true },
      };

      // Sub-agents — not shown in tabs, addressable by child sessions
      config.agent['conclave-captain'] = {
        mode: 'subagent',
        description: 'Debate moderator: decomposes queries, critiques rounds, synthesizes answers',
        prompt: CAPTAIN_PROMPT,
      };

      config.agent['conclave-harper'] = {
        mode: 'subagent',
        description: 'Research & Facts specialist',
        prompt: HARPER_PROMPT,
      };

      config.agent['conclave-benjamin'] = {
        mode: 'subagent',
        description: 'Logic, Math & Code specialist',
        prompt: BENJAMIN_PROMPT,
      };

      config.agent['conclave-lucas'] = {
        mode: 'subagent',
        description: 'Creative & Alternative Perspectives specialist',
        prompt: LUCAS_PROMPT,
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
