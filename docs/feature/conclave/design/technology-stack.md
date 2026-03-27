# Conclave — Technology Stack

**Date**: 2026-03-27

---

## Runtime

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Runtime | **Bun** | Required by the plugin template; native TypeScript, fast startup, built-in glob/file APIs used in the template |
| Language | **TypeScript (strict)** | Project convention; enforces type safety across complex orchestration state |
| Module format | **ES Modules** | `"type": "module"` in package.json; aligns with `@opencode-ai/plugin` SDK |

## Core Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@opencode-ai/plugin` | `1.0.85` | Plugin SDK — `Plugin`, `tool`, `ToolContext`, `Hooks` types; Zod-based argument schema |
| `@opencode-ai/sdk` | `1.0.85` (transitive) | OpenCode API client — `session.create`, `session.prompt`, `config.get`, `Provider`, `Model`, `Config` types |
| `zod` | `4.1.8` (transitive) | Tool argument validation via `tool.schema` |

## No Additional AI SDK Dependencies

The plugin makes **no direct calls to AI provider APIs**. All LLM calls flow through OpenCode's session/prompt mechanism (`client.session.prompt()`), which handles:
- Provider authentication
- Model routing
- Rate limiting and retries
- Token counting

This eliminates the need for `@ai-sdk/*`, `openai`, `@anthropic-ai/sdk`, etc.

## Dev Dependencies

| Package | Purpose |
|---------|---------|
| `vitest` | Unit tests for orchestration logic (stopping evaluator, novelty scorer, debate history) |
| `typescript-eslint` + `eslint` | Linting; `no-console` enforced — use structured return values, not console output |
| `prettier` | Formatting (single quotes, 100 char line width, 2-space indent) |
| `bun-types` | Bun global type definitions (`Bun.Glob`, `import.meta.dir`) |

## Build

```
bun build ./src/index.ts --outdir dist --target bun
```

Output is an ES module bundle (`dist/index.js` + `dist/index.d.ts`). The plugin is published to npm and referenced in OpenCode config by package name.

## TypeScript Configuration

Strict mode, `ESNext` target, `bundler` module resolution (Bun-compatible). No path aliases beyond what the template provides.
