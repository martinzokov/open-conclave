import type { Plugin } from '@opencode-ai/plugin';
import {
  CONCLAVE_ROUTER_PROMPT,
  CAPTAIN_PROMPT,
  HARPER_PROMPT,
  BENJAMIN_PROMPT,
  LUCAS_PROMPT,
} from './agents/prompts.ts';
import { createOrchestrateTool } from './tools/orchestrate.ts';
import { mergeAgentPrompt } from './config/loader.ts';

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
      // This preserves any user overrides (model, temperature, promptExtra, prompt, etc.)
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
        prompt: mergeAgentPrompt(CONCLAVE_ROUTER_PROMPT, existing.conclave),
        color: '#7C3AED',
        tools: { conclave: true },
      };

      // Sub-agents — not shown in tabs, addressable by child sessions
      config.agent['conclave-captain'] = {
        ...existing.captain,
        mode: 'subagent',
        description: 'Debate moderator: decomposes queries, critiques rounds, synthesizes answers',
        prompt: mergeAgentPrompt(CAPTAIN_PROMPT, existing.captain),
      };

      config.agent['conclave-harper'] = {
        ...existing.harper,
        mode: 'subagent',
        description: 'Research & Facts specialist',
        prompt: mergeAgentPrompt(HARPER_PROMPT, existing.harper),
      };

      config.agent['conclave-benjamin'] = {
        ...existing.benjamin,
        mode: 'subagent',
        description: 'Logic, Math & Code specialist',
        prompt: mergeAgentPrompt(BENJAMIN_PROMPT, existing.benjamin),
      };

      config.agent['conclave-lucas'] = {
        ...existing.lucas,
        mode: 'subagent',
        description: 'Creative & Alternative Perspectives specialist',
        prompt: mergeAgentPrompt(LUCAS_PROMPT, existing.lucas),
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
