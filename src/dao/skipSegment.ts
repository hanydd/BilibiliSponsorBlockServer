import { db, privateDB } from "../databases/databases";
import { PORT_SEGMENT_USER_ID } from "../routes/postPortVideo";
import { portVideoUUID } from "../types/portVideo.model";
import { DBSegment, HashedIP, HiddenType, Segment, SegmentUUID, Service, VideoID, VideoIDHash, Visibility } from "../types/segments.model";
import { getHash } from "../utils/getHash";
import { getPortSegmentUUID } from "../utils/getSubmissionUUID";
import { QueryCacher } from "../utils/queryCacher";
import { skipSegmentsHashKey, skipSegmentsKey } from "../utils/redisKeys";

export async function getSegmentsFromDBByHash(hashedVideoIDPrefix: VideoIDHash, service: Service): Promise<DBSegment[]> {
    const fetchFromDB = () =>
        db.prepare(
            "all",
            `SELECT "videoID", "cid", "startTime", "endTime", "votes", "locked", "UUID", "userID", "category", "actionType", "videoDuration", "hidden", "reputation", "shadowHidden", "hashedVideoID", "timeSubmitted", "description", "ytbID", "ytbSegmentUUID", "portUUID" FROM "sponsorTimes"
            WHERE "hashedVideoID" LIKE ? AND "service" = ? ORDER BY "startTime"`,
            [`${hashedVideoIDPrefix}%`, service],
            { useReplica: true }
        ) as Promise<DBSegment[]>;

    if (hashedVideoIDPrefix.length >= 4) {
        return await QueryCacher.get(fetchFromDB, skipSegmentsHashKey(hashedVideoIDPrefix, service));
    }

    return await fetchFromDB();
}

export async function getSegmentsFromDBByVideoID(videoID: VideoID, service: Service): Promise<DBSegment[]> {
    const fetchFromDB = () =>
        db.prepare(
            "all",
            `SELECT "cid", "startTime", "endTime", "votes", "locked", "UUID", "userID", "category", "actionType", "videoDuration", "hidden", "reputation", "shadowHidden", "timeSubmitted", "description", "ytbID", "ytbSegmentUUID", "portUUID" FROM "sponsorTimes"
            WHERE "videoID" = ? AND "service" = ? ORDER BY "startTime"`,
            [videoID, service],
            { useReplica: true }
        ) as Promise<DBSegment[]>;

    return await QueryCacher.get(fetchFromDB, skipSegmentsKey(videoID, service));
}

/**
 * hide segments by UUID from the same video,
 * provide the video id to clear redis cache
 */
export async function hideSegmentsByUUID(UUIDs: string[], bvID: VideoID, hiddenType = HiddenType.MismatchHidden): Promise<void> {
    if (UUIDs.length === 0) {
        return;
    }
    await db.prepare("run", `UPDATE "sponsorTimes" SET "hidden" = ? WHERE "UUID" IN (${Array(UUIDs.length).fill("?").join(",")})`, [
        hiddenType,
        ...UUIDs,
    ]);
    QueryCacher.clearSegmentCacheByID(bvID);
}

export function createSegmentsFromYTB(
    ytbSegments: Segment[],
    bvID: VideoID,
    ytbID: VideoID,
    timeSubmitted: number,
    reputation: number,
    userAgent: string,
    portRecordUUID: portVideoUUID
): DBSegment[] {
    const hashedBvID = getHash(bvID, 1);
    const newSegments: DBSegment[] = ytbSegments.map((ytbSegment) => {
        return {
            videoID: bvID,
            startTime: ytbSegment.segment[0],
            endTime: ytbSegment.segment[1],

            votes: ytbSegment.votes,
            locked: ytbSegment.locked,
            UUID: getPortSegmentUUID(bvID, ytbID, ytbSegment.UUID, timeSubmitted) as SegmentUUID,
            userID: PORT_SEGMENT_USER_ID,
            timeSubmitted: timeSubmitted,
            views: 0,

            category: ytbSegment.category,
            actionType: ytbSegment.actionType,
            service: Service.YouTube,

            videoDuration: ytbSegment.videoDuration,
            hidden: HiddenType.Show,
            reputation: reputation,
            shadowHidden: Visibility.VISIBLE,
            hashedVideoID: hashedBvID,
            userAgent: userAgent,
            description: ytbSegment.description,

            ytbID: ytbID,
            ytbSegmentUUID: ytbSegment.UUID,
            portUUID: portRecordUUID,

            required: false,
        } as DBSegment;
    });
    return newSegments;
}

/**
 * Save segments to the database
 */
export async function saveNewSegments(segments: DBSegment[], hashedIP: HashedIP = "" as HashedIP): Promise<void> {
    if (segments.length === 0) {
        return;
    }
    const sponsorTime = [];
    const privateSponsorTime = [];

    for (const s of segments) {
        sponsorTime.push([
            s.videoID,
            s.startTime,
            s.endTime,
            s.votes,
            s.locked,
            s.UUID,
            s.userID,
            s.timeSubmitted,
            s.views,
            s.category,
            s.actionType,
            s.service,
            s.videoDuration,
            s.reputation,
            s.shadowHidden,
            s.hashedVideoID,
            s.userAgent,
            s.description,
            s.ytbID,
            s.ytbSegmentUUID,
            s.portUUID,
        ]);

        privateSponsorTime.push([s.videoID, hashedIP, s.timeSubmitted, s.service]);
    }
    await db.prepare(
        "run",
        `INSERT INTO "sponsorTimes" ("videoID", "startTime", "endTime", "votes", "locked", "UUID",
        "userID", "timeSubmitted", "views", "category", "actionType", "service", "videoDuration", "reputation",
        "shadowHidden", "hashedVideoID", "userAgent", "description", "ytbID", "ytbSegmentUUID", "portUUID")
        VALUES ${Array(sponsorTime.length).fill("(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").join(",")}`,
        sponsorTime.flat()
    );
    await privateDB.prepare(
        "run",
        `INSERT INTO "sponsorTimes" ("videoID", "hashedIP", "timeSubmitted", "service")
        VALUES ${Array(privateSponsorTime.length).fill("(?, ?, ?, ?)").join(",")}`,
        privateSponsorTime.flat()
    );

    // clear redis cache
    const videoIDSet = new Set(segments.map((s) => s.videoID));
    videoIDSet.forEach((videoID) => QueryCacher.clearSegmentCacheByID(videoID));
}

export async function updateVotes(segments: DBSegment[]): Promise<void> {
    if (segments.length === 0) {
        return;
    }
    const segmentVotes = [];
    for (const s of segments) {
        segmentVotes.push([s.UUID, s.votes]);
    }
    await db.prepare(
        "run",
        `UPDATE "sponsorTimes" SET "votes" = f."votes"
        FROM (VALUES ${Array(segments.length).fill("(?::TEXT, ?::INT)").join(",")})
        AS f("UUID", "votes") WHERE "sponsorTimes"."UUID" = f."UUID"`,
        segmentVotes.flat()
    );

    // clear redis cache
    const videoIDSet = new Set(segments.map((s) => s.videoID));
    videoIDSet.forEach((videoID) => QueryCacher.clearSegmentCacheByID(videoID));
}
