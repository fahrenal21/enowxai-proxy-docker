# enowxai Proxy Docker Stack

Docker Compose setup for running **enowxai proxy**, **shim proxy for OpenCode**, and **planning-safe wrapper** to maintain stable OpenCode workflows when using the enowxai/Kiro provider.

## Why this stack exists

When OpenCode uses enowxai/Kiro, large tool calls such as `write.content` can be truncated (`tool call arguments truncated`). Common impacts include:

- OpenCode hangs when creating long documents.
- The `write` tool fails with schema errors like `Missing key at ["content"]`.
- Long planning/PRD/spec documents are saved incomplete.

This stack separates responsibilities:

```text
OpenCode normal chat/tools
  -> enowxai-shim :1432
  -> enowxai-proxy :1430

Long documents / plans / PRDs / specs
  -> scripts/planning-safe.mjs
  -> enowxai-shim :1432
  -> write file locally from Node.js
```

## Components

| Component | Port | Function |
| --- | --- | --- |
| `enowxai-proxy` | `1430` | OpenAI-compatible proxy from enowxai. |
| `enowxai dashboard` | `1431` | enowxai dashboard. |
| `enowxai-shim` | `1432` | Safe gateway for OpenCode: forces upstream non-stream, validates tool arguments, and converts back to SSE. |
| `scripts/planning-safe.mjs` | - | Wrapper for creating plans/PRDs/specs without OpenCode's `write` tool. |

## Prerequisites

- Docker + Docker Compose plugin.
- Node.js 20+ on host to run `scripts/planning-safe.mjs`.
- OpenCode config with valid `enowxlabs` provider `apiKey`.

Example OpenCode config:

```json
{
  "provider": {
    "enowxlabs": {
      "options": {
        "baseURL": "http://127.0.0.1:1432/v1",
        "apiKey": "enx-..."
      }
    }
  }
}
```

> Point OpenCode to `1432`, not directly to `1430`, to route through the shim.

## Quick start

```bash
docker compose up -d --build
```

Check status:

```bash
docker compose ps
docker compose logs -f enowxai-shim
docker compose logs -f enowxai
```

Stop stack:

```bash
docker compose down
```

Clean rebuild:

```bash
docker compose down
docker compose build --no-cache
docker compose up -d
```

## Endpoints

- enowxai proxy direct: `http://127.0.0.1:1430/v1`
- enowxai dashboard: `http://127.0.0.1:1431`
- Shim for OpenCode: `http://127.0.0.1:1432/v1`

Test endpoint model list:

```bash
node -e '
const key = process.env.ENOWXAI_API_KEY;
fetch("http://127.0.0.1:1432/v1/models", { headers: { Authorization: `Bearer ${key}` } })
  .then(async (r) => console.log(r.status, (await r.text()).slice(0, 300)))
  .catch(console.error);
'
```

## Shim proxy

The shim is located in `shim/shim.mjs` and runs as the `enowxai-shim` service.

What the shim does:

1. Receives OpenAI-compatible requests from OpenCode.
2. Forces upstream requests to `stream: false` to reduce tool-call truncation risk.
3. Removes stale `content-length` after body modification.
4. Validates `tool_calls[].function.arguments` for valid JSON.
5. Retries if upstream returns invalid/truncated tool arguments.
6. Converts non-stream responses back to SSE `text/event-stream` when client requests streaming.

Important environment variables:

```yaml
SHIM_HOST: 0.0.0.0
SHIM_PORT: 1432
ENOWXAI_UPSTREAM: http://enowxai:1430/v1
SHIM_MAX_RETRIES: 2
```

## Planning-safe wrapper

Use the wrapper for long documents such as plans, PRDs, specs, or design documents. The wrapper asks the model to return plain markdown, then Node.js writes the file locally. This way, document content does not pass through the `write.content` tool call.

Example:

```bash
node scripts/planning-safe.mjs \
  --dir /path/to/project \
  --title "AI Insights Refactor" \
  --model enowxlabs/claude-sonnet-4.5-thinking \
  "Create a plan in docs/plans for refactoring the AI Insights page following best practices"
```

If a specific output path is required:

```bash
node scripts/planning-safe.mjs \
  --dir /path/to/project \
  --title "AI Insights Refactor" \
  --model enowxlabs/claude-sonnet-4.5-thinking \
  --out docs/plans/ai-insights-refactor-plan.md \
  "Create a plan for refactoring the AI Insights page following best practices"
```

