import { describe, it, expect, vi } from 'vitest';
import { createOrchestrateTool } from './orchestrate.ts';
import type { OpencodeClient } from '@opencode-ai/sdk';
import type { ToolContext } from '@opencode-ai/plugin';

const context: ToolContext = {
  sessionID: 'sess-tool',
  messageID: 'msg-tool',
  agent: 'conclave',
  abort: new AbortController().signal,
};

function makeClient(): OpencodeClient {
  return {
    config: {
      get: vi.fn().mockResolvedValue({ data: { agent: {} } }),
    },
    session: {
      create: vi.fn().mockResolvedValue({ data: { id: 'child-1' } }),
      prompt: vi.fn().mockResolvedValue({
        data: {
          info: { id: 'msg-x' },
          parts: [{ type: 'text', text: 'Final synthesized answer from captain.' }],
        },
      }),
      delete: vi.fn().mockResolvedValue({ data: true }),
    },
  } as unknown as OpencodeClient;
}

describe('createOrchestrateTool', () => {
  it('returns a tool definition with description, args, execute', () => {
    const client = makeClient();
    const t = createOrchestrateTool(client);
    expect(t.description).toBeTruthy();
    expect(t.args).toBeDefined();
    expect(typeof t.execute).toBe('function');
  });

  it('execute returns a string result', async () => {
    const client = makeClient();
    const t = createOrchestrateTool(client);
    const result = await t.execute({ query: 'What is the meaning of life?' }, context);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('debug mode returns transcript header in result', async () => {
    const client = makeClient();
    const t = createOrchestrateTool(client);
    const result = await t.execute({ query: 'Test query', maxRounds: 1, debug: true }, context);
    expect(result).toContain('debate transcript');
  });

  it('non-debug mode returns only the synthesized answer', async () => {
    const client = makeClient();
    const t = createOrchestrateTool(client);
    const result = await t.execute({ query: 'Test query', maxRounds: 1, debug: false }, context);
    expect(result).not.toContain('debate transcript');
  });
});
