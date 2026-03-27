# Conclave — Data Models

**Date**: 2026-03-27

---

## Core Types (`src/types.ts`)

### ModelRef

A resolved provider/model reference (parsed from the `"provider/model"` string format used in OpenCode config).

```typescript
type ModelRef = {
  providerID: string;   // e.g. "anthropic"
  modelID: string;      // e.g. "claude-sonnet-4-6"
};
```

---

### SubAgentDef

Static definition of a sub-agent role. The default roster is Harper, Benjamin, Lucas.

```typescript
type SubAgentDef = {
  name: string;        // OpenCode agent key, e.g. "conclave-harper"
  role: string;        // Human-readable label, e.g. "Research & Facts"
};
```

---

### AgentResponse

Structured JSON output expected from each sub-agent per debate round. The sub-agent system prompt instructs the model to respond in this format.

```typescript
type AgentResponse = {
  agentName: string;
  role: string;
  claims: Array<{
    text: string;
    confidence: number;    // 0.0 – 1.0
  }>;
  reasoning: string;       // Prose explanation
  uncertainties: string[]; // Explicit unknowns or caveats
  answer: string;          // The sub-agent's direct answer
};
```

---

### CritiqueResult

Output of the Captain's critique prompt after reviewing all sub-agent responses for a round.

```typescript
type CritiqueResult = {
  consensusScore: number;    // 0.0 – 1.0; fraction of key claims agreed upon
  uncertaintyDelta: number;  // Avg confidence improvement vs previous round (negative = regressed)
  openIssues: string[];      // Remaining unresolved questions
  synthesis: string;         // Captain's interim synthesis (used as context for next round)
};
```

---

### DebateRound

A complete record of one round: all sub-agent responses + the Captain's critique.

```typescript
type DebateRound = {
  roundNumber: number;
  subAgentResponses: AgentResponse[];
  critique: CritiqueResult;
  timestamp: number;
};
```

---

### StoppingInput

Inputs to the `StoppingEvaluator`, assembled after each critique.

```typescript
type StoppingInput = {
  consensusScore: number;
  uncertaintyDelta: number;
  openIssuesCount: number;
  noveltyScore: number;      // Jaccard bigram similarity vs previous round (1 = novel, 0 = identical)
  currentRound: number;
  maxRounds: number;
};
```

---

### StoppingResult

```typescript
type StopReason =
  | 'consensus_reached'
  | 'uncertainty_stable'
  | 'no_open_issues'
  | 'low_novelty'
  | 'max_rounds';

type StoppingResult = {
  shouldStop: boolean;
  reason: StopReason | null;
};
```

Stopping triggers on the **first** hard condition (`max_rounds`) OR when **all four** soft conditions are simultaneously met.

---

### SubAgentInput

Input passed to `SubAgentRunner.run()` per round.

```typescript
type SubAgentInput = {
  sessionID: string;       // Parent session ID (for child session parentID)
  query: string;           // Original user query
  subtasks: string[];      // Decomposed subtasks from Captain
  recentHistory: DebateRound[];  // Last 3 rounds (empty on round 1)
  roundNumber: number;
};
```

---

### OrchestrateArgs

Tool call arguments (Zod-validated).

```typescript
type OrchestrateArgs = {
  query: string;
  maxRounds?: number;          // Default: 5
  debug?: boolean;             // Default: false
  subAgents?: SubAgentDef[];   // Override default roster
};
```

---

### ResolvedConfig

Output of `ConfigLoader.resolveSubAgentModels()`.

```typescript
type ResolvedConfig = {
  captain: ModelRef;
  subAgents: Array<SubAgentDef & { model: ModelRef }>;
};
```

---

## JSON Contract: AgentResponse Prompt Format

Sub-agent system prompts instruct the model to output a JSON block wrapped in a code fence:

````
```json
{
  "agentName": "Harper",
  "role": "Research & Facts",
  "claims": [{ "text": "...", "confidence": 0.9 }],
  "reasoning": "...",
  "uncertainties": ["..."],
  "answer": "..."
}
```
````

The `SubAgentRunner` extracts the first ` ```json ` block from the response parts and parses it. If parsing fails, it falls back to wrapping the raw text in a minimal `AgentResponse` with `confidence: 0.5`.

---

## JSON Contract: CritiqueResult Prompt Format

The Captain critique prompt requests:

````
```json
{
  "consensusScore": 0.87,
  "uncertaintyDelta": 0.05,
  "openIssues": ["..."],
  "synthesis": "..."
}
```
````

Same extraction approach as above.
