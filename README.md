# ClassHero CLI

O **ClassHero CLI** é um projeto TypeScript para interação com o **ClassHero**, organizado como um monorepo que reúne:

- uma CLI interativa baseada em `@clack/prompts`;
- um wrapper fortemente tipado para a API REST observada do ClassHero;
- uma API de plugins para extensão do comportamento e da interface da CLI;
- plugins de automação com solucionadores algorítmicos e providers de IA desacoplados.

O objetivo da arquitetura é manter cada responsabilidade isolada. O acesso HTTP pertence ao `api-wrapper`, o mecanismo de extensibilidade pertence ao `plugin-api`, a interface pertence à aplicação CLI e automações específicas vivem em plugins independentes.

> [!IMPORTANT]
> O ClassHero CLI não é uma ferramenta oficial do ClassHero e não possui vínculo oficial com a UTFPR. A API do ClassHero utilizada por este projeto foi inferida a partir de tráfego HTTP e dos assets do frontend disponibilizados para análise, portanto endpoints e formatos de resposta podem mudar sem aviso.

## Status

O projeto está em processo de migração para a arquitetura de monorepo descrita neste documento.

A compilação de todo o código TypeScript é feita diretamente pelo compilador oficial através de **Project References**:

```bash
tsc -b
```

Não são utilizados `tsup`, `esbuild`, Rollup, Vite ou outro bundler/transpilador para gerar o JavaScript dos workspaces.

## Estrutura

```text
classhero-cli/
├── apps/
│   ├── cli/
│   │   └── CLI principal do ClassHero CLI
│   │
│   └── plugins/
│       ├── classhero-ai-automator/
│       │   └── Orquestra automações e escolhe entre algoritmo e IA
│       │
│       └── classhero-ai-provider-openai/
│           └── Provider de IA de exemplo
│
├── packages/
│   ├── api-wrapper/
│   │   └── SDK tipado da API do ClassHero
│   │
│   └── plugin-api/
│       └── Contratos, hooks, menus, lifecycle e serviços de plugins
│
├── package.json
├── tsconfig.base.json
├── tsconfig.json
└── .yarnrc.yml
```

### Workspaces

| Diretório | Pacote | Responsabilidade |
| --- | --- | --- |
| `apps/cli` | `@classhero-cli/cli` | Aplicação interativa e runtime dos plugins |
| `apps/plugins/classhero-ai-automator` | `@classhero-cli/classhero-ai-automator` | Planejamento e execução das automações |
| `apps/plugins/classhero-ai-provider-openai` | `@classhero-cli/classhero-ai-provider-openai` | Provider de IA independente |
| `packages/api-wrapper` | `@classhero-cli/api-wrapper` | Wrapper HTTP e tipagens da API |
| `packages/plugin-api` | `@classhero-cli/plugin-api` | SDK público para criação de plugins |

Todos os workspaces usam o namespace `@classhero-cli/*`. O wrapper HTTP é publicado internamente como `@classhero-cli/api-wrapper`.

## Requisitos

- **Node.js 22 ou superior**;
- **Yarn 4**;
- Corepack disponível ou Yarn compatível configurado manualmente.

O repositório fixa a versão esperada do Yarn através do campo `packageManager` do `package.json`.

### Ativando o Corepack

```bash
corepack enable
```

Depois, instale as dependências:

```bash
yarn install
```

O projeto utiliza o linker `node-modules`. Isso mantém o comportamento de resolução de módulos do Node.js previsível e facilita o carregamento de plugins externos por `import()`.

## Build

Compile o monorepo inteiro:

```bash
yarn build
```

O script executa:

```bash
tsc -b
```

O `tsconfig.json` raiz funciona apenas como agregador dos projetos. Cada workspace possui seu próprio `tsconfig.json` com `composite: true` herdado de `tsconfig.base.json` e declara explicitamente suas dependências através de `references`.

