import { Request, Response } from "express";
import { config } from "../config";
import { getPortVideoUserCount } from "../dao/portVideo";
import { db } from "../databases/databases";
import { Logger } from "../utils/logger";
import { QueryCacher } from "../utils/queryCacher";
import { getTopUserKey } from "../utils/redisKeys";

const maxRewardTimePerSegmentInSeconds = config.maxRewardTimePerSegmentInSeconds ?? 86400;
export const SORT_TYPE_MAP: { [key: number]: string } = {
    0: "minutesSaved",
    1: "viewCount",
    2: "totalSubmissions",
    3: "userVotes",
};

async function generateTopUsersStats(sortBy: string, categoryStatsEnabled = false) {
    const userNames = [];
    const viewCounts = [];
    const totalSubmissions = [];
    const minutesSaved = [];
    const votes = [];
    const portVideo = [];
    const categoryStats: any[] = categoryStatsEnabled ? [] : undefined;

    let additionalFields = "";
    if (categoryStatsEnabled) {
        additionalFields += `
            SUM(CASE WHEN category = 'sponsor' THEN 1 ELSE 0 END) as "categorySumSponsor",
            SUM(CASE WHEN category = 'intro' THEN 1 ELSE 0 END) as "categorySumIntro",
            SUM(CASE WHEN category = 'outro' THEN 1 ELSE 0 END) as "categorySumOutro",
            SUM(CASE WHEN category = 'interaction' THEN 1 ELSE 0 END) as "categorySumInteraction",
            SUM(CASE WHEN category = 'selfpromo' THEN 1 ELSE 0 END) as "categorySumSelfpromo",
            SUM(CASE WHEN category = 'music_offtopic' THEN 1 ELSE 0 END) as "categorySumMusicOfftopic",
            SUM(CASE WHEN category = 'preview' THEN 1 ELSE 0 END) as "categorySumPreview",
            SUM(CASE WHEN category = 'poi_highlight' THEN 1 ELSE 0 END) as "categorySumHighlight",
            SUM(CASE WHEN category = 'filler' THEN 1 ELSE 0 END) as "categorySumFiller",
            SUM(CASE WHEN category = 'exclusive_access' THEN 1 ELSE 0 END) as "categorySumExclusiveAccess",
        `;
    }

    const rows = await db.prepare(
        "all",
        `SELECT COUNT(*) as "totalSubmissions", SUM(views) as "viewCount",
        SUM((CASE WHEN "sponsorTimes"."endTime" - "sponsorTimes"."startTime" > ? THEN ?
            ELSE "sponsorTimes"."endTime" - "sponsorTimes"."startTime" END) / 60 * "sponsorTimes"."views") as "minutesSaved",
        SUM("votes") as "userVotes", ${additionalFields}
        COALESCE("userNames"."userName", "sponsorTimes"."userID") as "userName"
        FROM "sponsorTimes"
            LEFT JOIN "userNames" on "sponsorTimes"."userID" = "userNames"."userID"
            LEFT JOIN "shadowBannedUsers" ON "sponsorTimes"."userID"="shadowBannedUsers"."userID"
        WHERE "sponsorTimes"."votes" > -1 AND "sponsorTimes"."shadowHidden" != 1 AND "shadowBannedUsers"."userID" IS NULL
        GROUP BY COALESCE("userNames"."userName", "sponsorTimes"."userID")
        ORDER BY "${sortBy}" DESC LIMIT 100`,
        [maxRewardTimePerSegmentInSeconds, maxRewardTimePerSegmentInSeconds]
    );

    const portVideoCounts = await getPortVideoUserCount();

    for (const row of rows) {
        userNames.push(row.userName);
        viewCounts.push(row.viewCount);
        totalSubmissions.push(row.totalSubmissions);
        minutesSaved.push(row.minutesSaved);
        votes.push(row.userVotes);
        portVideo.push(portVideoCounts[row.userName] ?? 0);
        if (categoryStatsEnabled) {
            categoryStats.push([
                row.categorySumSponsor,
                row.categorySumIntro,
                row.categorySumOutro,
                row.categorySumInteraction,
                row.categorySumSelfpromo,
                row.categorySumMusicOfftopic,
                row.categorySumPreview,
                row.categorySumHighlight,
                row.categorySumFiller,
                row.categorySumExclusiveAccess,
            ]);
        }
    }

    return {
        userNames,
        viewCounts,
        totalSubmissions,
        minutesSaved,
        votes,
        portVideo,
        categoryStats,
    };
}

export async function getTopUsers(req: Request, res: Response): Promise<Response> {
    const sortType = parseInt(req.query.sortType as string);
    const categoryStatsEnabled = req.query.categoryStats === "true";

    //setup which sort type to use
    const sortBy = SORT_TYPE_MAP[sortType];
    if (!sortBy) {
        //invalid request
        return res.sendStatus(400);
    }

    if (db.highLoad()) {
        return res.status(503).send("Disabled for load reasons");
    }

    try {
        const stats = await QueryCacher.get(
            () => generateTopUsersStats(sortBy, categoryStatsEnabled),
            getTopUserKey(sortBy, categoryStatsEnabled),
            config.getTopUsersCacheTimeMinutes * 60
        );

        //send this result
        return res.send(stats);
    } catch (e) {
        Logger.error(e as string);
        return res.sendStatus(500);
    }
}
