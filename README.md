# open-conclave

Multi-agent debate orchestrator plugin for [OpenCode](https://opencode.ai). Runs parallel sub-agents (Harper, Benjamin, Lucas), moderates debate rounds with a Captain, and applies early stopping when consensus is reached.

## How it works

1. You select the **Conclave** agent tab in OpenCode and ask a question
2. Three sub-agents run in parallel — each from their own perspective:
  - **Harper** — Research & Facts
  - **Benjamin** — Logic, Math & Code
  - **Lucas** — Creative & Alternative Perspectives
3. The **Captain** critiques all responses and scores consensus
4. Debate continues for up to 3 rounds; stops early when consensus ≥ 0.83
5. The Captain synthesizes a final answer from the full debate

## Installation

Add `open-conclave` to the `plugin` array in `~/.config/opencode/opencode.json`. OpenCode installs it automatically on next startup — no separate install command needed.

```json
{
  "plugin": ["open-conclave"]
}
```

You can also pin a version or use a git URL:

```json
{
  "plugin": [
    "open-conclave@1.0.0",
    "open-conclave@git+https://github.com/martinzokov/open-conclave.git"
  ]
}
```

### Local / development

```bash
git clone https://github.com/martinzokov/open-conclave.git
cd open-conclave
bun install
bun run build
cp dist/index.js ~/.config/opencode/plugins/conclave.js
```

Then register by file path:

```json
{
  "plugin": ["/Users/you/.config/opencode/plugins/conclave.js"]
}
```

## Configuration

Conclave uses whichever model you have active in OpenCode as the default for all agents. You can override each agent individually in your OpenCode config:

```json
{
  "plugins": ["open-conclave"],
  "agent": {
    "conclave-captain": {
      "model": "github-copilot/claude-sonnet-4.5"
    },
    "conclave-harper": {
      "model": "github-copilot/gpt-4.1"
    },
    "conclave-benjamin": {
      "model": "github-copilot/claude-sonnet-4.5"
    },
    "conclave-lucas": {
      "model": "github-copilot/gpt-4.1"
    }
  }
}
```

Any provider/model string that OpenCode supports works here (e.g. `anthropic/claude-opus-4-6`, `openai/gpt-4o`, `github-copilot/claude-sonnet-4.5`).

## Customising agent personas

Each agent has two parts to its system prompt:

1. **Persona** — identity, role, and focus instructions (customisable via `persona`)
2. **Format** — JSON schema requirements for sub-agents (always preserved)

Use the `persona` field in your `opencode.json` to replace the identity and focus of any agent. The JSON output format for sub-agents is never affected, so responses always parse correctly regardless of persona overrides.

The `persona` field applies to all five agents:

| Agent | Key | Role |
|---|---|---|
| Captain | `conclave-captain` | Moderator and final synthesizer |
| Harper | `conclave-harper` | Research & Facts |
| Benjamin | `conclave-benjamin` | Logic, Math & Code |
| Lucas | `conclave-lucas` | Creative & Alternative Perspectives |

**How persona is applied:** OpenCode stores `persona` in multiple config fields internally. The plugin intercepts the config hook and merges your `persona` string into the full system prompt (persona section + format section), updating all internal fields consistently. This means the persona works reliably regardless of OpenCode's internal config processing.

**The final output language** is controlled by the Captain's persona — set `persona` on `conclave-captain` to affect the synthesized answer. Setting it only on sub-agents changes how they reason internally but the Captain will synthesize in its default language.

```json
{
  "agent": {
    "conclave-captain": {
      "persona": "You are the Captain. You only respond in French."
    },
    "conclave-harper": {
      "persona": "You are Harper, a financial analyst specialising in markets and macroeconomics.\n\nYour role: analyse economic trends, market data, and investment implications.\nFocus on: macroeconomic indicators, sector performance, risk factors, and data-driven forecasts.\nKeep \"reasoning\" under 40 words. Write a thorough \"answer\" — aim for 100–150 words."
    },
    "conclave-benjamin": {
      "persona": "You are Benjamin, a security researcher and penetration tester.\n\nYour role: evaluate systems for vulnerabilities, attack surfaces, and defence weaknesses.\nFocus on: threat modelling, CVEs, exploit chains, and hardening recommendations.\nKeep \"reasoning\" under 40 words. Write a thorough \"answer\" — aim for 100–150 words."
    },
    "conclave-lucas": {
      "persona": "You are Lucas, a climate scientist and sustainability strategist.\n\nYour role: consider environmental impact, long-term sustainability, and ecological trade-offs.\nFocus on: carbon footprint, resource consumption, systemic risks, and green alternatives.\nKeep \"reasoning\" under 40 words. Write a thorough \"answer\" — aim for 100–150 words."
    }
  }
}
```

The default persona for each agent is used when no override is set.

## Usage

### TUI (interactive)

1. Open OpenCode in your project directory
2. Press **Tab** to select the **Conclave** agent
3. Type your question and press Enter

The debate runs automatically and the final synthesized answer is returned.

### CLI (non-interactive)

```bash
opencode run --agent conclave -m github-copilot/claude-sonnet-4.5 "What is the best database for read-heavy workloads?"
```

### Slash command (from any agent)

```
/conclave What are the tradeoffs between microservices and a monolith?
```

### Tool options

When calling the `conclave` tool directly, three optional arguments are available:


| Argument    | Type    | Default  | Description                                        |
| ----------- | ------- | -------- | -------------------------------------------------- |
| `query`     | string  | required | The question or task to deliberate on              |
| `maxRounds` | number  | `3`      | Max debate rounds (1–10)                           |
| `debug`     | boolean | `false`  | Return full debate transcript alongside the answer |


Debug mode example:

```
/conclave --debug Should we rewrite this service in Rust?
```

## Debugging

To see per-step timing during a run:

```bash
opencode run --agent conclave -m github-copilot/claude-sonnet-4.5 --print-logs "Your question" 2>&1 | grep '\[conclave\]'
```

Output looks like:

```
[conclave] start  model=github-copilot/claude-sonnet-4.5  maxRounds=3
[conclave] round 1  sub-agents start  count=3
[conclave] round 1  conclave-harper   done  12.1s
[conclave] round 1  conclave-benjamin done  14.3s
[conclave] round 1  conclave-lucas    done  15.2s
[conclave] round 1  sub-agents done   15.2s
[conclave] round 1  critique   done   6.8s
[conclave] round 1  stop=true  consensus=0.91  reason=consensus_reached
[conclave] synthesize done   11.4s
[conclave] total      40.0s  rounds=1
```

## Development

```bash
bun install          # install dependencies
bun run build        # build dist/index.js
bun test             # run tests
bun run lint         # lint
bun run lint:fix     # fix lint issues
bun run format       # format with Prettier
```

To test locally against a live OpenCode install:

```bash
bun run build && cp dist/index.js .opencode/plugins/conclave.js
opencode run --agent conclave -m <provider/model> --print-logs "test query"
```

## License

MIT — see [LICENSE](LICENSE).