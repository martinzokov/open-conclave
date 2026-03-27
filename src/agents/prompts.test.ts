import { describe, it, expect } from 'vitest';
import {
  CONCLAVE_ROUTER_PROMPT,
  CAPTAIN_PROMPT,
  HARPER_PROMPT,
  BENJAMIN_PROMPT,
  LUCAS_PROMPT,
  DEFAULT_SUB_AGENTS,
} from './prompts.ts';

describe('agent prompts', () => {
  it('CONCLAVE_ROUTER_PROMPT instructs always calling the conclave tool', () => {
    expect(CONCLAVE_ROUTER_PROMPT).toContain('ALWAYS call');
    expect(CONCLAVE_ROUTER_PROMPT).toContain('conclave');
  });

  it('CAPTAIN_PROMPT covers DECOMPOSE, CRITIQUE, and SYNTHESIZE tasks', () => {
    expect(CAPTAIN_PROMPT).toContain('DECOMPOSE');
    expect(CAPTAIN_PROMPT).toContain('CRITIQUE');
    expect(CAPTAIN_PROMPT).toContain('SYNTHESIZE');
  });

  it('sub-agent prompts include JSON code fence instructions', () => {
    for (const prompt of [HARPER_PROMPT, BENJAMIN_PROMPT, LUCAS_PROMPT]) {
      expect(prompt).toContain('```json');
      expect(prompt).toContain('agentName');
      expect(prompt).toContain('claims');
      expect(prompt).toContain('confidence');
    }
  });

  it('DEFAULT_SUB_AGENTS has 3 entries with name and role', () => {
    expect(DEFAULT_SUB_AGENTS).toHaveLength(3);
    for (const sa of DEFAULT_SUB_AGENTS) {
      expect(sa.name).toMatch(/^conclave-/);
      expect(sa.role).toBeTruthy();
    }
  });
});
