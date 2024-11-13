import { CronJob } from "cron";
import { saveVideoInfo } from "../dao/videoInfo";
import { db } from "../databases/databases";
import { DBSegment, HiddenType, SegmentUUID } from "../types/segments.model";
import { durationEquals } from "../utils/durationUtil";
import { getVideoDetails, VideoDetail } from "../utils/getVideoDetails";
import { Logger } from "../utils/logger";
import { sleep } from "../utils/timeUtil";

export const refreshCidJob = new CronJob("*/1 * * * *", () => refreshCid());

let isRunning = false;

async function refreshCid() {
    if (isRunning) {
        Logger.info("refreshCid already running, skipping");
        return;
    }

    isRunning = true;
    const allSegments: DBSegment[] = await db.prepare("all", `SELECT * FROM "sponsorTimes" WHERE "cid" = NULL or "cid" = ''`, []);
    const videoSegmentMap = new Map<string, DBSegment[]>();
    for (const segment of allSegments) {
        if (!videoSegmentMap.has(segment.videoID)) {
            videoSegmentMap.set(segment.videoID, []);
        }
        videoSegmentMap.get(segment.videoID)?.push(segment);
    }
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

        await sleep(10000);
    }

    isRunning = false;
}
