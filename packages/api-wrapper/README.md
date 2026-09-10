# @classhero-cli/api-wrapper

SDK TypeScript tipado usado pelo **ClassHero CLI** para acessar a API HTTP do ClassHero observada nos HARs e nos assets JavaScript fornecidos ao projeto.

O pacote isola transporte HTTP, autenticação, tipagens e módulos de domínio para que a aplicação CLI e os plugins não precisem construir URLs ou payloads manualmente.

> Este projeto não é uma API oficial do ClassHero. Os contratos são derivados do comportamento observado da aplicação web e podem mudar caso a plataforma seja alterada.

## Objetivos

- centralizar todas as chamadas HTTP do ClassHero;
- fornecer tipos TypeScript reutilizáveis pelo CLI e pelos plugins;
- manter autenticação e refresh de tokens em uma única instância de transporte;
- evitar duplicação de URLs, query strings e payloads;
- manter um inventário sanitizado das rotas observadas;
- disponibilizar um escape hatch `Raw` sem obrigar o restante do projeto a usar chamadas não tipadas.

## Build

O pacote é um projeto composto do TypeScript e participa do grafo de Project References do monorepo.

```bash
yarn build
```

Para compilar apenas este workspace:

```bash
yarn workspace @classhero-cli/api-wrapper build
```

A geração de JavaScript e declarations é feita exclusivamente por `tsc`.

## Estrutura

```text
packages/api-wrapper/
├── src/
│   ├── api/             # Facades por domínio
│   ├── client/          # Transporte HTTP compartilhado
│   ├── types/           # Tipos por domínio
│   ├── ClassHero.ts     # Facade principal do SDK
│   ├── constants.ts
│   ├── endpoints.ts     # Inventário sanitizado das rotas observadas
│   └── index.ts
├── ENDPOINTS.md
├── package.json
├── README.md
└── tsconfig.json
```

## Uso básico

```ts
import { ClassHero } from "@classhero-cli/api-wrapper";

const classHero = new ClassHero();

const login = await classHero.auth.loginWithPassword("student@example.com", "password");

if (!login.ok) {
    throw new Error(`Falha no login: ${login.status}`);
}

const classes = await classHero.classes.myDisciplines();
```

A instância de `ClassHero` compartilha o mesmo `ApiClient` entre todos os domínios, então tokens obtidos pelo domínio `auth` passam a ser usados automaticamente pelas demais chamadas.

## Domínios tipados atualmente

Nesta etapa estão disponíveis:

- `auth`;
- `users`;
- `classes`;
- `disciplines`;
- `courses`;
- `enrollments`;
- `assignments`;
- `themes`;
- `themeMaterials`;
- `games`;
- `quizzes`;
- `journeyMap`;
- `knowledgeMaps`;
- `storySlides`;
- `learnProfile`;
- `xp` / `xpProgress`;
- `raw`.

`xpProgress` é um alias da mesma instância exposta como `xp`, preservando a compatibilidade com o wrapper anterior.

## Navegação acadêmica

Um fluxo típico do CLI pode ser construído sem URLs manuais:

```ts
const classes = await classHero.classes.myDisciplines();
const themes = await classHero.themes.byCourse(courseId);
const materials = await classHero.themeMaterials.byTheme(themeId);
const assignments = await classHero.assignments.mine({ courseId, themeId });
```

## Games

Os jogos são agrupados em subfacades:

```ts
classHero.games.memory
classHero.games.wordSearch
classHero.games.hangman
```

O domínio cobre criação de sessão/tabuleiro, saldo de créditos, validação e submissão das partidas observadas.

O caça-palavras e o jogo da memória foram modelados de forma que o futuro automator possa resolvê-los deterministicamente sem utilizar um provider de IA.

Exemplo de início de caça-palavras:

```ts
const game = await classHero.games.wordSearch.start({
    materialId,
    themeMissionMaterialId,
    mode: "desafio",
});
```

## Quizzes

`Quizzes` cobre tanto as rotas observadas nos HARs quanto operações confirmadas pelos assets JavaScript do frontend, incluindo:

- tentativa ativa;
- última tentativa concluída;
- criação de tentativa;
- carregamento da questão em JSON;
- atualização da resposta do estudante;
- validação da resposta;
- validação de preview;
- dicas;
- revelação da resposta;
- reabertura de questão;
- violações de troca de aplicação;
- cálculo de score;
- contestações básicas associadas ao quiz.

Os endpoints encontrados somente nos bundles são disponibilizados pelo facade, mas **não são adicionados artificialmente** a `observedEndpoints`, que continua representando somente o inventário dos HARs.

## Journey Map

`JourneyMap` expõe o runtime do estudante e as operações de autoria usadas pelo frontend.

Entre as operações do estudante estão:

- mapa publicado;
- progresso da missão;
- sessão e último node visitado;
- conclusão de nodes;
- progresso dos vídeos de abertura/encerramento;
- saldo de créditos pedagógicos;
- download de background, vídeo e imagem do professor.

Também estão disponíveis as operações de geração, edição, validação, revisão, publicação e upload de assets encontradas no bundle do ClassHero.

