import { describe, it, expect, vi } from 'vitest';
import { SubAgentRunner } from './subagent.ts';
import type { ModelRef, SubAgentInput } from '../types.ts';
import type { OpencodeClient } from '@opencode-ai/sdk';

const model: ModelRef = { providerID: 'openai', modelID: 'gpt-4o' };

const input: SubAgentInput = {
  sessionID: 'parent-sess',
  query: 'What is the best sorting algorithm?',
  subtasks: ['Research time complexity', 'Consider practical trade-offs'],
  recentHistory: [],
  roundNumber: 1,
};

function makeValidJsonResponse(answer: string): string {
  return JSON.stringify({
    agentName: 'Harper',
    role: 'Research & Facts',
    claims: [{ text: 'Quicksort is O(n log n) average.', confidence: 0.9 }],
    reasoning: 'Standard computer science knowledge.',
    uncertainties: [],
    answer,
  });
}

function makeClient(responseText: string): OpencodeClient {
  return {
    session: {
      create: vi.fn().mockResolvedValue({ data: { id: 'child-sess-001' } }),
      prompt: vi.fn().mockResolvedValue({
        data: {
          info: { id: 'msg-001' },
          parts: [{ type: 'text', text: `\`\`\`json\n${responseText}\n\`\`\`` }],
        },
      }),
      delete: vi.fn().mockResolvedValue({ data: true }),
    },
  } as unknown as OpencodeClient;
}

describe('SubAgentRunner', () => {
  it('creates a child session with parentID', async () => {
    const client = makeClient(makeValidJsonResponse('Quicksort is best overall.'));
    const runner = new SubAgentRunner(client, 'conclave-harper', model);
    await runner.run(input);

    expect(client.session.create).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.objectContaining({ parentID: 'parent-sess' }) }),
    );
  });

  it('sends prompt with agent and model override', async () => {
    const client = makeClient(makeValidJsonResponse('Answer here.'));
    const runner = new SubAgentRunner(client, 'conclave-harper', model);
    await runner.run(input);

    expect(client.session.prompt).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          agent: 'conclave-harper',
          model: { providerID: 'openai', modelID: 'gpt-4o' },
        }),
      }),
    );
  });

  it('returns parsed AgentResponse on valid JSON', async () => {
    const client = makeClient(makeValidJsonResponse('Quicksort wins.'));
    const runner = new SubAgentRunner(client, 'conclave-harper', model);
    const result = await runner.run(input);

    expect(result.agentName).toBe('Harper');
    expect(result.answer).toBe('Quicksort wins.');
    expect(result.claims[0].confidence).toBe(0.9);
  });

  it('falls back to raw-text AgentResponse on JSON parse failure', async () => {
    const client = makeClient('This is plain text, not JSON.');
    const runner = new SubAgentRunner(client, 'conclave-harper', model);
    const result = await runner.run(input);

    expect(result.agentName).toBe('conclave-harper');
    expect(result.claims[0].confidence).toBe(0.5);
    expect(result.answer).toContain('plain text');
  });

  it('deletes child session after successful run', async () => {
    const client = makeClient(makeValidJsonResponse('ok'));
    const runner = new SubAgentRunner(client, 'conclave-harper', model);
    await runner.run(input);

    expect(client.session.delete).toHaveBeenCalledWith(
      expect.objectContaining({ path: expect.objectContaining({ id: 'child-sess-001' }) }),
    );
  });
});
