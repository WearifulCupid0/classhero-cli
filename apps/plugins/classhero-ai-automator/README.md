# @classhero-cli/classhero-ai-automator

Automation engine for the ClassHero CLI.

The plugin follows two central rules:

> If an activity can be solved reliably with deterministic code, no AI model
> is called.

> Configured timing is implemented as a real minimum elapsed duration before
> submission; timestamps are not fabricated.

## Current implementation

### Fully executable without AI

- **Caça-palavras**
  - generates a ClassHero word-search round;
  - marks the backend round as started;
  - searches all words in eight directions;
  - normalizes Portuguese diacritics/case;
  - refuses to submit if any word is unresolved;
  - waits for the configured minimum duration for the selected game mode;
  - submits the exact `found_words` payload.

- **Jogo da memória**
  - generates a ClassHero memory round;
  - uses the backend-provided glossary to map each word to its definition;
  - resolves the corresponding shuffled card ids;
  - validates every pair with `/games/memory/validate`;
  - refuses to submit when a pair is unresolved/rejected;
  - waits for the configured minimum duration;
  - reports the real measured elapsed time in `time_seconds`;
  - submits the resulting score with zero intentional wrong attempts.

### Classified as AI-only

The planner already classifies these targets as requiring semantic
interpretation:

- quizzes;
- forca;
- gamified interactive path;
- code activities;
- discursive/text activities.

Their typed submission executors are implemented in later stages.

## Timing system

Timing configuration is persisted in the plugin's own storage under the key:

```text
timingConfig
```

The control is **disabled by default** to preserve the behavior of existing
installations.

When enabled, the plugin enforces a minimum duration before native game
submission. Solver/API processing time counts toward the duration.

Example:

```text
configured minimum = 60 seconds
solver + network    = 8 seconds
remaining wait      = 52 seconds
```

The policy does not sleep for another full 60 seconds after solving.

### Default mini-game timings

| Mini-game | Estudo | Foco | Desafio |
| --- | ---: | ---: | ---: |
| Caça-palavras | 30s | 45s | 60s |
| Jogo da memória | 30s | 45s | 60s |
| Forca | 30s | 45s | 60s |

These are starter values only. They can be changed from the CLI.

### Quiz timing

The plugin stores:

```text
secondsPerQuestion
```

with a default of:

```text
30 seconds
```

The future quiz executor calls `ExecutionTimingPolicy.waitForQuizQuestion()`
once per question. Time spent by the AI provider and network already counts
toward that question's minimum duration.

For planning/display purposes:

```ts
const minimum =
    await policy.getQuizMinimumSeconds(questionCount);
```

## Configuring timing in the CLI

When the plugin is enabled, the main menu contains:

```text
Configurações do Automator
```

Open it to access:

```text
Controle de tempo
Tempos dos mini-games
Tempo por pergunta do quiz
Restaurar padrões
Voltar
```

### Mini-game configuration

Choose one game:

```text
Caça-palavras
Jogo da memória
Forca
```

and enter separate minimum durations for:

```text
Estudo
Foco
Desafio
```

Values are stored in seconds.

### Enabling timing

Changing durations does not automatically enable timing.

Use:

```text
Configurações do Automator
└── Controle de tempo
```

to enable it explicitly.

## Architecture

```text
Activity
   |
   v
AutomationPlanner
   |
   +-------------------+
   |                   |
Native Solver      AI Provider
   |                   |
   +---------+---------+
             |
             v
    ExecutionTimingPolicy
             |
             v
          Submit
```

Solvers remain pure and fast. They know nothing about waiting.

The timing policy is owned by the execution layer.

## Provider inversion

This package does **not** depend on OpenAI, Gemini, Anthropic or another AI
SDK.

Providers register themselves through:

```ts
AI_PROVIDER
```

Multiple providers may coexist.

## Public timing API

The package exports:

```ts
AutomatorTimingConfig
DEFAULT_TIMING_CONFIG
TimingConfigStore
ExecutionTimingPolicy
TimingWaitEvent
TimingWaitResult
```

Other typed executors in this package use the same policy.

## Build

From the repository root:

```bash
yarn install
yarn build
```

Or only this workspace:

```bash
yarn workspace @classhero-cli/classhero-ai-automator build
```

## Loading in the CLI

Open:

```text
Plugins
└── Adicionar plugin
```

and enter:

```text
./apps/plugins/classhero-ai-automator/dist/index.js
```

## Testing

1. Enable the plugin.
2. Open **Configurações do Automator**.
3. Configure mini-game durations.
4. Configure quiz seconds per question.
5. Enable **Controle de tempo**.
6. Select a discipline, mission and `games` activity.
7. Open **Automatizar atividade**.
8. Run caça-palavras or memória.
9. The logger shows the configured minimum, elapsed time and remaining wait.
10. Final execution metadata reports the measured timing values.

## Safety behavior

- timing is explicit and configurable;
- the plugin measures real elapsed time;
- no timestamp is fabricated;
- no random delay is added;
- unknown activities are not submitted;
- word-search does not submit incomplete solutions;
- memory validates every pair before submission;
- deterministic targets do not call an AI provider.
