import { Request, Response } from "express";
import { config } from "../config";
import { getPortVideoUserCount } from "../dao/portVideo";
import { db } from "../databases/databases";
import { Logger } from "../utils/logger";
import { validateCategories } from "../utils/parseParams";
import { QueryCacher } from "../utils/queryCacher";
import { getTopCategoryUserKey } from "../utils/redisKeys";
import { SORT_TYPE_MAP } from "./getTopUsers";

/* istanbul ignore next */
const maxRewardTimePerSegmentInSeconds = config.maxRewardTimePerSegmentInSeconds ?? 86400;

interface DBSegment {
    userName: string;
    viewCount: number;
    totalSubmissions: number;
    userVotes: number;
    minutesSaved: number;
}

async function generateTopCategoryUsersStats(sortBy: string, category: string) {
    const userNames = [];
    const viewCounts = [];
    const totalSubmissions = [];
    const votes = [];
    const portVideo = [];
    const minutesSaved = [];

    const rows: DBSegment[] = await db.prepare(
        "all",
        `SELECT COUNT(*) as "totalSubmissions", SUM(views) as "viewCount",
        SUM(((CASE WHEN "sponsorTimes"."endTime" - "sponsorTimes"."startTime" > ? THEN ?
            ELSE "sponsorTimes"."endTime" - "sponsorTimes"."startTime" END) / 60) * "sponsorTimes"."views") as "minutesSaved",
        SUM("votes") as "userVotes",
       "sponsorTimes"."userID" as "userName"
        FROM "sponsorTimes"
            LEFT JOIN "shadowBannedUsers" ON "sponsorTimes"."userID"="shadowBannedUsers"."userID"
        WHERE "sponsorTimes"."category" = ? AND "sponsorTimes"."votes" > -1 AND "sponsorTimes"."shadowHidden" != 1 AND "shadowBannedUsers"."userID" IS NULL
        GROUP BY "sponsorTimes"."userID"
        HAVING SUM("votes") >= 0
        ORDER BY "${sortBy}" DESC LIMIT 100`,
        [maxRewardTimePerSegmentInSeconds, maxRewardTimePerSegmentInSeconds, category]
    );

    const portVideoCounts = await getPortVideoUserCount();

    if (rows) {
        for (const row of rows) {
            userNames.push(row.userName);
            viewCounts.push(row.viewCount);
            totalSubmissions.push(row.totalSubmissions);
            votes.push(row.userVotes);
            portVideo.push(portVideoCounts[row.userName] ?? 0);
            minutesSaved.push(category === "chapter" ? 0 : row.minutesSaved);
        }
    }

    return {
        userNames,
        viewCounts,
        totalSubmissions,
        votes,
        portVideo,
        minutesSaved,
    };
}

export async function getTopCategoryUsers(req: Request, res: Response): Promise<Response> {
    const sortType = parseInt(req.query.sortType as string);
    const category = req.query.category as string;

    if (sortType == undefined || !validateCategories([category])) {
        //invalid request
        return res.sendStatus(400);
    }

    if (db.highLoad()) {
        return res.status(503).send("Disabled for load reasons");
    }

    //setup which sort type to use
    const sortBy = SORT_TYPE_MAP[sortType];
    if (!sortBy) {
        //invalid request
        return res.sendStatus(400);
    }

    try {
        const stats = await QueryCacher.get(
            () => generateTopCategoryUsersStats(sortBy, category),
            getTopCategoryUserKey(sortBy, category),
            config.getTopUsersCacheTimeMinutes * 60
        );

        //send this result
        return res.send(stats);
    } catch (e) {
        Logger.error(e as string);
        return res.sendStatus(500);
    }
}
