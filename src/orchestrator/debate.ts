import type { DebateRound } from '../types.ts';

/** Compute Jaccard similarity on character bigrams between two strings. */
function jaccardBigrams(a: string, b: string): number {
  const bigrams = (s: string): Set<string> => {
    const set = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) {
      set.add(s.slice(i, i + 2));
    }
    return set;
  };

  const setA = bigrams(a.toLowerCase());
  const setB = bigrams(b.toLowerCase());

  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const bg of setA) {
    if (setB.has(bg)) intersection++;
  }

  const union = setA.size + setB.size - intersection;
  return intersection / union;
}

/** Extract all text content from a debate round for similarity comparison. */
function roundText(round: DebateRound): string {
  return round.subAgentResponses
    .map((r) => [r.answer, r.reasoning, ...r.claims.map((c) => c.text)].join(' '))
    .join(' ');
}

/**
 * Accumulates and windows debate rounds.
 * Computes novelty as 1 - Jaccard bigram similarity between last two rounds.
 */
export class DebateHistory {
  private rounds: DebateRound[] = [];

  append(round: DebateRound): void {
    this.rounds.push(round);
  }

  /** Return the last n rounds in chronological order (oldest first). */
  getContext(n: number = 3): DebateRound[] {
    return this.rounds.slice(-n);
  }

  /**
   * Novelty score of the most recent round vs the previous one.
   * Returns 1 if there is only one round (no comparison possible).
   * Returns 0 if consecutive rounds are textually identical.
   */
  noveltyScore(): number {
    if (this.rounds.length < 2) return 1;

    const prev = this.rounds[this.rounds.length - 2];
    const curr = this.rounds[this.rounds.length - 1];
    const similarity = jaccardBigrams(roundText(prev), roundText(curr));
    return 1 - similarity;
  }
}
