import type { StoppingInput, StoppingResult } from '../types.ts';

const HIGH_CONSENSUS_THRESHOLD = 0.83;  // stop immediately — strong agreement
const CONSENSUS_THRESHOLD = 0.75;        // stop when consensus + 2 of 3 secondary signals met
const UNCERTAINTY_DECAY_THRESHOLD = 0.03;
const NOVELTY_THRESHOLD = 0.04;

/**
 * Evaluate stopping signals.
 * Hard cap (max_rounds) triggers immediately.
 * High consensus (≥0.92) stops immediately — no secondary conditions required.
 * Moderate consensus (≥0.88) stops when 2 of 3 secondary signals are also met.
 */
export function evaluateStopping(input: StoppingInput): StoppingResult {
  if (input.currentRound >= input.maxRounds) {
    return { shouldStop: true, reason: 'max_rounds' };
  }

  if (input.consensusScore >= HIGH_CONSENSUS_THRESHOLD) {
    return { shouldStop: true, reason: 'consensus_reached' };
  }

  if (input.consensusScore >= CONSENSUS_THRESHOLD) {
    const secondaryMet = [
      input.uncertaintyDelta < UNCERTAINTY_DECAY_THRESHOLD,
      input.openIssuesCount === 0,
      input.noveltyScore < NOVELTY_THRESHOLD,
    ].filter(Boolean).length;

    if (secondaryMet >= 2) {
      return { shouldStop: true, reason: 'consensus_reached' };
    }
  }

  return { shouldStop: false, reason: null };
}
