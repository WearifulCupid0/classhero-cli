# @classhero-cli/plugin-api

SDK tipado e runtime de plugins do **classhero-cli**.

Este pacote define a fronteira entre o CLI principal e plugins externos/built-in. Ele não renderiza terminal, não acessa o filesystem diretamente e **não depende de `@clack/prompts`**. A aplicação em `apps/cli` implementa um `PromptRenderer` que adapta os prompts neutros deste pacote ao Clack.

## Objetivos

- permitir plugins independentes do código interno do CLI;
- compartilhar uma única instância autenticada de `ClassHero`;
- interceptar comportamentos via hooks/middlewares;
- injetar, remover e substituir opções de menus existentes;
- criar fluxos de prompts próprios;
- pular prompts originais por short-circuit;
- permitir comunicação entre plugins por serviços tipados;
- oferecer lifecycle previsível: registro, enable, disable e dispose;
- remover automaticamente recursos quando um plugin é desabilitado;
- maximizar DX com tipos e TSDoc em todas as superfícies públicas.

## Instalação dentro do monorepo

```json
{
  "dependencies": {
    "@classhero-cli/plugin-api": "workspace:*"
  }
}
```

O pacote depende de `@classhero-cli/api-wrapper`, também via workspace.

## Arquitetura

```text
apps/cli
  │
  ├── ClackPromptRenderer ───────────────┐
  │                                     │
  └── createPluginRuntime()             │
          │                             │
          ├── PromptHost ◄──────────────┘
          │    ├── prompt:before
          │    ├── MenuRegistry
          │    ├── prompt:resolve
          │    ├── PromptRenderer
          │    └── prompt:after
          │
          ├── HookRegistry
          ├── ServiceRegistry
          ├── EventBus
          └── PluginManager
                 │
                 └── PluginContext
                        └── ClassHero API
```

## Runtime recomendado

O CLI normalmente precisa apenas de uma instância autenticada do wrapper e de um renderer:

```ts
import { ClassHero } from "@classhero-cli/api-wrapper";
import {
    createPluginRuntime,
    type PromptRenderer,
} from "@classhero-cli/plugin-api";

const api = new ClassHero();
const renderer: PromptRenderer = /* adapter de @clack/prompts */;

const runtime = createPluginRuntime({
    api,
    renderer,
});
```

O retorno contém:

```ts
runtime.hooks;
runtime.menus;
runtime.services;
runtime.events;
runtime.prompts;
runtime.plugins;
```

## Criando um plugin

```ts
import {
    PLUGIN_API_VERSION,
    type ClassHeroPlugin,
} from "@classhero-cli/plugin-api";

export const plugin: ClassHeroPlugin = {
    manifest: {
        id: "example-plugin",
        name: "Example Plugin",
        version: "1.0.0",
        apiVersion: PLUGIN_API_VERSION,
    },

    async enable(context) {
        context.logger.info("Plugin enabled");

        context.hooks.use("discipline:selected", async ({ payload, next }) => {
            context.logger.debug("Discipline selected", {
                id: payload.id,
            });

            return next();
        });
    },
};
```

Não é necessário guardar o `Disposable` devolvido por `context.hooks.use()`: a runtime associa a inscrição ao escopo de `enable()` e a remove automaticamente em `disable()`.

## Lifecycle

### `register(context)`

Executado uma vez após o plugin ser carregado.

Use para inicialização que deve permanecer enquanto o plugin estiver registrado. Recursos criados aqui sobrevivem a `disable()` e são removidos somente em `dispose()`.

### `enable(context)`

Executado sempre que o plugin é ativado.

Este é o local recomendado para registrar:

- hooks;
- opções de menu;
- event listeners;
- providers/services que só devem existir com o plugin habilitado.

Tudo registrado pelo `PluginContext` durante `enable()` é removido automaticamente durante `disable()`.

### `disable(context)`

Executado antes de os recursos do escopo de `enable()` serem liberados.

Use para encerrar timers/processos ou salvar estado final. Não registre recursos de longa duração aqui.

### `dispose(context)`

Executado antes da remoção definitiva do plugin e dos recursos criados durante `register()`.

## Dependências entre plugins

```ts
manifest: {
    id: "consumer",
    name: "Consumer",
    version: "1.0.0",
    apiVersion: PLUGIN_API_VERSION,
    dependencies: [
        {
            id: "provider",
            version: "1.0.0",
        },
    ],
}
```

Quando `consumer` é habilitado, `provider` é habilitado primeiro.

Ao desabilitar `provider`, dependentes habilitados são desabilitados antes dele.

O campo `version` de uma dependência é atualmente uma comparação **exata**. O runtime não implementa ranges SemVer nesta versão.

## Hooks e middleware

O `HookRegistry` implementa Chain of Responsibility.

Um middleware pode:

1. observar o payload;
2. chamar `next()`;
3. trocar o payload com `next(newPayload)`;
4. alterar o retorno recebido do próximo handler;
5. não chamar `next()` e interromper completamente o fluxo.

Exemplo:

```ts
context.hooks.use("prompt:resolve", async ({ payload, next }) => {
    if (payload.definition.id !== "discipline.select") {
        return next();
    }

    const preferred = await context.storage.get<string>("preferredDisciplineId");

    if (!preferred) {
        return next();
    }

    return {
        status: "submitted",
        value: preferred,
    };
});
```

Esse código **pula o prompt**. O renderer Clack nunca é chamado.

### Hooks principais

A versão atual fornece contratos tipados para:

- `cli:starting`;
- `cli:ready`;
- `cli:stopping`;
- `session:authenticated`;
- `session:cleared`;
- `discipline:selected`;
- `mission:selected`;
- `activity:selected`;
- `prompt:before`;
- `prompt:resolve`;
- `prompt:after`;
- `api:beforeRequest`;
- `api:afterResponse`;
- `api:error`.

Os hooks de API são contratos para a integração do runtime. Eles não alteram o `ApiClient` sozinhos; o host precisa emitir esses pontos quando integrar o transporte ao pipeline de plugins.

## Menus extensíveis

Menus dependem de duas coisas:

1. um `prompt.id` estável;
2. cada opção possuir um `id` estável independente de seu `value`.

Exemplo de menu do core:

```ts
const result = await runtime.prompts.run({
    id: "main",
    kind: "select",
    message: "O que deseja fazer?",
    options: [
        {
            id: "discipline",
            value: "discipline",
            label: "Selecionar disciplina",
        },
        {
            id: "exit",
            value: "exit",
            label: "Sair",
        },
    ],
});
```

Um plugin pode inserir uma opção antes de `exit`:

```ts
context.menus.contribute<string>("main", (menu) => {
    menu.addBefore("exit", {
        id: "ai-automation",
        value: "ai-automation",
        label: "Automação",
        hint: "Abrir ferramentas de automação",
    });
});
```

`MenuBuilder` fornece:

- `has()`;
- `add()`;
- `addBefore()`;
- `addAfter()`;
- `remove()`;
- `replace()`;
- `update()`;
- `snapshot()`.

Contribuições têm `priority`; prioridades maiores são aplicadas primeiro.

## PromptHost

O fluxo é sempre:

```text
Prompt definition
      │
      ▼
prompt:before
      │
      ▼
MenuRegistry.compose (select/multiselect)
      │
      ▼
prompt:resolve
      │
      ├── resolveu? ──► resultado
      │
      └── não
           │
           ▼
     PromptRenderer
           │
           ▼
     prompt:after
```

O plugin nunca precisa importar Clack.

### Tipos de prompt

- `text`;
- `confirm`;
- `select`;
- `multiselect`;
- `custom`.

`custom` existe para fluxos especiais que o renderer do CLI conhece, sem acoplar o SDK à biblioteca visual.

## Adapter para `@clack/prompts`

A implementação ficará em `apps/cli`, não neste package.

Conceitualmente:

```ts
class ClackPromptRenderer implements PromptRenderer {
    async render(definition: AnyPromptDefinition) {
        switch (definition.kind) {
            case "select":
                // chamar select() do Clack
                break;
            // ...
        }
    }
}
```

O renderer também converte o cancelamento do Clack para:

```ts
{
    status: "cancelled",
}
```

Assim plugins nunca dependem do `symbol` ou da API interna usada pelo Clack para cancelamento.

## ServiceRegistry

Use serviços para dependência inversa entre plugins.

Esse será o mecanismo usado pelo AI Automator e pelos providers de IA.

```ts
import { createServiceToken } from "@classhero-cli/plugin-api";

export interface ExampleProvider {
    execute(input: string): Promise<string>;
}

export const EXAMPLE_PROVIDER = createServiceToken<ExampleProvider>(
    "example.provider",
);
```

Provider:

```ts
context.services.provide(EXAMPLE_PROVIDER, implementation);
```

Consumer:

```ts
const provider = context.services.get(EXAMPLE_PROVIDER);
```

Também existe `getAll()`, permitindo múltiplos providers simultâneos.

Providers têm prioridade opcional:

```ts
context.services.provide(TOKEN, provider, {
    priority: 100,
});
```

`get()` retorna o provider de maior prioridade.

## EventBus

Eventos são usados quando não existe transformação ou retorno.

Hooks são middleware; eventos são notificações.

```ts
context.events.on("plugin:enabled", ({ pluginId }) => {
    context.logger.debug(`Enabled: ${pluginId}`);
});
```

## API do ClassHero

Todo plugin recebe:

```ts
context.api
```

Ela é a mesma instância de `ClassHero` usada pelo CLI, portanto compartilha:

- access token;
- refresh token;
- token VM;
- refresh automático;
- configuração de `baseUrl`/transport.

Plugins não devem criar outra sessão sem uma razão específica.

## Storage

`PluginStorage` é deliberadamente abstrato.

O fallback do package é `MemoryPluginStorage`, mas o CLI deverá fornecer uma implementação persistente, provavelmente dentro de `.classhero-cli/`.

```ts
await context.storage.set("enabledMode", "manual");
const mode = await context.storage.get<string>("enabledMode");
```

O namespace já é isolado por plugin pelo `PluginStorageFactory` do host.

## Disposable resources

Se um plugin cria um recurso que não veio de uma API do contexto, pode anexá-lo ao lifecycle:

```ts
context.track({
    dispose() {
        server.close();
    },
});
```

Também estão disponíveis:

- `Disposable`;
- `DisposableStack`;
- `toDisposable()`.

## Segurança

A versão atual assume **plugins confiáveis**.

Plugins são módulos Node.js executados no mesmo processo do CLI. Portanto podem, por natureza, acessar APIs Node.js disponíveis ao processo.

Este SDK organiza permissões lógicas e lifecycle, mas não é uma sandbox de segurança. Isolamento real exigiria outro boundary, como processo separado/Worker com protocolo explícito.

## Próxima integração

O próximo passo no monorepo será conectar esta API a `apps/cli`:

- `ClackPromptRenderer`;
- `PluginLoader` dinâmico;
- armazenamento persistente de plugins;
- menus do CLI convertidos para ids estáveis;
- emissão dos hooks de navegação;
- enable/disable configurável.

Depois disso, `apps/plugins/classhero-ai-automator` poderá ser implementado usando apenas os contratos públicos deste package.
