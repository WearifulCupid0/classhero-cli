import type {
    PluginStorage,
} from "@classhero-cli/plugin-api";
import type {
    MissionBonusGameTargetId,
} from "../contracts/mission.js";

const STORAGE_KEY =
    "mission-bonus-completions";

export interface MissionBonusCompletion {
    readonly completedAt: string;
    readonly gameId?: MissionBonusGameTargetId;
    readonly source:
        | "local-completion"
        | "xp-progress";
    readonly xpAwarded?: number;
}

type CompletionMap =
    Record<
        string,
        MissionBonusCompletion
    >;

/**
 * Local completion cache for the mission bonus.
 *
 * The server remains authoritative whenever XP progress is available. This
 * cache prevents a second attempt from the same CLI installation and also
 * covers successful bonus games that happened to award zero XP.
 */
export class MissionBonusCompletionStore {
    constructor(
        private readonly storage:
            PluginStorage,
    ) {}

    async get(
        missionId: string,
    ): Promise<MissionBonusCompletion | undefined> {
        const values =
            await this.readAll();

        return values[
            missionId
        ];
    }

    async mark(
        missionId: string,
        completion: MissionBonusCompletion,
    ): Promise<void> {
        const values =
            await this.readAll();

        await this.storage.set(
            STORAGE_KEY,
            {
                ...values,
                [missionId]:
                    completion,
            },
        );
    }

    private async readAll(): Promise<CompletionMap> {
        const value =
            await this.storage.get<unknown>(
                STORAGE_KEY,
            );

        if (!isRecord(value)) {
            return {};
        }

        const result:
            CompletionMap = {};

        for (
            const [
                missionId,
                raw,
            ] of Object.entries(
                value,
            )
        ) {
            if (!isCompletion(raw)) {
                continue;
            }

            result[missionId] =
                raw;
        }

        return result;
    }
}

function isCompletion(
    value: unknown,
): value is MissionBonusCompletion {
    if (!isRecord(value)) {
        return false;
    }

    return (
        typeof value.completedAt ===
            "string" &&
        (
            value.source ===
                "local-completion" ||
            value.source ===
                "xp-progress"
        ) &&
        (
            value.gameId ===
                undefined ||
            value.gameId ===
                "memory" ||
            value.gameId ===
                "word-search" ||
            value.gameId ===
                "hangman"
        )
    );
}

function isRecord(
    value: unknown,
): value is Record<string, unknown> {
    return (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
    );
}
