import { describe, it, expect, vi } from 'vitest';
import { ConclavePlugin } from './index.ts';
import type { PluginInput } from '@opencode-ai/plugin';

function makeContext(): PluginInput {
  return {
    client: {} as PluginInput['client'],
    project: {} as PluginInput['project'],
    directory: '/tmp',
    worktree: '/tmp',
    $: {} as PluginInput['$'],
  };
}

describe('ConclavePlugin', () => {
  it('is a function', () => {
    expect(typeof ConclavePlugin).toBe('function');
  });

  it('registers the conclave tool', async () => {
    const hooks = await ConclavePlugin(makeContext());
    expect(hooks.tool).toBeDefined();
    expect(hooks.tool!['conclave']).toBeDefined();
    expect(typeof hooks.tool!['conclave'].execute).toBe('function');
  });

  it('registers config hook that creates 5 agents', async () => {
    const hooks = await ConclavePlugin(makeContext());
    expect(typeof hooks.config).toBe('function');

    const cfg: Record<string, unknown> = {};
    await (hooks.config as (cfg: Record<string, unknown>) => Promise<void>)(cfg);

    const agents = (cfg as { agent: Record<string, unknown> }).agent;
    expect(agents['conclave']).toBeDefined();
    expect(agents['conclave-captain']).toBeDefined();
    expect(agents['conclave-harper']).toBeDefined();
    expect(agents['conclave-benjamin']).toBeDefined();
    expect(agents['conclave-lucas']).toBeDefined();
  });

  it('conclave agent has mode primary', async () => {
    const hooks = await ConclavePlugin(makeContext());
    const cfg: Record<string, unknown> = {};
    await (hooks.config as (cfg: Record<string, unknown>) => Promise<void>)(cfg);

    const agents = (cfg as { agent: Record<string, { mode: string }> }).agent;
    expect(agents['conclave'].mode).toBe('primary');
  });

  it('sub-agents have mode subagent', async () => {
    const hooks = await ConclavePlugin(makeContext());
    const cfg: Record<string, unknown> = {};
    await (hooks.config as (cfg: Record<string, unknown>) => Promise<void>)(cfg);

    const agents = (cfg as { agent: Record<string, { mode: string }> }).agent;
    expect(agents['conclave-captain'].mode).toBe('subagent');
    expect(agents['conclave-harper'].mode).toBe('subagent');
  });

  it('registers /conclave slash command', async () => {
    const hooks = await ConclavePlugin(makeContext());
    const cfg: Record<string, unknown> = {};
    await (hooks.config as (cfg: Record<string, unknown>) => Promise<void>)(cfg);

    const commands = (cfg as { command: Record<string, { description: string }> }).command;
    expect(commands['conclave']).toBeDefined();
    expect(commands['conclave'].description).toContain('debate');
  });
});