`generationProgressUrl()` retorna a URL do stream SSE utilizado durante geração de mapa. O wrapper não cria `EventSource` automaticamente para continuar compatível com Node.js e permitir que o consumidor escolha a implementação de SSE.

## Knowledge Maps

`KnowledgeMaps` oferece:

```ts
classHero.knowledgeMaps.initial(missionId);
classHero.knowledgeMaps.final(missionId);
classHero.knowledgeMaps.markOpened(missionId, "initial");
classHero.knowledgeMaps.save(missionId, "initial", content);
classHero.knowledgeMaps.submit(missionId, "initial", content);
```

Nodes e relações possuem tipos próprios para permitir que plugins manipulem o mapa sem depender de objetos `any`.

## Story Slides

O facade cobre o fluxo do estudante e as ferramentas de autoria confirmadas pelo frontend:

- buscar slides do estudante;
- registrar progresso;
- buscar slides de um tema;
- gerar slides;
- criar/atualizar;
- publicar;
- excluir;
- gerar explicações de glossário.

## Learn Profile

`LearnProfile` cobre o questionário de perfil de aprendizagem e seus fluxos de aplicação:

- status atual;
- versão publicada do questionário;
- resultado atual;
- iniciar aplicação;
- recuperar aplicação em andamento;
- salvar resposta;
- submeter aplicação;
- visões de professor e administrador confirmadas no frontend.

As estruturas do questionário, dimensões, seções, opções e pesos possuem tipagens dedicadas.

## XP e rankings

`XpProgress` está disponível através de `classHero.xp` e `classHero.xpProgress`.

Inclui:

- resumo global;
- cards por disciplina/curso;
- total da disciplina;
- XP e progresso das missões;
- posição;
- ranking completo;
- ranking por missão;
- refresh de XP;
- recálculo de ranking;
- notificação de estudantes sem nome de herói.

## Materiais e arquivos

Rotas binárias usam `download()` e retornam `ApiResponse<Uint8Array>`:

```ts
const pdf = await classHero.themeMaterials.streamPdf(themeId, missionMaterialId);
const cover = await classHero.courses.streamCover(courseId);
```

O wrapper também expõe downloads de enunciados de assignments, assets de curso e mídias do Journey Map.

## Assignments

O domínio `Assignments` cobre a listagem de trabalhos do estudante e as ações usadas pelo frontend para:

- baixar o enunciado principal;
- baixar o enunciado de uma fase;
- abrir arquivos por storage path;
- enviar um arquivo;
- enviar uma fase individual ou em equipe;
- enviar feedback ao professor.

## Theme materials

`ThemeMaterials` concentra tanto os materiais retornados por `/theme-materials` quanto operações específicas dos mission materials sob `/themes/:id/mission-materials`.

Também inclui rotas para:

- sessão de acesso a material;
- markdown de apoio/adaptativo;
- caminho interativo gamificado;
- feedback de caminho interativo;
- feedback de code challenge.

## Transporte

`ApiClient` é responsável por:

- resolver URLs relativas contra a base da API;
- aplicar `Authorization: Bearer` quando há token regular;
- enviar o token VM no cookie observado pelo frontend quando executado no Node.js;
- impedir o vazamento desses cabeçalhos para origens externas;
- interpretar respostas JSON/texto;
- baixar conteúdo binário;
- executar apenas uma operação de refresh por vez quando várias requisições recebem `401` simultaneamente.

O transporte aceita uma implementação customizada de `fetch`, o que facilita testes sem rede.

## `ApiResponse<T>`

As chamadas tipadas retornam o envelope:

```ts
interface ApiResponse<T> {
    ok: boolean;
    status: number;
    statusText: string;
    response: T;
    headers: Headers;
}
```

Isso preserva o estilo do wrapper original e permite que a CLI decida como tratar erros HTTP sem depender de exceções.

Quando uma operação deve falhar imediatamente, `requestOrThrow<T>()` também está disponível.

## Inventário de endpoints

`ENDPOINTS.md` contém a versão legível e `src/endpoints.ts` contém a versão sanitizada utilizável por ferramentas internas.

O inventário não armazena valores de credenciais, cookies, e-mails ou payloads pessoais capturados nos HARs. Ele também não mantém uma coluna/campo de `sources`; essa decisão faz parte do estado atual do projeto.

O inventário observado permanece separado das rotas adicionais inferidas dos bundles. Assim, uma rota confirmada pelo frontend pode existir em um facade mesmo sem ser apresentada como uma rota observada no HAR.

## `Raw`

`Raw` existe para desenvolvimento e compatibilidade com rotas ainda não promovidas para um facade tipado.

```ts
const result = await classHero.raw.get<unknown>("/alguma-rota");
```

Código da aplicação e plugins devem preferir os módulos tipados sempre que eles existirem.

## Compatibilidade

O pacote usa ESM com `moduleResolution: NodeNext`. Imports relativos TypeScript utilizam extensão `.js`, permitindo que o JavaScript emitido pelo `tsc` seja executado diretamente pelo Node.js.
