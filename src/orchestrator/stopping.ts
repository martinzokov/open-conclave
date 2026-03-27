import type { StoppingInput, StoppingResult } from '../types.ts';

const CONSENSUS_THRESHOLD = 0.88;
const UNCERTAINTY_DECAY_THRESHOLD = 0.03;
const NOVELTY_THRESHOLD = 0.04;

/**
 * Evaluate all 5 stopping signals.
 * Hard cap (max_rounds) triggers immediately.
 * All 4 soft conditions must be met simultaneously.
 */
export function evaluateStopping(input: StoppingInput): StoppingResult {
  if (input.currentRound >= input.maxRounds) {
    return { shouldStop: true, reason: 'max_rounds' };
  }

  const allSoftMet =
    input.consensusScore >= CONSENSUS_THRESHOLD &&
    input.uncertaintyDelta < UNCERTAINTY_DECAY_THRESHOLD &&
    input.openIssuesCount === 0 &&
    input.noveltyScore < NOVELTY_THRESHOLD;

  if (allSoftMet) {
    return { shouldStop: true, reason: 'consensus_reached' };
  }

  return { shouldStop: false, reason: null };
}
