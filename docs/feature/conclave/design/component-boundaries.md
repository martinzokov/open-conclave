# Conclave — Component Boundaries

**Date**: 2026-03-27

---

## Component Map

```
src/
├── index.ts                        # Plugin entry point
├── agents/
│   ├── prompts.ts                  # System prompt strings for all agents
│   └── defaults.ts                 # Default sub-agent roster
├── config/
│   └── loader.ts                   # Read & resolve sub-agent model assignments
├── orchestrator/
│   ├── captain.ts                  # Captain: decompose, critique, synthesise
│   ├── subagent.ts                 # Sub-agent: create session, prompt, parse response
│   ├── stopping.ts                 # StoppingEvaluator: 5 signals → shouldStop
│   └── debate.ts                   # DebateHistory: accumulate, trim, novelty score
├── tools/
│   └── orchestrate.ts              # Tool definition wired to the orchestration loop
└── types.ts                        # Shared types: AgentResponse, DebateRound, etc.
```

---

## Component Responsibilities

### `src/index.ts` — ConclavePlugin

**Owns**: Plugin lifecycle, agent/config registration.

**Responsibilities**:
- Implement `Plugin = async (input: PluginInput) => Hooks`
- Register `conclave` in `hooks.tool`
- In `hooks.config`: inject `conclave`, `conclave-captain`, `conclave-harper`, `conclave-benjamin`, `conclave-lucas` into `Config.agent`
- Forward `input.client` to the tool factory

**Does not own**: Orchestration logic, model resolution, AI calls.

---

### `src/tools/orchestrate.ts` — Tool definition

**Owns**: Tool argument schema, top-level orchestration call.

**Responsibilities**:
- Define `conclave` via `tool({ description, args, execute })`
- Parse and validate args (query, maxRounds, debug, subAgents)
- Instantiate `CaptainOrchestrator` with `client` + `context`
- Call `captain.run(args)` and return the string result

**Does not own**: Debate loop logic, session management.

**Interface**:
```typescript
execute(args: OrchestrateArgs, context: ToolContext): Promise<string>
```

---

### `src/orchestrator/captain.ts` — CaptainOrchestrator

**Owns**: The full debate loop, coordination of sub-agents, synthesis.

**Responsibilities**:
- Decompose the query into subtasks via child session prompt
- Per round: run sub-agents in `Promise.all`, collect responses
- Critique the round via child session prompt → `CritiqueResult`
- Pass signals to `StoppingEvaluator`; break or continue
- On stop: synthesise final answer via child session prompt
- Dispose child sessions when done

**Does not own**: Individual sub-agent session management (delegated to `SubAgentRunner`), novelty scoring (delegated to `DebateHistory`), stopping signal computation (delegated to `StoppingEvaluator`).

**Interface**:
```typescript
class CaptainOrchestrator {
  constructor(client: OpencodeClient, context: ToolContext, config: ResolvedConfig)
  run(args: OrchestrateArgs): Promise<string>
}
```

---

### `src/orchestrator/subagent.ts` — SubAgentRunner

**Owns**: A single sub-agent's session lifecycle and prompt/response cycle.

**Responsibilities**:
- Create a child session (`client.session.create({ body: { parentID } })`)
- Send prompt with: role system prompt + current subtasks + last 3 debate rounds
- Extract text parts from `session.prompt()` response
- Parse and validate `AgentResponse` JSON from response text
- Dispose session after use

**Does not own**: Debate history, stopping logic, what to do with the response.

**Interface**:
```typescript
class SubAgentRunner {
  constructor(client: OpencodeClient, agentName: string, model: ModelRef)
  run(input: SubAgentInput): Promise<AgentResponse>
}
```

---

### `src/orchestrator/stopping.ts` — StoppingEvaluator

**Owns**: Evaluation of all 5 stopping signals.

**Responsibilities**:
- Accept `StoppingInput` (consensus score, uncertainty delta, open issues count, novelty score, current round, max rounds)
- Return `{ shouldStop: boolean; reason: StopReason }`

**Does not own**: Computing consensus/uncertainty (Captain does that via LLM prompt), novelty (DebateHistory does that).

**Interface**:
```typescript
function evaluateStopping(input: StoppingInput): StoppingResult
```

---

### `src/orchestrator/debate.ts` — DebateHistory

**Owns**: Accumulation and windowing of debate rounds; novelty computation.

**Responsibilities**:
- Append `DebateRound` after each round
- Return last N rounds for context injection (default: 3)
- Compute Jaccard bigram similarity between current and previous round to produce novelty score

**Does not own**: What to do with novelty score (passed to StoppingEvaluator).

**Interface**:
```typescript
class DebateHistory {
  append(round: DebateRound): void
  getContext(n?: number): DebateRound[]
  noveltyScore(): number   // 0 = identical to last round, 1 = completely novel
}
```

---

### `src/config/loader.ts` — ConfigLoader

**Owns**: Reading and resolving sub-agent model assignments from OpenCode config.

**Responsibilities**:
- Call `client.config.get()` once at tool-call start
- For each sub-agent, resolve `config.agent['conclave-X'].model` → `{ providerID, modelID }`
- Apply fallback to session's current model if not configured

**Interface**:
```typescript
async function resolveSubAgentModels(
  client: OpencodeClient,
  context: ToolContext,
  subAgents: SubAgentDef[]
): Promise<ResolvedConfig>
```

---

### `src/agents/prompts.ts` — Agent Prompts

**Owns**: Static system prompt strings.

**No logic** — pure string constants exported for use in `index.ts` (config hook) and `SubAgentRunner` (injected into each prompt).

---

## Dependency Rules

- `index.ts` → `tools/`, `agents/`, `config/`
- `tools/orchestrate.ts` → `orchestrator/captain.ts`
- `orchestrator/captain.ts` → `orchestrator/subagent.ts`, `orchestrator/stopping.ts`, `orchestrator/debate.ts`
- `orchestrator/subagent.ts` → `agents/prompts.ts`, `types.ts`
- `config/loader.ts` → `types.ts`
- **No circular dependencies**. All orchestrator modules are independent of each other except through `captain.ts`.
