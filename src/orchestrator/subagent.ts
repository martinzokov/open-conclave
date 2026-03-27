import type { OpencodeClient } from '@opencode-ai/sdk';
import type { AgentResponse, ModelRef, SubAgentInput } from '../types.ts';

/** Extract the first ```json ... ``` code fence from a string. */
function extractJsonBlock(text: string): string | null {
  const match = text.match(/```json\s*([\s\S]*?)```/);
  return match ? match[1].trim() : null;
}

function rawTextFallback(agentName: string, role: string, text: string): AgentResponse {
  return {
    agentName,
    role,
    claims: [{ text, confidence: 0.5 }],
    reasoning: '',
    uncertainties: [],
    answer: text,
  };
}

/**
 * Manages a single sub-agent's child session lifecycle: create → prompt → parse → delete.
 */
export class SubAgentRunner {
  constructor(
    private readonly client: OpencodeClient,
    private readonly agentName: string,
    private readonly model: ModelRef,
  ) {}

  async run(input: SubAgentInput): Promise<AgentResponse> {
    const sessionResult = await this.client.session.create({
      body: { parentID: input.sessionID },
    });
    const childSessionId = (sessionResult.data as { id: string }).id;

    try {
      const historyContext =
        input.recentHistory.length > 0
          ? `\n\nPrevious debate rounds for context:\n${input.recentHistory
              .map(
                (r) =>
                  `Round ${r.roundNumber} synthesis: ${r.critique.synthesis}`,
              )
              .join('\n')}`
          : '';

      const promptText =
        `Query: ${input.query}\n\n` +
        `Your subtasks:\n${input.subtasks.map((t, i) => `${i + 1}. ${t}`).join('\n')}` +
        historyContext +
        '\n\nRespond with a JSON object in a ```json code fence as instructed in your system prompt.';

      const promptResult = await this.client.session.prompt({
        path: { id: childSessionId },
        body: {
          agent: this.agentName,
          model: { providerID: this.model.providerID, modelID: this.model.modelID },
          parts: [{ type: 'text', text: promptText } as { type: 'text'; text: string }],
        },
      });

      const parts = (promptResult.data as { parts: Array<{ type: string; text?: string }> }).parts;
      const textPart = parts.find((p) => p.type === 'text');
      const rawText = textPart?.text ?? '';

      const jsonBlock = extractJsonBlock(rawText);
      if (!jsonBlock) {
        return rawTextFallback(this.agentName, 'unknown', rawText || 'no response');
      }

      try {
        const parsed = JSON.parse(jsonBlock) as AgentResponse;
        return parsed;
      } catch {
        return rawTextFallback(this.agentName, 'unknown', rawText);
      }
    } finally {
      await this.client.session.delete({ path: { id: childSessionId } }).catch(() => {
        // Best-effort cleanup
      });
    }
  }
}
