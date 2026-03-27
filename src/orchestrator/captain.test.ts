import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CaptainOrchestrator } from './captain.ts';
import type { OrchestrateArgs, ResolvedConfig, AgentResponse } from '../types.ts';
import type { OpencodeClient } from '@opencode-ai/sdk';
import type { ToolContext } from '@opencode-ai/plugin';

const context: ToolContext = {
  sessionID: 'sess-main',
  messageID: 'msg-main',
  agent: 'conclave',
  abort: new AbortController().signal,
};

const resolvedConfig: ResolvedConfig = {
  captain: { providerID: 'anthropic', modelID: 'claude-opus-4-6' },
  subAgents: [
    { name: 'conclave-harper', role: 'Research', model: { providerID: 'openai', modelID: 'gpt-4o' } },
    { name: 'conclave-benjamin', role: 'Logic', model: { providerID: 'anthropic', modelID: 'claude-sonnet-4-6' } },
  ],
};

function makeDecomposeResponse(subtasks: string[]): string {
  return `\`\`\`json\n${JSON.stringify({ subtasks })}\n\`\`\``;
}

function makeCritiqueResponse(score: number, issues: string[]): string {
  return `\`\`\`json\n${JSON.stringify({
    consensusScore: score,
    uncertaintyDelta: 0.05,
    openIssues: issues,
    synthesis: 'interim synthesis',
  })}\n\`\`\``;
}

function makeSubAgentResponse(answer: string): string {
  const resp: AgentResponse = {
    agentName: 'Harper',
    role: 'Research',
    claims: [{ text: answer, confidence: 0.8 }],
    reasoning: 'test reasoning',
    uncertainties: [],
    answer,
  };
  return `\`\`\`json\n${JSON.stringify(resp)}\n\`\`\``;
}

function makeClient(responses: string[]): OpencodeClient {
  let callCount = 0;
  return {
    session: {
      create: vi.fn().mockResolvedValue({ data: { id: `child-${++callCount}` } }),
      prompt: vi.fn().mockImplementation(() => {
        const text = responses.shift() ?? 'Final synthesized answer.';
        return Promise.resolve({
          data: {
            info: { id: 'msg-x' },
            parts: [{ type: 'text', text }],
          },
        });
      }),
      delete: vi.fn().mockResolvedValue({ data: true }),
    },
  } as unknown as OpencodeClient;
}

describe('CaptainOrchestrator', () => {
  const args: OrchestrateArgs = { query: 'Best database for read-heavy workloads?', maxRounds: 3, debug: false };

  it('returns a string result', async () => {
    // decompose → subagent1 → subagent2 → critique (stop) → synthesize
    const client = makeClient([
      makeDecomposeResponse(['Research options', 'Evaluate trade-offs']),
      makeSubAgentResponse('PostgreSQL is excellent for reads.'),
      makeSubAgentResponse('Indexing is key for performance.'),
      makeCritiqueResponse(0.95, []), // all soft conditions met → stop after round 1
      'PostgreSQL with proper indexing is the best choice.',
    ]);

    const captain = new CaptainOrchestrator(client, context, resolvedConfig);
    const result = await captain.run(args);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('runs exactly 1 round when maxRounds=1', async () => {
    const promptMock = vi.fn()
      .mockResolvedValueOnce({ data: { info: {}, parts: [{ type: 'text', text: makeDecomposeResponse(['t1']) }] } })
      .mockResolvedValueOnce({ data: { info: {}, parts: [{ type: 'text', text: makeSubAgentResponse('ans1') }] } })
      .mockResolvedValueOnce({ data: { info: {}, parts: [{ type: 'text', text: makeSubAgentResponse('ans2') }] } })
      .mockResolvedValueOnce({ data: { info: {}, parts: [{ type: 'text', text: makeCritiqueResponse(0.6, ['still issues']) }] } })
      .mockResolvedValueOnce({ data: { info: {}, parts: [{ type: 'text', text: 'Final answer.' }] } });

    const client = {
      session: {
        create: vi.fn().mockResolvedValue({ data: { id: 'child-1' } }),
        prompt: promptMock,
        delete: vi.fn().mockResolvedValue({ data: true }),
      },
    } as unknown as OpencodeClient;

    const captain = new CaptainOrchestrator(client, context, resolvedConfig);
    const result = await captain.run({ ...args, maxRounds: 1 });

    // 1 decompose + 2 sub-agents + 1 critique + 1 synthesize = 5 calls
    expect(promptMock).toHaveBeenCalledTimes(5);
    expect(typeof result).toBe('string');
  });

  it('includes debate transcript in debug mode', async () => {
    const client = makeClient([
      makeDecomposeResponse(['task1']),
      makeSubAgentResponse('answer A'),
      makeSubAgentResponse('answer B'),
      makeCritiqueResponse(0.95, []),
      'Synthesized final.',
    ]);

    const captain = new CaptainOrchestrator(client, context, resolvedConfig);
    const result = await captain.run({ ...args, debug: true, maxRounds: 1 });
    expect(result).toContain('debate transcript');
  });

  it('respects abort signal', async () => {
    const controller = new AbortController();
    const abortedContext: ToolContext = { ...context, abort: controller.signal };

    const client = makeClient([
      makeDecomposeResponse(['t1']),
      makeSubAgentResponse('ans'),
      makeSubAgentResponse('ans'),
      makeCritiqueResponse(0.3, ['open']),
    ]);

    controller.abort();
    const captain = new CaptainOrchestrator(client, abortedContext, resolvedConfig);
    await expect(captain.run({ ...args, maxRounds: 5 })).rejects.toThrow(/abort/i);
  });
});
