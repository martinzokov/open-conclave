import { describe, it, expect, vi } from 'vitest';
import { resolveSubAgentModels, mergeAgentPrompt } from './loader.ts';
import type { SubAgentDef } from '../types.ts';

const subAgents: SubAgentDef[] = [
  { name: 'conclave-harper', role: 'Research & Facts' },
  { name: 'conclave-benjamin', role: 'Logic & Code' },
];

function makeClient(agentConfig: Record<string, { model?: string }> = {}) {
  return {
    config: {
      get: vi.fn().mockResolvedValue({
        data: {
          agent: agentConfig,
        },
      }),
    },
  } as unknown as Parameters<typeof resolveSubAgentModels>[0];
}

const context = {
  sessionID: 'sess-001',
  messageID: 'msg-001',
  agent: 'conclave',
  abort: new AbortController().signal,
};

describe('resolveSubAgentModels', () => {
  it('parses provider/model string into ModelRef', async () => {
    const client = makeClient({
      'conclave-captain': { model: 'anthropic/claude-opus-4-6' },
      'conclave-harper': { model: 'openai/gpt-4o' },
      'conclave-benjamin': { model: 'google/gemini-2.5-pro' },
    });

    const result = await resolveSubAgentModels(client, context, subAgents);

    expect(result.captain).toEqual({ providerID: 'anthropic', modelID: 'claude-opus-4-6' });
    expect(result.subAgents[0].model).toEqual({ providerID: 'openai', modelID: 'gpt-4o' });
    expect(result.subAgents[1].model).toEqual({ providerID: 'google', modelID: 'gemini-2.5-pro' });
  });

  it('falls back to default model when agent config is absent', async () => {
    const client = makeClient({});
    const result = await resolveSubAgentModels(client, context, subAgents);

    // Falls back to a default model ref when not configured
    expect(result.captain.providerID).toBeTruthy();
    expect(result.captain.modelID).toBeTruthy();
    expect(result.subAgents[0].model.providerID).toBeTruthy();
  });

  it('falls back when model string is missing from agent entry', async () => {
    const client = makeClient({
      'conclave-harper': {},
    });
    const result = await resolveSubAgentModels(client, context, subAgents);
    expect(result.subAgents[0].model.providerID).toBeTruthy();
  });

  it('handles malformed provider/model string by using it as modelID with unknown provider', async () => {
    const client = makeClient({
      'conclave-captain': { model: 'just-a-model-no-slash' },
    });
    const result = await resolveSubAgentModels(client, context, subAgents);
    expect(result.captain.modelID).toBe('just-a-model-no-slash');
  });
});

describe('mergeAgentPrompt', () => {
  const DEFAULT = 'You are Harper, a Research specialist.';

  it('returns the default when userConfig is undefined', () => {
    expect(mergeAgentPrompt(DEFAULT, undefined)).toBe(DEFAULT);
  });

  it('returns the default when userConfig has no prompt or promptExtra', () => {
    expect(mergeAgentPrompt(DEFAULT, {})).toBe(DEFAULT);
  });

  it('returns user prompt when prompt is set (full override)', () => {
    const userConfig = { prompt: 'Custom full prompt.' };
    expect(mergeAgentPrompt(DEFAULT, userConfig)).toBe('Custom full prompt.');
  });

  it('appends promptExtra to the default when only promptExtra is set', () => {
    const userConfig = { promptExtra: 'Always cite sources with URLs.' };
    const result = mergeAgentPrompt(DEFAULT, userConfig);
    expect(result).toContain(DEFAULT);
    expect(result).toContain('Always cite sources with URLs.');
    expect(result.indexOf(DEFAULT)).toBeLessThan(result.indexOf('Always cite sources'));
  });

  it('full override wins over promptExtra when both are set', () => {
    const userConfig = { prompt: 'My override.', promptExtra: 'Ignored.' };
    expect(mergeAgentPrompt(DEFAULT, userConfig)).toBe('My override.');
  });

  it('ignores prompt field if it is not a string', () => {
    const userConfig = { prompt: 42 };
    expect(mergeAgentPrompt(DEFAULT, userConfig)).toBe(DEFAULT);
  });

  it('ignores promptExtra field if it is not a string', () => {
    const userConfig = { promptExtra: true };
    expect(mergeAgentPrompt(DEFAULT, userConfig)).toBe(DEFAULT);
  });
});
