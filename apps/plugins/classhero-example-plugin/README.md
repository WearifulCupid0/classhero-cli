# @classhero-cli/example-plugin

Plugin de diagnóstico criado para validar a `@classhero-cli/plugin-api` dentro da
CLI real.

Ele não automatiza nenhuma atividade e não modifica dados da conta. A única
requisição de ClassHero que ele pode fazer é `GET /auth/session`, quando o
usuário escolhe explicitamente o teste de API e já está autenticado.

## O que este plugin testa

Ao ser habilitado, o plugin:

- injeta **Plugin de teste** no menu principal;
- executa um fluxo próprio através de `PromptHost`;
- lê o estado readonly do CLI através de `CLI_CONTEXT`;
- grava e lê dados em `PluginStorage`;
- publica e consome um serviço através de `ServiceRegistry`;
- observa `cli:ready`;
- observa `activity:selected` e registra a última atividade no storage;
- acessa a instância compartilhada do `api-wrapper`;
- depende do cleanup automático do lifecycle para remover menu, hooks e
  services quando é desabilitado.

## Build

Na raiz do monorepo:

```bash
yarn install
yarn build
```

Ou somente este workspace:

```bash
yarn workspace @classhero-cli/example-plugin build
```

## Adicionando à CLI

Execute:

```bash
yarn cli
```

Abra:

```text
Plugins
└── Adicionar plugin
```

Para o primeiro teste, informe o caminho compilado:

```text
./apps/plugins/classhero-example-plugin/dist/index.js
```

O uso do caminho relativo evita depender da resolução de um package name
durante o teste do loader.

Depois volte ao menu principal. A opção abaixo deverá aparecer imediatamente:

```text
Plugin de teste
```

## Testes manuais recomendados

### 1. Menu injection e PromptHost

Abra **Plugin de teste**. Um submenu com quatro diagnósticos e **Voltar** deve
ser exibido.

Isso confirma:

```text
PluginLoader
  -> PluginManager.enable
  -> MenuRegistry
  -> PromptHost
  -> ClackPromptRenderer
```

### 2. CLI_CONTEXT

Escolha **Ler contexto atual do CLI**.

O logger exibirá autenticação e, quando existirem, disciplina, missão e
atividade selecionadas.

### 3. PluginStorage

Escolha **Testar storage persistente**.

O contador `executionCount` cresce toda vez que o menu do plugin é aberto.
Feche e abra a CLI novamente para confirmar persistência.

O arquivo fica sob:

```text
.classhero-cli/plugins/
```

### 4. ServiceRegistry

Escolha **Testar ServiceRegistry**.

O plugin resolve `EXAMPLE_PLUGIN_SERVICE` através do registry e consulta o
contador sem acessar a implementação concreta diretamente.

### 5. api-wrapper

Faça login e escolha **Testar acesso ao api-wrapper**.

O plugin usa:

```ts
context.api.auth.session();
```

Isto confirma que plugins recebem a mesma instância autenticada de
`ClassHero` usada pela CLI.

### 6. Hook de atividade

Selecione uma disciplina, missão e atividade normalmente.

O hook `activity:selected` grava os dados da última atividade no storage do
plugin.

### 7. Disable/enable

Abra:

```text
Plugins
└── Ativar/desativar plugin
```

Desabilite o example plugin.

A opção **Plugin de teste** deve desaparecer imediatamente. Os hooks e o
service também são descartados automaticamente.

Habilite novamente e a opção deve reaparecer sem reiniciar a CLI.

## Exportações

O package exporta:

```ts
import plugin, {
    EXAMPLE_PLUGIN_SERVICE,
    type ExamplePluginService,
} from "@classhero-cli/example-plugin";
```

O service token existe para demonstrar como um segundo plugin pode consumir
capacidades publicadas pelo primeiro.
