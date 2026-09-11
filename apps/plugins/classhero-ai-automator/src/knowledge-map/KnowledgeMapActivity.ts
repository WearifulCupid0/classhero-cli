import type {
    JourneyMapNode,
    KnowledgeMapRole,
    StudentKnowledgeMap,
} from "@classhero-cli/api-wrapper";
import {
    isCliActivityBundle,
    type CliContextSnapshot,
} from "@classhero-cli/plugin-api";
import {
    missionContextFromSnapshot,
    type MissionAutomationContext,
} from "../contracts/mission.js";

/** Journey Map knowledge-map node selected as a normal CLI activity. */
export interface KnowledgeMapActivityContext {
    readonly mission: MissionAutomationContext;
    readonly node: JourneyMapNode;
    readonly knowledgeMapId: string;
    readonly title: string;
    readonly targetType: string;
    /** Ordered role candidates that can be checked without side effects. */
    readonly roleCandidates: readonly KnowledgeMapRole[];
}

/** Exact ClassHero map resolved for a selected Journey Map node. */
export interface ResolvedKnowledgeMapActivity {
    readonly activity: KnowledgeMapActivityContext;
    readonly role: KnowledgeMapRole;
    readonly map: StudentKnowledgeMap;
}

/**
 * Extracts a knowledge-map activity from the CLI snapshot.
 *
 * Knowledge maps are deliberately not converted into ActivityContext because
 * they are Journey resources rather than ThemeMaterials.
 */
export function knowledgeMapActivityFromSnapshot(
    snapshot: CliContextSnapshot,
): KnowledgeMapActivityContext | undefined {
    const selected = snapshot.activity;
    const mission = missionContextFromSnapshot(
        snapshot,
    );

    if (
        !selected ||
        !mission ||
        !isCliActivityBundle(
            selected.value,
        )
    ) {
        return undefined;
    }

    const target =
        selected.value.targets.find(
            (candidate) =>
                isJourneyKnowledgeMapNode(
                    candidate.value,
                ),
        );

    if (
        !target ||
        !isJourneyKnowledgeMapNode(
            target.value,
        )
    ) {
        return undefined;
    }

    const node = target.value;

    return {
        mission,
        node,
        knowledgeMapId:
            node.target_id,
        title:
            selected.name ??
            node.title,
        targetType:
            node.target_type,
        roleCandidates:
            knowledgeMapRoleCandidates(
                node,
            ),
    };
}

/**
 * Builds safe role candidates for ClassHero's
 * `/knowledge-maps/:role/student` route.
 *
 * The response must still be checked against `knowledgeMapId` before use. This
 * prevents a heuristic role from ever opening/saving a different map.
 */
export function knowledgeMapRoleCandidates(
    node: JourneyMapNode,
): KnowledgeMapRole[] {
    const explicit = [
        readString(
            node.target_route_payload,
            "knowledge_map_role",
        ),
        readString(
            node.target_route_payload,
            "map_role",
        ),
        readString(
            node.target_route_payload,
            "role",
        ),
    ];

    const known =
        knownRoleForTargetType(
            node.target_type,
        );

    const derived = [
        deriveRole(
            node.target_type,
        ),
        deriveRole(
            node.node_key,
        ),
    ];

    return uniqueStrings([
        ...explicit,
        known,
        ...derived,
        /* Known roles are harmless GET fallbacks because the returned map id
         * is verified before any mark-opened/save side effect occurs. */
        "initial",
        "final",
    ]);
}

/** Current final-map semantics require one idea+doubt for every reference. */
export function isFinalSynthesis(
    resolved: Pick<
        ResolvedKnowledgeMapActivity,
        "role" | "activity"
    >,
): boolean {
    return (
        resolved.role === "final" ||
        resolved.activity.targetType ===
            "final_concept_map"
    );
}

function knownRoleForTargetType(
    targetType: string,
): string | undefined {
    const normalized = normalize(
        targetType,
    );

    switch (normalized) {
        case "initial_mind_map":
            return "initial";
        case "final_concept_map":
            return "final";
        default:
            return undefined;
    }
}

function deriveRole(
    value: string,
): string | undefined {
    let normalized = normalize(
        value,
    );

    for (const suffix of [
        "_knowledge_map",
        "_concept_map",
        "_mind_map",
        "_map",
    ]) {
        if (
            normalized.endsWith(
                suffix,
            )
        ) {
            normalized =
                normalized.slice(
                    0,
                    -suffix.length,
                );
            break;
        }
    }

    return normalized.length > 0
        ? normalized
        : undefined;
}

function readString(
    record: unknown,
    key: string,
): string | undefined {
    if (!isRecord(record)) {
        return undefined;
    }

    const value = record[key];

    return typeof value === "string" &&
        value.trim().length > 0
        ? value.trim()
        : undefined;
}

function uniqueStrings(
    values: readonly (
        | string
        | undefined
    )[],
): KnowledgeMapRole[] {
    const result: string[] = [];

    for (const value of values) {
        if (
            value === undefined ||
            result.includes(value)
        ) {
            continue;
        }

        result.push(value);
    }

    return result;
}

function isJourneyKnowledgeMapNode(
    value: unknown,
): value is JourneyMapNode {
    if (!isRecord(value)) {
        return false;
    }

    return (
        value.target_scope ===
            "knowledge_map" &&
        typeof value.node_id ===
            "string" &&
        typeof value.node_key ===
            "string" &&
        typeof value.target_id ===
            "string" &&
        typeof value.target_type ===
            "string" &&
        typeof value.title ===
            "string"
    );
}

function normalize(
    value: string,
): string {
    return value
        .trim()
        .toLowerCase()
        .replace(
            /[^a-z0-9]+/g,
            "_",
        )
        .replace(
            /^_+|_+$/g,
            "",
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
