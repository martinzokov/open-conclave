Goal: Implement a native Grok-4.20-style multi-agent system as an OpenCode plugin.

Core Pattern: Captain + parallel sub-agents + dynamic debate rounds + early stopping.

Key Requirement: Fully model-agnostic — user can assign any provider/model (OpenAI, Anthropic, Grok, Gemini, local Ollama, Groq, etc.) to any role via tool arguments.1. High-Level ArchitecturePlugin Type: OpenCode Plugin using @opencode-ai/plugin SDK (official).

Main Output: One custom tool named multiagent_orchestrate.

Internal Agents (configurable):Captain — always uses the current OpenCode session’s default model (or user-specified). Responsible for decomposition and final synthesis.

Sub-agents (default 3, extensible):Harper → Research & Facts

Benjamin → Logic, Math & Code

Lucas → Creative, UX & Alternative Perspectives


Workflow Trigger: User calls the tool inside OpenCode chat with a complex query.


Parallel Sub-Agent Thinking (every round)  All sub-agents run simultaneously via Promise.all.  

Each sub-agent receives:  Its role-specific system prompt.  

Current query + subtasks.  

Last 3 rounds of debate history (for context).


Each returns validated AgentResponse JSON (see schema below).


Debate / Critique Round  Captain reviews all sub-agent responses.  

Produces a critique + list of remaining open_issues.


Dynamic Early Stopping Decision (Captain evaluates)

Captain runs an internal structured prompt that computes the 5 stopping signals (exact Grok 4.20 logic):Consensus score ≥ 88 % on key claims.

Uncertainty decay < 0.03 (average confidence improvement).

Zero remaining open issues.

Novelty of new round < 4 % (simple embedding similarity or token overlap check).

Hard cap reached (maxRounds).


Loop or Synthesize  If stopping condition met → proceed to step 7.  

Else → repeat steps 3–5 (up to maxRounds).


Final Synthesis  Captain receives full debate history.  

Produces one polished, final answer for the user.


Output  The tool returns only the final synthesized answer (no raw history unless user requests debug mode).



