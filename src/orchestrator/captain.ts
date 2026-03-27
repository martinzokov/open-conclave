import type { OpencodeClient } from '@opencode-ai/sdk';
import type { ToolContext } from '@opencode-ai/plugin';
import type {
  OrchestrateArgs,
  ResolvedConfig,
  AgentResponse,
  CritiqueResult,
  DebateRound,
} from '../types.ts';
import { SubAgentRunner } from './subagent.ts';
import { DebateHistory } from './debate.ts';
import { evaluateStopping } from './stopping.ts';

function extractJsonBlock(text: string): string | null {
  const match = text.match(/```json\s*([\s\S]*?)```/);
  return match ? match[1].trim() : null;
}

async function promptCaptain(
  client: OpencodeClient,
  sessionID: string,
  captainModel: ResolvedConfig['captain'],
  promptText: string,
): Promise<string> {
  const sessionResult = await client.session.create({ body: { parentID: sessionID } });
  const childId = (sessionResult.data as { id: string }).id;

  try {
    const result = await client.session.prompt({
      path: { id: childId },
      body: {
        agent: 'conclave-captain',
        model: { providerID: captainModel.providerID, modelID: captainModel.modelID },
        parts: [{ type: 'text', text: promptText } as { type: 'text'; text: string }],
      },
    });
    const parts = (result.data as { parts: Array<{ type: string; text?: string }> }).parts;
    return parts.find((p) => p.type === 'text')?.text ?? '';
  } finally {
    await client.session.delete({ path: { id: childId } }).catch(() => {});
  }
}

function buildTranscript(history: DebateHistory): string {
  return history
    .getContext(100)
    .map(
      (r) =>
        `--- Round ${r.roundNumber} ---\n` +
        r.subAgentResponses.map((a) => `[${a.role}]: ${a.answer}`).join('\n') +
        `\n[Captain critique]: ${r.critique.synthesis}`,
    )
    .join('\n\n');
}

export class CaptainOrchestrator {
  constructor(
    private readonly client: OpencodeClient,
    private readonly context: ToolContext,
    private readonly config: ResolvedConfig,
  ) {}

  async run(args: OrchestrateArgs): Promise<string> {
    const maxRounds = args.maxRounds ?? 5;
    const { sessionID } = this.context;

    if (this.context.abort.aborted) throw new Error('Aborted before start');

    // Step 1: Decompose
    const decomposePrompt =
      `DECOMPOSE task:\nQuery: ${args.query}\n\n` +
      'Break this into 3–5 specific subtasks. Respond with JSON: {"subtasks": [...]}';

    const decomposeText = await promptCaptain(
      this.client,
      sessionID,
      this.config.captain,
      decomposePrompt,
    );

    const decomposeJson = extractJsonBlock(decomposeText);
    const subtasks: string[] = decomposeJson
      ? (JSON.parse(decomposeJson) as { subtasks: string[] }).subtasks
      : [args.query];

    const history = new DebateHistory();
    let roundNumber = 0;

    // Step 2: Debate loop
    for (roundNumber = 1; roundNumber <= maxRounds; roundNumber++) {
      if (this.context.abort.aborted) throw new Error('Aborted during debate');

      // Parallel sub-agent calls
      const subAgentResponses: AgentResponse[] = await Promise.all(
        this.config.subAgents.map((sa) => {
          const runner = new SubAgentRunner(this.client, sa.name, sa.model);
          return runner.run({
            sessionID,
            query: args.query,
            subtasks,
            recentHistory: history.getContext(3),
            roundNumber,
          });
        }),
      );

      // Captain critique
      const critiquePrompt =
        `CRITIQUE task (Round ${roundNumber}):\n` +
        `Query: ${args.query}\n\n` +
        `Sub-agent responses:\n${subAgentResponses.map((r) => `[${r.role}]: ${r.answer}`).join('\n\n')}\n\n` +
        'Evaluate consensus, remaining uncertainties, and open issues. Respond with JSON as instructed.';

      const critiqueText = await promptCaptain(
        this.client,
        sessionID,
        this.config.captain,
        critiquePrompt,
      );

      const critiqueJson = extractJsonBlock(critiqueText);
      const critique: CritiqueResult = critiqueJson
        ? (JSON.parse(critiqueJson) as CritiqueResult)
        : { consensusScore: 0.5, uncertaintyDelta: 0, openIssues: [], synthesis: critiqueText };

      const round: DebateRound = {
        roundNumber,
        subAgentResponses,
        critique,
        timestamp: Date.now(),
      };
      history.append(round);

      const stopping = evaluateStopping({
        consensusScore: critique.consensusScore,
        uncertaintyDelta: critique.uncertaintyDelta,
        openIssuesCount: critique.openIssues.length,
        noveltyScore: history.noveltyScore(),
        currentRound: roundNumber,
        maxRounds,
      });

      if (stopping.shouldStop) break;
    }

    // Step 3: Synthesize
    const synthesizePrompt =
      `SYNTHESIZE task:\nQuery: ${args.query}\n\n` +
      `Debate history (${roundNumber} round${roundNumber !== 1 ? 's' : ''}):\n` +
      history
        .getContext(100)
        .map((r) => r.subAgentResponses.map((a) => `[${a.role}]: ${a.answer}`).join('\n'))
        .join('\n\n') +
      '\n\nProduce the final, polished answer. Write clearly and directly.';

    const finalAnswer = await promptCaptain(
      this.client,
      sessionID,
      this.config.captain,
      synthesizePrompt,
    );

    if (args.debug) {
      const transcript = buildTranscript(history);
      return `[debate transcript]\n${transcript}\n\n[synthesized answer]\n${finalAnswer}`;
    }

    return finalAnswer;
  }
}
