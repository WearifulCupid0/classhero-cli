# @classhero-cli/classhero-ai-provider-openai

OpenAI provider plugin for `@classhero-cli/classhero-ai-automator`.

The provider implements the automator's provider-neutral `AIProvider`
interface with the official OpenAI JavaScript/TypeScript SDK.

## Configuration philosophy

The user configures exactly two values:

```text
API key
Model id
```

There is deliberately no prompt editor.

Activity-specific instructions live in the automator's typed executors and are
hardcoded in source code. The provider also has a small hardcoded provider
policy. This keeps model behavior consistent across installations.

## Validation before saving

A new API key/model pair is **not persisted immediately**.

The provider first performs a tiny real OpenAI Responses API request using:

- the supplied API key;
- the supplied model;
- Structured Outputs with a strict JSON schema.

Only after that request succeeds and returns the expected structured payload
is the configuration persisted.

Therefore the validation checks, in practice:

```text
API key authenticates
        ↓
model exists/is accessible
        ↓
model works through Responses API
        ↓
model accepts Structured Outputs
        ↓
save configuration
```

If validation fails, the previous saved configuration remains unchanged.

The validation call is a real OpenAI API request and may consume a very small
number of tokens.

## SDK

The package depends on:

```json
"openai": "^7.12.1"
```

and uses:

```ts
import OpenAI from "openai";

const client = new OpenAI({ apiKey });

await client.responses.create(...);
```

## Structured outputs

When an automator executor requests:

```ts
{
    output: {
        kind: "json",
        jsonSchema: { ... }
    }
}
```

the OpenAI provider maps it to Responses API Structured Outputs:

```ts
text: {
    format: {
        type: "json_schema",
        name: "...",
        schema: { ... },
        strict: true
    }
}
```

The returned `output_text` is parsed as JSON and exposed through
`AIProviderResult.data`.

## Hardcoded prompts

The user cannot edit prompts from the CLI.

The final instruction is assembled from:

```text
hardcoded provider policy
            +
hardcoded activity-specific instruction supplied by the automator
```

No prompt text is stored in provider configuration.

## Main-menu integration

With the plugin enabled, the CLI adds:

```text
Configurações OpenAI
```

The submenu contains:

```text
Configurar API key e modelo
Testar configuração atual
Remover configuração
Voltar
```

### Configure

The CLI asks for:

```text
API key da OpenAI
Modelo da OpenAI
```

The API key field is masked.

When reconfiguring, pressing Enter with an empty API key keeps the current key.

The model can be changed independently, but it is validated with the current
key before being saved.

### Test current configuration

Runs the same lightweight validation without changing credentials. On success
it refreshes `validatedAt`.

### Remove configuration

Deletes the API key/model from the provider's plugin storage and immediately
makes `AIProvider.isAvailable()` return `false`.

## Persistence and API-key handling

The API key is never:

- included in normal logs;
- included in provider status objects;
- passed to the automator;
- exposed through `AIProviderResult`.

Logs use a masked representation such as:

```text
sk-…7xQ2
```

The current ClassHero CLI host implements plugin storage using local JSON
files. Therefore the credential is persisted locally under `.classhero-cli/`.
That directory should remain ignored by Git and protected like any other
local credential store.

## Loading

First ensure the automator is installed:

```text
./apps/plugins/classhero-ai-automator/dist/index.js
```

Then add:

```text
./apps/plugins/classhero-ai-provider-openai/dist/index.js
```

The provider declares:

```text
classhero-ai-automator
```

as a required plugin dependency.

## Build

From the repository root:

```bash
yarn install
yarn build
```

Or:

```bash
yarn workspace @classhero-cli/classhero-ai-provider-openai build
```

## Current role

This package supplies the provider implementation only.

Native word-search and memory activities remain completely independent from
OpenAI. The automator only resolves this provider for activity targets marked
with:

```ts
strategy: "ai"
```

The next automator stage can now implement typed AI executors for:

1. hangman;
2. quizzes;
3. interactive paths;
4. code/discursive activities.
