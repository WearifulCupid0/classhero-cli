import { Api, createQuery } from "../client/Api.js";
import type {
    ApiDataResponse,
    JourneyBackgroundAcceptInput,
    JourneyBackgroundGenerateInput,
    JourneyBackgroundPreview,
    JourneyMapDefinition,
    JourneyMapProgressResponse,
    JourneyMapResponse,
    JourneyMapSessionResponse,
    JourneyMapUpsertInput,
    JourneyMediaKind,
    JourneyNodeCompletionResponse,
    JourneyPedagogicalCreditsResponse,
    JourneyVideoStatusResponse,
    UpdateJourneyVideoProgressInput,
    UnknownRecord,
} from "../types/index.js";

/** Student journey-map runtime plus the authoring operations exposed by the web client. */
export class JourneyMap extends Api {
    definition(missionId: string) {
        return this.request<ApiDataResponse<JourneyMapDefinition> | JourneyMapDefinition>(
            `/missions/${encodeURIComponent(missionId)}/journey-map`,
        );
    }

    student(missionId: string) {
        return this.request<JourneyMapResponse>(`/missions/${encodeURIComponent(missionId)}/journey-map/student`);
    }

    studentProgress(missionId: string) {
        return this.request<JourneyMapProgressResponse>(
            `/missions/${encodeURIComponent(missionId)}/journey-map/student/progress`,
        );
    }

    videoStatus(missionId: string, journeyMapId: string) {
        return this.request<JourneyVideoStatusResponse>(
            `/missions/${encodeURIComponent(missionId)}/journey-map/${encodeURIComponent(journeyMapId)}/student/video-status`,
        );
    }

    session(missionId: string, journeyMapId: string) {
        return this.request<JourneyMapSessionResponse>(
            `/missions/${encodeURIComponent(missionId)}/journey-map/${encodeURIComponent(journeyMapId)}/student/session`,
        );
    }

    updateSession(missionId: string, journeyMapId: string, lastNodeKey: string) {
        return this.request<JourneyMapSessionResponse>(
            `/missions/${encodeURIComponent(missionId)}/journey-map/${encodeURIComponent(journeyMapId)}/student/session`,
            {
                method: "POST",
                body: JSON.stringify({ last_node_key: lastNodeKey }),
            },
        );
    }

    completeNode(missionId: string, journeyMapId: string, nodeKey: string) {
        return this.request<JourneyNodeCompletionResponse>(
            `/missions/${encodeURIComponent(missionId)}/journey-map/${encodeURIComponent(journeyMapId)}/student/nodes/${encodeURIComponent(nodeKey)}/complete`,
            { method: "POST" },
        );
    }

    updateVideoProgress(
        missionId: string,
        journeyMapId: string,
        kind: JourneyMediaKind,
        input: UpdateJourneyVideoProgressInput,
    ) {
        return this.request<JourneyVideoStatusResponse>(
            `/missions/${encodeURIComponent(missionId)}/journey-map/${encodeURIComponent(journeyMapId)}/videos/${kind}/student/progress`,
            {
                method: "POST",
                body: JSON.stringify(input),
            },
        );
    }

    pedagogicalCreditsBalance(missionId: string) {
        return this.request<JourneyPedagogicalCreditsResponse>(
            `/missions/${encodeURIComponent(missionId)}/pedagogical-credits/balance`,
        );
    }

    backgroundImage(missionId: string, journeyMapId: string, version?: string | number) {
        return this.download(
            `/missions/${encodeURIComponent(missionId)}/journey-map/${encodeURIComponent(journeyMapId)}/background-image${createQuery({ v: version })}`,
        );
    }

    video(missionId: string, journeyMapId: string, kind: JourneyMediaKind, version?: string | number) {
        return this.download(
            `/missions/${encodeURIComponent(missionId)}/journey-map/${encodeURIComponent(journeyMapId)}/videos/${kind}${createQuery({ v: version })}`,
        );
    }

    teacherImage(missionId: string, journeyMapId: string, kind: JourneyMediaKind, version?: string | number) {
        return this.download(
            `/missions/${encodeURIComponent(missionId)}/journey-map/${encodeURIComponent(journeyMapId)}/teacher-image/${kind}${createQuery({ v: version })}`,
        );
    }

    generate(missionId: string) {
        return this.request<ApiDataResponse<JourneyMapDefinition> | UnknownRecord>(
            `/missions/${encodeURIComponent(missionId)}/journey-map/generate`,
            { method: "POST" },
        );
    }

