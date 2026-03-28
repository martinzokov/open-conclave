import { describe, it, expect } from 'vitest';
import { DebateHistory } from './debate.ts';
import { evaluateStopping } from './stopping.ts';
import type { DebateRound, StoppingInput } from '../types.ts';

function makeRound(n: number, text: string): DebateRound {
  return {
    roundNumber: n,
    subAgentResponses: [
      {
        agentName: 'Harper',
        role: 'Research',
        claims: [{ text, confidence: 0.8 }],
        reasoning: text,
        uncertainties: [],
        answer: text,
      },
    ],
    critique: {
      consensusScore: 0.8,
      uncertaintyDelta: 0.05,
      openIssues: [],
      synthesis: text,
    },
    timestamp: Date.now(),
  };
}

describe('DebateHistory', () => {
  it('starts empty', () => {
    const h = new DebateHistory();
    expect(h.getContext()).toHaveLength(0);
  });

  it('appends rounds and returns them', () => {
    const h = new DebateHistory();
    h.append(makeRound(1, 'alpha'));
    h.append(makeRound(2, 'beta'));
    expect(h.getContext()).toHaveLength(2);
  });

  it('getContext(n) returns last n rounds', () => {
    const h = new DebateHistory();
    for (let i = 1; i <= 5; i++) h.append(makeRound(i, `round${i}`));
    const ctx = h.getContext(3);
    expect(ctx).toHaveLength(3);
    expect(ctx[0].roundNumber).toBe(3);
    expect(ctx[2].roundNumber).toBe(5);
  });

  it('noveltyScore is 1 when no previous round exists', () => {
    const h = new DebateHistory();
    h.append(makeRound(1, 'first round content'));
    expect(h.noveltyScore()).toBe(1);
  });

  it('noveltyScore approaches 0 for identical consecutive rounds', () => {
    const h = new DebateHistory();
    const sameText = 'exact same content repeated many times';
    h.append(makeRound(1, sameText));
    h.append(makeRound(2, sameText));
    expect(h.noveltyScore()).toBeLessThan(0.05);
  });

  it('noveltyScore is high for completely different rounds', () => {
    const h = new DebateHistory();
    h.append(makeRound(1, 'apple banana cherry date elderberry fig grape'));
    h.append(makeRound(2, 'quantum physics relativity spacetime cosmology'));
    expect(h.noveltyScore()).toBeGreaterThan(0.8);
  });
});

describe('evaluateStopping', () => {
  const base: StoppingInput = {
    consensusScore: 0.9,
    uncertaintyDelta: 0.02,
    openIssuesCount: 0,
    noveltyScore: 0.02,
    currentRound: 3,
    maxRounds: 5,
  };

  it('returns shouldStop=false when no conditions met', () => {
    const result = evaluateStopping({
      consensusScore: 0.5,
      uncertaintyDelta: 0.1,
      openIssuesCount: 2,
      noveltyScore: 0.5,
      currentRound: 2,
      maxRounds: 5,
    });
    expect(result.shouldStop).toBe(false);
    expect(result.reason).toBeNull();
  });

  it('stops on max_rounds (hard cap)', () => {
    const result = evaluateStopping({ ...base, currentRound: 5, maxRounds: 5 });
    expect(result.shouldStop).toBe(true);
    expect(result.reason).toBe('max_rounds');
  });

  it('stops when all soft conditions met', () => {
    const result = evaluateStopping(base);
    expect(result.shouldStop).toBe(true);
  });

  it('does not stop when consensus below lower threshold (0.70)', () => {
    const result = evaluateStopping({ ...base, consensusScore: 0.70 });
    expect(result.shouldStop).toBe(false);
  });

  it('does not stop at moderate consensus when only 1 of 3 secondary signals met', () => {
    // consensusScore=0.78 is between thresholds; openIssues+novelty both bad → only uncertaintyDelta passes
    const result = evaluateStopping({ ...base, consensusScore: 0.78, openIssuesCount: 2, noveltyScore: 0.1 });
    expect(result.shouldStop).toBe(false);
  });

  it('does not stop below lower threshold regardless of secondary signals', () => {
    const result = evaluateStopping({ ...base, consensusScore: 0.60, openIssuesCount: 0, noveltyScore: 0.02 });
    expect(result.shouldStop).toBe(false);
  });

  it('hard cap takes precedence even if soft conditions not met', () => {
    const result = evaluateStopping({
      consensusScore: 0.3,
      uncertaintyDelta: 0.2,
      openIssuesCount: 5,
      noveltyScore: 0.9,
      currentRound: 5,
      maxRounds: 5,
    });
    expect(result.shouldStop).toBe(true);
    expect(result.reason).toBe('max_rounds');
  });
});
