import { describe, it, expect } from 'vitest';
import type {
  ModelRef,
  SubAgentDef,
  AgentResponse,
  CritiqueResult,
  DebateRound,
  StoppingInput,
  StopReason,
  OrchestrateArgs,
  ResolvedConfig,
} from './types.ts';

describe('types', () => {
  it('ModelRef has providerID and modelID', () => {
    const ref: ModelRef = { providerID: 'anthropic', modelID: 'claude-sonnet-4-6' };
    expect(ref.providerID).toBe('anthropic');
    expect(ref.modelID).toBe('claude-sonnet-4-6');
  });

  it('SubAgentDef has name and role', () => {
    const def: SubAgentDef = { name: 'conclave-harper', role: 'Research & Facts' };
    expect(def.name).toBe('conclave-harper');
  });

  it('AgentResponse has all required fields including claims with confidence', () => {
    const response: AgentResponse = {
      agentName: 'Harper',
      role: 'Research & Facts',
      claims: [{ text: 'The sky is blue.', confidence: 0.95 }],
      reasoning: 'Based on physics.',
      uncertainties: ['exact wavelength'],
      answer: 'The sky appears blue due to Rayleigh scattering.',
    };
    expect(response.claims[0].confidence).toBe(0.95);
    expect(response.uncertainties).toHaveLength(1);
  });

  it('CritiqueResult has consensusScore, uncertaintyDelta, openIssues, synthesis', () => {
    const critique: CritiqueResult = {
      consensusScore: 0.9,
      uncertaintyDelta: 0.05,
      openIssues: ['Needs source citation'],
      synthesis: 'Agents agree on core mechanism.',
    };
    expect(critique.consensusScore).toBe(0.9);
    expect(critique.openIssues).toHaveLength(1);
  });

  it('DebateRound has roundNumber, subAgentResponses, critique, timestamp', () => {
    const round: DebateRound = {
      roundNumber: 1,
      subAgentResponses: [],
      critique: {
        consensusScore: 0.5,
        uncertaintyDelta: 0.1,
        openIssues: [],
        synthesis: '',
      },
      timestamp: Date.now(),
    };
    expect(round.roundNumber).toBe(1);
  });

  it('StoppingInput covers all 5 signals', () => {
    const input: StoppingInput = {
      consensusScore: 0.9,
      uncertaintyDelta: 0.02,
      openIssuesCount: 0,
      noveltyScore: 0.02,
      currentRound: 3,
      maxRounds: 5,
    };
    expect(input.openIssuesCount).toBe(0);
  });

  it('StopReason union includes all 5 reasons', () => {
    const reasons: StopReason[] = [
      'consensus_reached',
      'uncertainty_stable',
      'no_open_issues',
      'low_novelty',
      'max_rounds',
    ];
    expect(reasons).toHaveLength(5);
  });

  it('OrchestrateArgs has required query and optional fields', () => {
    const args: OrchestrateArgs = { query: 'What is consciousness?' };
    expect(args.query).toBeTruthy();
    const argsWithOptions: OrchestrateArgs = {
      query: 'test',
      maxRounds: 3,
      debug: true,
      subAgents: [{ name: 'conclave-harper', role: 'Research' }],
    };
    expect(argsWithOptions.maxRounds).toBe(3);
  });

  it('ResolvedConfig has captain and subAgents with models', () => {
    const config: ResolvedConfig = {
      captain: { providerID: 'anthropic', modelID: 'claude-opus-4-6' },
      subAgents: [
        {
          name: 'conclave-harper',
          role: 'Research & Facts',
          model: { providerID: 'openai', modelID: 'gpt-4o' },
        },
      ],
    };
    expect(config.captain.providerID).toBe('anthropic');
    expect(config.subAgents[0].model.modelID).toBe('gpt-4o');
  });
});
