import { Request, Response } from "express";
import { config } from "../config";
import { db } from "../databases/databases";
import { Logger } from "../utils/logger";
import { QueryCacher } from "../utils/queryCacher";
import { getTopUserKey } from "../utils/redisKeys";

export const SORT_TYPE_MAP: { [key: number]: string } = {
    0: "minutesSaved",
    1: "viewCount",
    2: "totalSubmissions",
    3: "userVotes",
    4: "portVideoSubmissions",
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
        additionalFields += `, "categorySumSponsor", "categorySumIntro", "categorySumOutro", "categorySumInteraction",
            "categorySumSelfpromo", "categorySumMusicOfftopic", "categorySumPreview", "categorySumHighlight",
            "categorySumFiller", "categorySumExclusiveAccess"`;
    }

    const rows = await db.prepare(
        "all",
        `SELECT "userName", "viewCount", "totalSubmissions", "minutesSaved", "userVotes", "portVideoSubmissions"
        ${additionalFields} FROM "topUser" ORDER BY "${sortBy}" DESC LIMIT 100`,
        []
    );

    for (const row of rows) {
        userNames.push(row.userName);
        viewCounts.push(row.viewCount);
        totalSubmissions.push(row.totalSubmissions);
        minutesSaved.push(row.minutesSaved);
        votes.push(row.userVotes);
        portVideo.push(row.portVideoSubmissions);
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