O TypeScript, portanto, calcula a ordem correta do build a partir do grafo de dependências.

### Build em modo watch

```bash
yarn build:watch
```

### Limpar artefatos gerados

```bash
yarn clean
```

O comando usa o próprio modo de build do TypeScript:

```bash
tsc -b --clean
```

## Executando a CLI

Depois que o workspace `apps/cli` estiver instalado e compilado:

```bash
yarn cli
```

ou:

```bash
yarn start
```

O comando delega a execução ao workspace `@classhero-cli/cli`.

## Arquitetura

A direção principal das dependências é:

```text
                         ┌──────────────────────┐
                         │      apps/cli        │
                         └──────────┬───────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
        ┌──────────────────────┐       ┌──────────────────────┐
        │ packages/plugin-api  │       │   apps/plugins/*     │
        └──────────┬───────────┘       └──────────┬───────────┘
                   │                              │
                   └──────────────┬───────────────┘
                                  ▼
                     ┌────────────────────────┐
                     │ packages/api-wrapper   │
                     └────────────┬───────────┘
                                  ▼
                           ClassHero API
```

O core da CLI não deve possuir dependências diretas de plugins concretos. Plugins são descobertos e registrados pelo runtime e interagem com a aplicação através dos contratos públicos de `@classhero-cli/plugin-api`.

## API Wrapper

`packages/api-wrapper` concentra todo o conhecimento sobre HTTP do ClassHero:

- autenticação e refresh de sessão;
- construção das requisições;
- tipagens de request e response;
- módulos organizados por domínio;
- upload e download de arquivos;
- endpoints de jogos;
- endpoints de atividades, materiais, quizzes, jornada, XP e demais recursos observados;
- transporte `raw` para situações ainda não modeladas.

As rotas e tipagens são levantadas a partir da união das capturas HAR e dos assets JavaScript do frontend disponibilizados para o projeto. Quando uma estrutura não puder ser comprovada pelas fontes analisadas, ela não deverá ser inventada como se fosse um contrato estável.

## Plugin API

`packages/plugin-api` define a superfície pública utilizada por plugins.

Ela será responsável por recursos como:

- manifesto e lifecycle (`register`, `enable`, `disable`, `dispose`);
- hooks tipados;
- middlewares;
- registro e composição de menus;
- interceptação de prompts sem monkey patch de `@clack/prompts`;
- injeção de novas opções em menus existentes;
- short-circuit de prompts;
- fluxos de prompts próprios;
- service registry para comunicação entre plugins;
- acesso controlado ao contexto compartilhado da aplicação.

Como esse pacote é a principal interface para desenvolvedores de plugins, seus tipos públicos serão documentados extensivamente com **TSDoc/JSDoc**. Comentários não são removidos durante a compilação, e `declarationMap` permanece habilitado para melhorar navegação e IntelliSense.

## Integração com `@clack/prompts`

Plugins não devem modificar internamente o `@clack/prompts` nem sobrescrever suas funções em runtime.

A CLI utiliza uma camada intermediária:

```text
CLI
 ↓
PromptHost
 ↓
Hooks / Middlewares
 ↓
MenuRegistry
 ↓
PromptRenderer
 ↓
@clack/prompts
```

Esse desenho permite que um plugin altere a experiência da CLI sem depender de detalhes internos da biblioteca de prompts.

Por exemplo, um plugin poderá:

- adicionar uma opção ao menu principal;
- esconder uma opção existente;
- modificar label ou hint;
- inserir uma opção antes/depois de outra;
- fornecer um valor antecipadamente e evitar a exibição de um menu;
- iniciar um fluxo de prompts próprio.

## Automação: algoritmo antes de IA

O automator segue uma regra de decisão simples:

> Se uma atividade puder ser resolvida de forma determinística e confiável, ela não deve consumir um modelo de IA.

### Solucionadores algorítmicos

