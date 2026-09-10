# ClassHero CLI Plugins

This directory contains plugins developed inside the ClassHero CLI monorepo.

Plugins are regular ESM packages that implement the contracts exported by
`@classhero-cli/plugin-api`. They are loaded at runtime by `apps/cli` and can
extend menus, prompts, hooks, services, storage and ClassHero API behavior
without modifying the CLI core.

## Workspaces

| Workspace | Purpose |
| --- | --- |
| `classhero-example-plugin` | Diagnostic plugin used to validate the plugin runtime end to end. |
| `classhero-ai-automator` | Automation engine. Uses deterministic solvers whenever possible and AI providers only for interpretation-heavy activities. |
| `classhero-ai-provider-openai` | Planned OpenAI provider plugin for the automator. |

## Build

From the repository root:

```bash
yarn build
```

## Loading local plugins

During development, the most deterministic approach is to load each compiled
entrypoint through **Plugins > Adicionar plugin**.

Example:

```text
./apps/plugins/classhero-ai-automator/dist/index.js
```

Plugin configuration is persisted by the CLI under:

```text
.classhero-cli/plugins.json
```
