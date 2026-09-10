# @classhero-cli/cli

Aplicação interativa do **classhero-cli**. Este workspace concentra apenas a experiência de terminal, orquestração do estado da sessão e carregamento de plugins. Toda comunicação HTTP permanece em `@classhero-cli/api-wrapper`, enquanto os contratos de extensibilidade pertencem a `@classhero-cli/plugin-api`.

## Responsabilidades

- renderizar prompts com `@clack/prompts`;
- adaptar os prompts neutros da Plugin API através de `ClackPromptRenderer`;
- manter o contexto atual de usuário, disciplina, missão e atividade;
- persistir/restaurar a sessão do ClassHero;
- carregar, habilitar, desabilitar e remover plugins configurados;
- fornecer storage persistente isolado para cada plugin;
- emitir hooks de lifecycle e seleção;
- executar os fluxos principais de login, disciplina, missão e atividades.

O CLI **não** implementa endpoints HTTP diretamente e **não** conhece plugins concretos como o AI Automator ou providers de IA.

## Build

Na raiz do monorepo:

```bash
yarn build
```

Ou somente este workspace:

```bash
yarn workspace @classhero-cli/cli build
```

A compilação é feita exclusivamente por `tsc -b` e usa Project References para `api-wrapper` e `plugin-api`.

## Execução

Depois do build:

```bash
yarn cli
```

ou:

```bash
yarn workspace @classhero-cli/cli start
```

O `dist/index.js` também possui shebang e pode ser exposto como `classhero-cli` quando o pacote for linkado/instalado.

## Estrutura

```text
src/
├── index.ts
├── CLI.ts
├── constants.ts
├── flows/
│   ├── AuthFlow.ts
│   ├── DisciplineFlow.ts
│   ├── MissionFlow.ts
│   ├── ActivityFlow.ts
│   ├── PluginManagementFlow.ts
│   └── EvalFlow.ts
├── runtime/
│   ├── AppContext.ts
│   ├── paths.ts
│   ├── PluginConfigStore.ts
│   └── PluginLoader.ts
├── storage/
│   ├── JsonFileStore.ts
│   ├── SessionStore.ts
│   └── FilePluginStorage.ts
├── ui/
│   └── ClackPromptRenderer.ts
└── utils/
    └── clean.ts
```

## PromptHost e Clack

O core não chama `clack.select()` nos menus extensíveis. O caminho é:

```text
CLI / Plugin
    ↓
PromptHost
    ↓
prompt:before
    ↓
MenuRegistry
    ↓
prompt:resolve
    ↓
ClackPromptRenderer
    ↓
prompt:after
    ↓
onSelect da opção
```

Isso permite que um plugin:

- adicione uma opção a um menu existente;
- remova ou altere opções;
- execute um fluxo próprio através de `onSelect`;
- resolva um prompt antecipadamente e não mostrar o Clack;
- crie prompts próprios usando o mesmo `PromptHost`.

### IDs estáveis principais

| Prompt | ID |
| --- | --- |
| Menu principal | `main` |
| Método de login | `auth.method` |
| E-mail | `auth.login.email` |
| Código | `auth.login.code` |
| Senha | `auth.login.password` |
| Disciplina | `discipline.select` |
| Missão | `mission.select` |
| Atividade | `activity.select` |
| Gerenciador de plugins | `plugins.manage` |

As opções core também possuem IDs estáveis como `main.login`, `main.disciplines`, `main.missions`, `main.activities`, `main.plugins` e `main.exit`.

## Contexto readonly para plugins

O host publica o `AppContext` através do token `CLI_CONTEXT` definido em `@classhero-cli/plugin-api`:

```ts
import { CLI_CONTEXT } from "@classhero-cli/plugin-api";

const cli = context.services.get(CLI_CONTEXT);
const snapshot = cli?.getSnapshot();
```

O snapshot informa autenticação e as seleções atuais. Plugins recebem dados readonly e não podem alterar o estado interno do CLI diretamente.

## Sessão

Por padrão os dados locais ficam em:

```text
.classhero-cli/
├── session.json
├── plugins.json
└── plugins/
    └── <plugin-id>.json
```

O diretório pode ser alterado com:

```bash
CLASSHERO_CLI_HOME=/outro/diretorio
```

Na primeira execução após a migração, `SessionStore` procura o antigo `./login.json`, copia a sessão para `.classhero-cli/session.json` e passa a usar o novo local.

Tokens e credenciais não devem ser commitados. O diretório `.classhero-cli/` e o antigo `login.json` já são ignorados pelo `.gitignore` raiz.

## Plugins

A configuração possui o formato:

```json
{
  "version": 1,
  "plugins": [
    {
      "specifier": "@classhero-cli/classhero-ai-automator",
      "enabled": true
    }
  ]
}
```

`PluginLoader` aceita:

- nome de pacote Node (`@vendor/plugin`);
- caminho relativo (`./plugins/meu-plugin.js`);
- caminho absoluto;
- URL `file:`.

O módulo pode exportar qualquer uma destas convenções:

```ts
export default plugin;
```

```ts
export const plugin = { /* ClassHeroPlugin */ };
```

```ts
export function createPlugin() {
    return plugin;
}
```

O menu **Plugins** permite adicionar, ativar/desativar e remover entradas sem acoplar o CLI a plugins concretos.

## Seleção de disciplina e missão

A versão antiga do CLI passava `class_discipline_id` para `xp-progress/missions`. Os HARs analisados mostram que essa rota usa `course_id`.

O fluxo novo utiliza `discipline.course_id` quando disponível e mantém `class_discipline_id` somente como fallback para dados antigos/incompletos.

## Eval

O fluxo `Eval` original foi preservado como ferramenta de desenvolvimento, mas não aparece por padrão. Para habilitá-lo:

```bash
CLASSHERO_CLI_ENABLE_EVAL=1 yarn cli
```

`eval` executa código local no mesmo processo e nunca deve receber conteúdo não confiável ou vindo de uma atividade/remoto.

## Cancelamento e encerramento

Cancelar o menu principal não usa `process.exit()` imediatamente. O CLI inicia shutdown ordenado:

1. executa `cli:stopping`;
2. desabilita/descarta plugins em ordem de dependências;
3. libera registries/scopes;
4. encerra a interface.

Isso permite que plugins façam cleanup de forma previsível.