Atividades com solução mecânica terão executores nativos. Inicialmente:

- **caça-palavras**: busca das palavras diretamente na matriz em todas as direções suportadas pelo jogo;
- **jogo da memória**: resolução baseada no estado e nos pares fornecidos pelo próprio fluxo do jogo.

Esses solucionadores ficam isolados da camada de IA e podem ser testados de forma determinística.

### Atividades que podem usar IA

Providers de IA entram apenas quando existe necessidade real de interpretação ou geração de conteúdo, por exemplo:

- quizzes cujo conteúdo exige interpretação;
- jogo da forca quando a resposta depende de contexto semântico;
- respostas discursivas;
- atividades que pedem geração ou análise de código;
- outros formatos que não possuam uma solução algorítmica confiável.

O automator nunca depende diretamente de OpenAI, Gemini ou outro fornecedor.

```text
classhero-ai-automator
          │
          ▼
     AIProvider
      ▲      ▲
      │      │
  OpenAI   Gemini
```

Providers são plugins independentes e são descobertos através do service registry da Plugin API.

## Princípios do projeto

### Separação de responsabilidades

A CLI não implementa diretamente endpoints HTTP. O `api-wrapper` não conhece Clack. O `plugin-api` não conhece plugins concretos. Providers de IA não controlam diretamente a API do ClassHero.

### Extensibilidade sem acoplamento

Novos plugins devem poder ser adicionados sem modificar o core da CLI.

### Tipagem como contrato

Interfaces públicas devem ser específicas e reutilizáveis. `unknown` é preferível a afirmar um formato que não foi comprovado pelas fontes analisadas.

### Automação determinística primeiro

IA é uma dependência opcional para problemas que realmente exigem interpretação, não o mecanismo padrão para qualquer atividade.

### Compilação transparente

Todo JavaScript produzido pelo monorepo vem diretamente do `tsc`.

## Project References

O `tsconfig.json` raiz referencia os projetos compiláveis:

```text
packages/api-wrapper
        │
        ▼
packages/plugin-api
        │
        ├──────────────────────────────┐
        ▼                              │
classhero-ai-automator                │
        │                              │
        ▼                              │
classhero-ai-provider-openai          │
        │                              │
        └──────────────┬───────────────┘
                       ▼
                   apps/cli
```

As referências específicas de dependência serão declaradas também nos `tsconfig.json` de cada workspace. O grafo acima representa dependências arquiteturais; um provider poderá depender apenas dos contratos necessários, sem introduzir dependência circular com o automator.

## Desenvolvimento de plugins

Um plugin externo dependerá principalmente de:

```text
@classhero-cli/plugin-api
```

Quando precisar chamar o ClassHero diretamente, poderá também utilizar:

```text
classhero-cli
```

A API pública fornecerá contexto, hooks, menus, prompts, serviços e lifecycle sem exigir acesso aos arquivos internos de `apps/cli`.

A documentação completa do contrato ficará em `packages/plugin-api/README.md` e nos próprios tipos através de TSDoc.

## Segurança de credenciais

Tokens de sessão, senhas e chaves de providers de IA não devem ser versionados.

O `.gitignore` raiz ignora arquivos `.env`, o antigo `login.json` e o diretório local `.classhero-cli/`.

Plugins de provider deverão obter suas credenciais através de configuração explícita ou variáveis de ambiente, sem embutir segredos no código-fonte.

## Documentação por workspace

Cada parte do monorepo possuirá um README próprio:

- `apps/cli/README.md`;
- `apps/plugins/README.md`;
- `apps/plugins/classhero-ai-automator/README.md`;
- `apps/plugins/classhero-ai-provider-openai/README.md`;
- `packages/api-wrapper/README.md`;
- `packages/plugin-api/README.md`.

O README raiz documenta a visão geral. Os READMEs locais documentam instalação, APIs e detalhes específicos de cada workspace.

## Licença

MIT.