    upsert(missionId: string, input: JourneyMapUpsertInput) {
        const isUpdate = Boolean(input.journey_map_id);
        const path = isUpdate
            ? `/missions/${encodeURIComponent(missionId)}/journey-map/${encodeURIComponent(input.journey_map_id as string)}`
            : `/missions/${encodeURIComponent(missionId)}/journey-map`;
        const { journey_map_id: _journeyMapId, ...body } = input;

        return this.request<ApiDataResponse<JourneyMapDefinition> | UnknownRecord>(path, {
            method: isUpdate ? "PATCH" : "POST",
            body: JSON.stringify(body),
        });
    }

    validate(missionId: string, journeyMapId: string) {
        return this.authoringAction(missionId, journeyMapId, "validate");
    }

    review(missionId: string, journeyMapId: string) {
        return this.authoringAction(missionId, journeyMapId, "review");
    }

    refreshAssociations(missionId: string, journeyMapId: string) {
        return this.authoringAction(missionId, journeyMapId, "refresh-associations");
    }

    publish(missionId: string, journeyMapId: string) {
        return this.authoringAction(missionId, journeyMapId, "publish");
    }

    unpublish(missionId: string, journeyMapId: string) {
        return this.authoringAction(missionId, journeyMapId, "unpublish");
    }

    uploadVideo(missionId: string, journeyMapId: string, kind: JourneyMediaKind, file: Blob, filename?: string) {
        const form = new FormData();
        filename ? form.append("file", file, filename) : form.append("file", file);

        return this.request<UnknownRecord>(
            `/missions/${encodeURIComponent(missionId)}/journey-map/${encodeURIComponent(journeyMapId)}/videos/${kind}/upload`,
            { method: "POST", body: form },
        );
    }

    uploadTeacherImage(
        missionId: string,
        journeyMapId: string,
        kind: JourneyMediaKind,
        file: Blob,
        filename?: string,
    ) {
        const form = new FormData();
        filename ? form.append("file", file, filename) : form.append("file", file);

        return this.request<UnknownRecord>(
            `/missions/${encodeURIComponent(missionId)}/journey-map/${encodeURIComponent(journeyMapId)}/teacher-image/${kind}/upload`,
            { method: "POST", body: form },
        );
    }

    setTeacherImageUrl(missionId: string, journeyMapId: string, kind: JourneyMediaKind, imageUrl: string) {
        return this.request<UnknownRecord>(
            `/missions/${encodeURIComponent(missionId)}/journey-map/${encodeURIComponent(journeyMapId)}/teacher-image/${kind}/upload-url`,
            { method: "POST", body: JSON.stringify({ image_url: imageUrl }) },
        );
    }

    generateBackground(missionId: string, journeyMapId: string, input: JourneyBackgroundGenerateInput = {}) {
        return this.request<ApiDataResponse<JourneyBackgroundPreview> | UnknownRecord>(
            `/missions/${encodeURIComponent(missionId)}/journey-map/${encodeURIComponent(journeyMapId)}/background/generate`,
            { method: "POST", body: JSON.stringify(input) },
        );
    }

    acceptBackground(missionId: string, journeyMapId: string, input: JourneyBackgroundAcceptInput) {
        return this.backgroundAction(missionId, journeyMapId, "accept", input);
    }

    discardBackground(missionId: string, journeyMapId: string, input: JourneyBackgroundAcceptInput) {
        return this.backgroundAction(missionId, journeyMapId, "discard", input);
    }

    uploadBackground(missionId: string, journeyMapId: string, file: Blob, filename?: string) {
        const form = new FormData();
        filename ? form.append("file", file, filename) : form.append("file", file);

        return this.request<UnknownRecord>(
            `/missions/${encodeURIComponent(missionId)}/journey-map/${encodeURIComponent(journeyMapId)}/background/upload`,
            { method: "POST", body: form },
        );
    }

    generationProgressUrl(missionId: string, generationId: string): string {
        return this.client.resolveUrl(
            `/missions/${encodeURIComponent(missionId)}/journey-map/generation-progress/${encodeURIComponent(generationId)}`,
        );
    }

    private authoringAction(missionId: string, journeyMapId: string, action: string) {
        return this.request<UnknownRecord>(
            `/missions/${encodeURIComponent(missionId)}/journey-map/${encodeURIComponent(journeyMapId)}/${action}`,
            { method: "POST" },
        );
    }

    private backgroundAction(
        missionId: string,
        journeyMapId: string,
        action: "accept" | "discard",
        input: JourneyBackgroundAcceptInput,
    ) {
        return this.request<UnknownRecord>(
            `/missions/${encodeURIComponent(missionId)}/journey-map/${encodeURIComponent(journeyMapId)}/background/${action}`,
            { method: "POST", body: JSON.stringify(input) },
        );
    }
}
