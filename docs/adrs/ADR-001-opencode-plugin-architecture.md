# ADR-001: OpenCode Plugin Architecture for Conclave

**Date**: 2026-03-27
**Status**: Accepted

---

## Context

We are building a multi-agent debate orchestrator as an OpenCode plugin. The plugin must:
1. Appear as a selectable agent tab in the OpenCode TUI
2. Spawn multiple AI sub-agents, each potentially using a different provider/model
3. Orchestrate parallel LLM calls, debate rounds, and early stopping
4. Remain fully model-agnostic — users configure any provider/model per role

---

## Decision 1: Use OpenCode child sessions for all LLM calls

**Options considered**:
- A) Call AI provider APIs directly (Bun `fetch`, or `@ai-sdk/*`)
- B) Create child OpenCode sessions (`client.session.create({ body: { parentID } })`) and prompt them

**Decision**: **Option B — child sessions**

**Rationale**:
- The `PluginInput.client` is an `OpencodeClient` with `session.create` and `session.prompt`, each accepting `model: { providerID, modelID }` and `agent` overrides per call
- Provider authentication, rate limiting, cost tracking, and retries are handled by OpenCode — the plugin inherits all of this for free
- Adding `@ai-sdk/*` or direct HTTP clients would require the user to configure duplicate API keys and would bypass OpenCode's provider model
- `session.prompt()` returns `{ info: AssistantMessage, parts: Array<Part> }` — the full LLM response synchronously, suitable for sequential/parallel orchestration

**Trade-off accepted**: Child sessions may briefly appear in the OpenCode session list. This is managed by using `parentID` to nest them, and disposing sessions after each round.

---

## Decision 2: Register Conclave as a primary agent, sub-agents as subagent mode

**Options considered**:
- A) Single primary agent "conclave" that always calls the `conclave` tool
- B) Multiple primary agents (one per sub-agent persona) visible in the tab bar

**Decision**: **Option A**

**Rationale**:
- The `AgentConfig.mode: "subagent"` registers an agent that is not shown in the TUI tab bar but is addressable via `session.prompt({ body: { agent: 'conclave-harper' } })`
- Users only need to see one "Conclave" tab; the sub-agents are implementation details
- The Conclave primary agent's system prompt instructs it to **always** call the `conclave` tool for every user message — making the tool call transparent behind the agent tab. The user selects the tab and just types; they never see the tool invocation.
- A `/conclave` slash command is also registered (via `config.command`) as a secondary entry point, allowing invocation from any other agent context without switching tabs

---

## Decision 3: Sub-agent model configuration in `config.agent.<name>.model`

**Options considered**:
- A) Tool call arguments (`subAgents: [{ name, model }]`)
- B) OpenCode config (`config.agent['conclave-harper'].model`)
- C) Separate plugin config file

**Decision**: **Option B**, with Option A as an optional override

**Rationale**:
- `AgentConfig` already has a `model?: string` field (format: `"provider/model"`) that OpenCode uses to assign a model to an agent
- Users already manage all their model preferences in `~/.config/opencode/config.json` — adding sub-agent model config to the same file is the natural extension
- The plugin reads this at tool-call time via `client.config.get()`, requiring no new config format or file
- Tool args can optionally override per-call for ad-hoc experiments

---

## Decision 4: Debate state is in-memory (no persistence)

**Options considered**:
- A) Store debate history in a file or OpenCode session metadata
- B) Keep all state in-memory within the tool `execute()` call

**Decision**: **Option B**

**Rationale**:
- OpenCode tool calls are expected to complete and return a string; the full debate loop runs within one `execute()` invocation
- Typical debate runs are 2–5 rounds × 3 sub-agents = 6–15 LLM calls, completing in seconds to minutes — well within any reasonable timeout
- Persisting state would add complexity with no benefit for the expected use case
- If a call is aborted (via `context.abort`), the in-memory state is cleanly discarded

---

## Decision 5: Tool returns a single string (no streaming)

**Options considered**:
- A) Return the final synthesised answer as a string
- B) Stream intermediate progress

**Decision**: **Option A**

**Rationale**:
- The `ToolDefinition.execute()` signature is `Promise<string>` — the SDK does not support streaming from tools
- OpenCode renders tool output as a tool-result part in the message; progress can be communicated via `debug: true` returning the full debate transcript

**Consequence**: Users see no output until all debate rounds complete. For long runs (5 rounds × slow models), this can feel unresponsive. Mitigation: default `maxRounds = 5` but encourage users to start with `maxRounds = 3`.

---

## Consequences

- The plugin has **zero AI SDK dependencies** beyond `@opencode-ai/plugin`
- All AI calls are subject to the user's existing OpenCode provider configuration
- Sub-agent models are independently configurable per user preference
- The orchestration loop is transparent: `debug: true` returns the full transcript
- Future extension (more sub-agents, different debate strategies) requires no SDK changes — only new `AgentConfig` entries and prompt strings
