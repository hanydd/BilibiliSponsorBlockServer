import { CronJob } from "cron";
import { saveVideoInfo } from "../dao/videoInfo";
import { db } from "../databases/databases";
import { getVideoDetails, VideoDetail } from "../service/api/getVideoDetails";
import { PortVideoDB } from "../types/portVideo.model";
import { DBSegment, HiddenType, SegmentUUID } from "../types/segments.model";
import { durationEquals } from "../utils/durationUtil";
import { Logger } from "../utils/logger";

export const refreshCidJob = new CronJob("0 5 * * 0", () => refreshCid());

let isRunning = false;

async function refreshCid() {
    if (isRunning) {
        Logger.info("refreshCid already running, skipping");
        return;
    }

    isRunning = true;

    // refresh port video records
    const portVideos: PortVideoDB[] = await db.prepare(
        "all",
        `SELECT * FROM "portVideo" WHERE "cid" = NULL or "cid" = '' ORDER BY "timeSubmitted" DESC`
    );
    for (const portVideo of portVideos) {
        let biliVideoDetail: VideoDetail;
        try {
            biliVideoDetail = await getVideoDetails(portVideo.bvID);
            if (biliVideoDetail === null || biliVideoDetail === undefined) {
                Logger.error(`Failed to get video detail for ${portVideo.bvID}`);
                continue;
            }
        } catch (e) {
            Logger.error(`Failed to get video detail for ${portVideo.bvID}`);
            continue;
        }

        await saveVideoInfo(biliVideoDetail);

        if (biliVideoDetail.page.length === 1 || !!biliVideoDetail.page[0].cid) {
            // if there is only 1 part
            if (durationEquals(biliVideoDetail.page[0].duration, portVideo.biliDuration)) {
                await db.prepare("run", `UPDATE "portVideo" SET "cid" = ? WHERE "UUID" = ?`, [biliVideoDetail.page[0].cid, portVideo.UUID]);
            } else {
                await db.prepare("run", `UPDATE "portVideo" SET "hidden" = ? WHERE "UUID" = ?`, [
                    HiddenType.MismatchHidden,
                    portVideo.UUID,
                ]);
            }
        } else {
            // try to find a matching cid
            const possibleCids = biliVideoDetail.page.filter((p) => durationEquals(p.duration, portVideo.biliDuration));
            if (possibleCids.length === 1) {
                await db.prepare("run", `UPDATE "portVideo" SET "cid" = ? WHERE "UUID" = ?`, [possibleCids[0].cid, portVideo.UUID]);
            }
        }
    }

    // refresh sponsorTimes records
    const allSegments: DBSegment[] = await db.prepare(
        "all",
        `SELECT * FROM "sponsorTimes" WHERE "cid" = NULL or "cid" = '' ORDER BY "timeSubmitted" DESC`
    );
    const videoSegmentMap = new Map<string, DBSegment[]>();
    for (const segment of allSegments) {
        if (!videoSegmentMap.has(segment.videoID)) {
            videoSegmentMap.set(segment.videoID, []);
        }
        videoSegmentMap.get(segment.videoID)?.push(segment);
    }

    // order the video by the number of views
    // videoSegmentMap = new Map(
    //     Array.from(videoSegmentMap.entries()).sort(([, aSegments], [, bSegments]) => {
    //         const aViews = aSegments.reduce((sum, segment) => sum + segment.views, 0);
    //         const bViews = bSegments.reduce((sum, segment) => sum + segment.views, 0);
    //         return bViews - aViews;
    //     })
    // );

    Logger.info(`Found ${videoSegmentMap.size} videos with missing cids`);

    for (const [videoID, segments] of videoSegmentMap) {
        let biliVideoDetail: VideoDetail;
        try {
            biliVideoDetail = await getVideoDetails(videoID);
            if (biliVideoDetail === null || biliVideoDetail === undefined) {
                Logger.error(`Failed to get video detail for ${videoID}`);
                continue;
            }
        } catch (e) {
            Logger.error(`Failed to get video detail for ${videoID}`);
            continue;
        }

        await saveVideoInfo(biliVideoDetail);

        const invalidIDs: SegmentUUID[] = [];

        if (biliVideoDetail.page.length === 1 || !!biliVideoDetail.page[0].cid) {
            await db.prepare("run", `UPDATE "sponsorTimes" SET "cid" = ? WHERE "videoID" = ? AND "cid" = ''`, [
                biliVideoDetail.page[0].cid,
                videoID,
            ]);
            invalidIDs.push(
                ...segments.filter((s) => !durationEquals(s.videoDuration, biliVideoDetail.page[0].duration)).map((s) => s.UUID)
            );
        } else {
            // find a matching cid
            for (const segment of segments) {
                const possibleCids = biliVideoDetail.page.filter((p) => durationEquals(p.duration, segment.videoDuration));
                if (possibleCids.length === 1) {
                    await db.prepare("run", `UPDATE "sponsorTimes" SET "cid" = ? WHERE "UUID" = ?`, [possibleCids[0].cid, segment.UUID]);
                }
            }
        }

        // Hide segments with invalid cids
        if (invalidIDs.length > 0) {
            await db.prepare("run", `UPDATE "sponsorTimes" SET "hidden" = ? WHERE "UUID" IN (${invalidIDs.map(() => "?").join(",")})`, [
                HiddenType.Hidden,
                ...invalidIDs,
            ]);
        }
    }

    isRunning = false;
}
