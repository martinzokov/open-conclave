/** Resolved provider/model reference, parsed from "provider/model" config strings. */
export type ModelRef = {
  providerID: string;
  modelID: string;
};

/** Static definition of a sub-agent role. */
export type SubAgentDef = {
  name: string;
  role: string;
};

/** Structured JSON output expected from each sub-agent per debate round. */
export type AgentResponse = {
  agentName: string;
  role: string;
  claims: Array<{
    text: string;
    confidence: number;
  }>;
  reasoning: string;
  uncertainties: string[];
  answer: string;
};

/** Captain's critique output after reviewing all sub-agent responses for a round. */
export type CritiqueResult = {
  consensusScore: number;
  uncertaintyDelta: number;
  openIssues: string[];
  synthesis: string;
};

/** A complete record of one debate round. */
export type DebateRound = {
  roundNumber: number;
  subAgentResponses: AgentResponse[];
  critique: CritiqueResult;
  timestamp: number;
};

/** Inputs to the StoppingEvaluator after each critique round. */
export type StoppingInput = {
  consensusScore: number;
  uncertaintyDelta: number;
  openIssuesCount: number;
  noveltyScore: number;
  currentRound: number;
  maxRounds: number;
};

export type StopReason =
  | 'consensus_reached'
  | 'uncertainty_stable'
  | 'no_open_issues'
  | 'low_novelty'
  | 'max_rounds';

export type StoppingResult = {
  shouldStop: boolean;
  reason: StopReason | null;
};

/** Input passed to SubAgentRunner.run() per round. */
export type SubAgentInput = {
  sessionID: string;
  query: string;
  recentHistory: DebateRound[];
  roundNumber: number;
};

/** Tool call arguments (Zod-validated). */
export type OrchestrateArgs = {
  query: string;
  maxRounds?: number;
  debug?: boolean;
  subAgents?: SubAgentDef[];
};

/** Output of ConfigLoader.resolveSubAgentModels(). */
export type ResolvedConfig = {
  captain: ModelRef;
  subAgents: Array<SubAgentDef & { model: ModelRef; persona?: string }>;
};
