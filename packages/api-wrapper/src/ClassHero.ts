import { Assignments } from "./api/Assignments.js";
import { Auth } from "./api/Auth.js";
import { Classes } from "./api/Classes.js";
import { Courses } from "./api/Courses.js";
import { Disciplines } from "./api/Disciplines.js";
import { Enrollments } from "./api/Enrollments.js";
import { Games } from "./api/Games.js";
import { JourneyMap } from "./api/JourneyMap.js";
import { KnowledgeMaps } from "./api/KnowledgeMaps.js";
import { LearnProfile } from "./api/LearnProfile.js";
import { Quizzes } from "./api/Quizzes.js";
import { Raw } from "./api/Raw.js";
import { StorySlides } from "./api/StorySlides.js";
import { ThemeMaterials } from "./api/ThemeMaterials.js";
import { Themes } from "./api/Themes.js";
import { Users } from "./api/Users.js";
import { XpProgress } from "./api/XpProgress.js";
import { ApiClient } from "./client/ApiClient.js";
import type { ApiClientOptions } from "./client/types.js";
import { CLASSHERO_API_URL } from "./constants.js";
import type { TokenSet } from "./types/common.js";

/** Options accepted by the high-level ClassHero SDK facade. */
export type ClassHeroOptions = ApiClientOptions;

/**
 * High-level facade that shares one authenticated {@link ApiClient} across every API domain.
 *
 * Additional domains are attached here as they are promoted from the route inventory into
 * typed facades.
 */
export class ClassHero {
    static readonly API_URL = CLASSHERO_API_URL;
    static readonly auth = new Auth(new ApiClient({ baseUrl: CLASSHERO_API_URL }));

    readonly transport: ApiClient;
    readonly auth: Auth;
    readonly users: Users;
    readonly classes: Classes;
    readonly disciplines: Disciplines;
    readonly courses: Courses;
    readonly enrollments: Enrollments;
    readonly assignments: Assignments;
    readonly themes: Themes;
    readonly themeMaterials: ThemeMaterials;
    readonly games: Games;
    readonly quizzes: Quizzes;
    readonly journeyMap: JourneyMap;
    readonly knowledgeMaps: KnowledgeMaps;
    readonly storySlides: StorySlides;
    readonly learnProfile: LearnProfile;
    readonly xp: XpProgress;
    readonly xpProgress: XpProgress;
    readonly raw: Raw;

    constructor(options: ClassHeroOptions = {}) {
        this.transport = new ApiClient({
            ...options,
            baseUrl: options.baseUrl ?? ClassHero.API_URL,
        });

        this.auth = new Auth(this.transport);
        this.users = new Users(this.transport);
        this.classes = new Classes(this.transport);
        this.disciplines = new Disciplines(this.transport);
        this.courses = new Courses(this.transport);
        this.enrollments = new Enrollments(this.transport);
        this.assignments = new Assignments(this.transport);
        this.themes = new Themes(this.transport);
        this.themeMaterials = new ThemeMaterials(this.transport);
        this.games = new Games(this.transport);
        this.quizzes = new Quizzes(this.transport);
        this.journeyMap = new JourneyMap(this.transport);
        this.knowledgeMaps = new KnowledgeMaps(this.transport);
        this.storySlides = new StorySlides(this.transport);
        this.learnProfile = new LearnProfile(this.transport);
        this.xp = new XpProgress(this.transport);
        this.xpProgress = this.xp;
        this.raw = new Raw(this.transport);
    }

    getTokens(): Readonly<TokenSet> {
        return this.transport.getTokens();
    }

    setTokens(tokens: TokenSet): this {
        this.transport.setTokens(tokens);
        return this;
    }

    clearTokens(): this {
        this.transport.clearTokens();
        return this;
    }
}