Model is dynamic:

- `--model enowxlabs/<model>` is supported; the wrapper automatically extracts the model part after `/`.
- If `--model` is not provided, the wrapper reads `OPENCODE_MODEL`, `OPENCODE_CURRENT_MODEL`, `AI_MODEL`, or `MODEL`.
- If none exist, it falls back to `claude-sonnet-4.5-thinking`.

The wrapper also has a continuation guard:

- Checks `finish_reason === "length"`.
- Detects markdown that appears incomplete.
- Automatically continues output before saving the final file.

## Custom `/plan-safe` command in OpenCode

To avoid typing the long Node command every time you create a plan, create a custom OpenCode command named `/plan-safe`.

### 1. Create command folder

OpenCode may use one of the following directory patterns depending on installation version. It is safe to create both:

```bash
mkdir -p ~/.config/opencode/command ~/.config/opencode/commands
```

### 2. Create command file

Save the following content to both paths:

- `~/.config/opencode/command/plan-safe.md`
- `~/.config/opencode/commands/plan-safe.md`

````md
---
description: Create plan/PRD/spec documents safely without OpenCode write-tool payloads
---

Use the planning-safe wrapper. Do not use the `write` tool for the generated document body.

Goal: create the requested planning document while avoiding enowxai/Kiro `tool call arguments truncated` errors.

Input arguments from the user:

```text
$ARGUMENTS
```

Rules:
- Use the current project directory as `--dir`.
- Use the current OpenCode model if you can determine it. If it is in `provider/model` format, pass it as-is; the wrapper normalizes it.
- If the current model cannot be determined, omit `--model`; the wrapper will use environment/default fallback.
- Derive a short descriptive `--title` from the user request.
- If the user specifies an exact relative output path, include `--out "<relative/path.md>"`.
- If no exact output path is specified, let the wrapper default to `docs/plans`.
- After running, return only the created file path and one-line description.

Command pattern:

```bash
node /absolute/path/to/enowxai-proxy/scripts/planning-safe.mjs \
  --dir "$PWD" \
  --title "<short descriptive title>" \
  --model "<current OpenCode model if known>" \
  "<original user request>"
```

With explicit output path:

```bash
node /absolute/path/to/enowxai-proxy/scripts/planning-safe.mjs \
  --dir "$PWD" \
  --title "<short descriptive title>" \
  --model "<current OpenCode model if known>" \
  --out "<relative/output/path.md>" \
  "<original user request>"
```
````

> Replace `/absolute/path/to/enowxai-proxy` with the path to this repo, for example `/home/dani/enowxai-proxy`.

### 3. Usage examples

In an OpenCode session, run:

```text
/plan-safe Create a plan in docs/plans for refactoring the AI Insights page following best practices
```

With explicit output path:

```text
/plan-safe Create a PRD in docs/prd/ai-insights.md for refactoring AI Insights
```

### 4. Best practices

- Use `/plan-safe` for long documents: plans, PRDs, specs, design docs.
- Do not use `/plan-safe` for small code edits.
- Keep OpenCode provider pointed to the shim: `http://127.0.0.1:1432/v1`.
- If the model is not detected by the command, omit the `--model` flag; the wrapper will fall back to environment/default.

## Project structure

```text
.
├── Dockerfile
├── docker-compose.yml
├── README.md
├── scripts/
│   ├── planning-safe.mjs
│   └── planning-safe.test.mjs
└── shim/
    ├── Dockerfile
    ├── shim.mjs
    └── shim.test.mjs
```

## Testing

Run unit tests:

```bash
node --test scripts/planning-safe.test.mjs
node --test shim/shim.test.mjs
```

## Troubleshooting

### OpenCode not receiving responses

Ensure OpenCode points to the shim:

```text
http://127.0.0.1:1432/v1
```

Check logs:

```bash
docker compose logs -f enowxai-shim
docker compose logs -f enowxai
```

### Planning documents truncated

Use `scripts/planning-safe.mjs`, not the `write` tool directly from OpenCode.

### `invalid API key`

Ensure the OpenCode API key matches the enowxai container API key. Retrieve it from the dashboard/enowxai config and update the OpenCode provider.
