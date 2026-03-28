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

### From npm (recommended)

```bash
npm install -g open-conclave
```

Then register the plugin in your OpenCode config (`~/.config/opencode/config.json`):

```json
{
  "plugins": ["open-conclave"]
}
```

### Local / development

```bash
git clone https://github.com/martinzokov/open-conclave.git
cd open-conclave
bun install
bun run build
```

Copy the bundle into your OpenCode plugins directory:

```bash
cp dist/index.js ~/.config/opencode/plugins/conclave.js
```

Then register it:

```json
{
  "plugins": ["~/.config/opencode/plugins/conclave.js"]
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

## Customising agent prompts

Each agent ships with a default system prompt. You can override or extend any of them in your `opencode.json` without touching the plugin source.

### Append extra instructions (`promptExtra`)

Adds your text after the default prompt. Use this when you want to tweak behaviour without replacing the full prompt.

```json
{
  "agent": {
    "conclave-harper": {
      "promptExtra": "Always cite sources with URLs when available."
    },
    "conclave-benjamin": {
      "promptExtra": "Prefer Rust and Go examples over Python."
    },
    "conclave-lucas": {
      "promptExtra": "Consider environmental impact in every answer."
    },
    "conclave-captain": {
      "promptExtra": "Be especially skeptical of confident-sounding claims with no evidence."
    }
  }
}
```

### Full replacement (`prompt`)

Replaces the default prompt entirely. Use this when you want a completely different agent persona.

```json
{
  "agent": {
    "conclave-harper": {
      "prompt": "You are Harper, a financial analyst specialising in markets and macroeconomics.\n\nAlways respond with a JSON object in a ```json code fence:\n```json\n{\"agentName\": \"Harper\", \"role\": \"Financial Analysis\", \"claims\": [{\"text\": \"...\", \"confidence\": 0.9}], \"reasoning\": \"...\", \"uncertainties\": [], \"answer\": \"...\"}\n```"
    }
  }
}
```

> When `prompt` and `promptExtra` are both set, `prompt` wins and `promptExtra` is ignored.

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

| Argument | Type | Default | Description |
|---|---|---|---|
| `query` | string | required | The question or task to deliberate on |
| `maxRounds` | number | `3` | Max debate rounds (1–10) |
| `debug` | boolean | `false` | Return full debate transcript alongside the answer |

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
