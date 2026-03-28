import { describe, it, expect, vi } from 'vitest';
import { resolveSubAgentModels, buildSubAgentPrompt } from './loader.ts';
import type { SubAgentDef } from '../types.ts';

const subAgents: SubAgentDef[] = [
  { name: 'conclave-harper', role: 'Research & Facts' },
  { name: 'conclave-benjamin', role: 'Logic & Code' },
];

function makeClient(agentConfig: Record<string, { model?: string; persona?: string }> = {}) {
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

    expect(result.captain.providerID).toBeTruthy();
    expect(result.captain.modelID).toBeTruthy();
    expect(result.subAgents[0].model.providerID).toBeTruthy();
  });

  it('falls back when model string is missing from agent entry', async () => {
    const client = makeClient({ 'conclave-harper': {} });
    const result = await resolveSubAgentModels(client, context, subAgents);
    expect(result.subAgents[0].model.providerID).toBeTruthy();
  });

  it('handles malformed provider/model string by using it as modelID with unknown provider', async () => {
    const client = makeClient({ 'conclave-captain': { model: 'just-a-model-no-slash' } });
    const result = await resolveSubAgentModels(client, context, subAgents);
    expect(result.captain.modelID).toBe('just-a-model-no-slash');
  });

  it('reads persona override from agent config at runtime', async () => {
    const client = makeClient({
      'conclave-harper': { persona: 'You are Harper, a financial analyst.' },
    });
    const result = await resolveSubAgentModels(client, context, subAgents);
    expect(result.subAgents[0].persona).toBe('You are Harper, a financial analyst.');
  });

  it('returns undefined persona when not configured', async () => {
    const client = makeClient({ 'conclave-harper': {} });
    const result = await resolveSubAgentModels(client, context, subAgents);
    expect(result.subAgents[0].persona).toBeUndefined();
  });
});

describe('buildSubAgentPrompt', () => {
  const DEFAULT_PERSONA = 'You are Harper, a Research & Facts specialist.\n\nYour role: provide factual analysis.';
  const FORMAT_SECTION = 'Always respond with a JSON object in a code fence:\n```json\n{}\n```';

  it('returns default persona + format section when no override', () => {
    const result = buildSubAgentPrompt(DEFAULT_PERSONA, FORMAT_SECTION);
    expect(result).toContain(DEFAULT_PERSONA);
    expect(result).toContain(FORMAT_SECTION);
    expect(result.indexOf(DEFAULT_PERSONA)).toBeLessThan(result.indexOf(FORMAT_SECTION));
  });

  it('replaces persona section when user persona is provided', () => {
    const userPersona = 'You are Harper, a financial analyst.';
    const result = buildSubAgentPrompt(DEFAULT_PERSONA, FORMAT_SECTION, userPersona);
    expect(result).toContain(userPersona);
    expect(result).not.toContain(DEFAULT_PERSONA);
    expect(result).toContain(FORMAT_SECTION);
  });

  it('always preserves the format section regardless of persona override', () => {
    const result = buildSubAgentPrompt(DEFAULT_PERSONA, FORMAT_SECTION, 'Custom persona.');
    expect(result).toContain(FORMAT_SECTION);
  });

  it('uses default persona when userPersona is undefined', () => {
    expect(buildSubAgentPrompt(DEFAULT_PERSONA, FORMAT_SECTION, undefined)).toContain(DEFAULT_PERSONA);
  });

  it('ignores non-string persona values', () => {
    // @ts-expect-error testing runtime safety
    const result = buildSubAgentPrompt(DEFAULT_PERSONA, FORMAT_SECTION, 42);
    expect(result).toContain(DEFAULT_PERSONA);
    expect(result).not.toContain('42');
  });
});
