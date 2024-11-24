import { db } from "../databases/databases";
import { PortVideo, PortVideoCount, PortVideoDB, PortVideoInterface } from "../types/portVideo.model";
import { HiddenType, VideoID } from "../types/segments.model";
import { getHash } from "../utils/getHash";
import { QueryCacher } from "../utils/queryCacher";
import { portVideoByHashCacheKey, portVideoCacheKey, portVideoUserCountKey } from "../service/redis/redisKeys";

function getPortVideoDBByBvID(bvID: VideoID, downvoteThreshold = -2): Promise<PortVideoDB[]> {
    return db.prepare(
        "all",
        `SELECT "bvID", "cid", "ytbID", "UUID", "votes", "locked", "hidden", "biliDuration", "ytbDuration", "userID", "userAgent" FROM "portVideo"
        WHERE "bvID" = ? AND "hidden" = 0 AND "votes" > ?`,
        [bvID, downvoteThreshold]
    );
}

export function getPortVideoDBByBvIDCached(bvID: VideoID): Promise<PortVideoDB[]> {
    return QueryCacher.get(() => getPortVideoDBByBvID(bvID), portVideoCacheKey(bvID));
}

export async function getPortVideoByBvIDCached(bvID: VideoID): Promise<PortVideo[]> {
    const portVideoDB = await QueryCacher.get(() => getPortVideoDBByBvID(bvID), portVideoCacheKey(bvID));
    portVideoDB.forEach((element) => {
        delete element["userID"];
        delete element["userAgent"];
    });
    return portVideoDB;
}

function getPortVideoDBByHashPrefix(hashPrefix: string): Promise<PortVideoInterface[]> {
    return db.prepare(
        "all",
        `SELECT "bvID", "cid", "ytbID", "UUID", "votes", "locked" FROM "portVideo"
        WHERE "hashedBvID" LIKE ? AND "hidden" = 0 AND "votes" > -2`,
        [`${hashPrefix}%`]
    );
}

export function getPortVideoByHashPrefixCached(hashPrefix: string): Promise<PortVideoInterface[]> {
    return QueryCacher.get(() => getPortVideoDBByHashPrefix(hashPrefix), portVideoByHashCacheKey(hashPrefix));
}

async function getPortVideoUserCountFromDB(): Promise<Record<string, number>> {
    const portVideoRows: PortVideoCount[] = await db.prepare(
        "all",
        `SELECT
            COUNT ( * ) AS "portVideoSubmissions",
            COALESCE ( "userNames"."userName", "portVideo"."userID" ) AS "userName"
        FROM
            "portVideo"
            LEFT JOIN "userNames" ON "portVideo"."userID" = "userNames"."userID"
            LEFT JOIN "shadowBannedUsers" ON "portVideo"."userID" = "shadowBannedUsers"."userID"
        WHERE
            "portVideo"."votes" > - 1
            AND "portVideo"."hidden" = 0
            AND "shadowBannedUsers"."userID" IS NULL
        GROUP BY
            COALESCE ( "userNames"."userName", "portVideo"."userID" )`
    );

    const portVideoCounts: Record<string, number> = {};
    portVideoRows.forEach((element) => {
        portVideoCounts[element.userName] = element.portVideoSubmissions;
    });
    return portVideoCounts;
}

/**
 * hide port video record by UUID
 * video id is used to clear redis cache
 */
export async function hidePortVideoByUUID(
    UUID: string,
    bvID: VideoID,
    hiddenType = HiddenType.MismatchHidden
): Promise<void> {
    await db.prepare("run", `UPDATE "sponsorTimes" SET "hidden" = ? WHERE "UUID" = ?`, [hiddenType, UUID]);
    QueryCacher.clearPortVideoCache(bvID, getHash(bvID, 1));
}

export function getPortVideoUserCount(): Promise<Record<string, number>> {
    return QueryCacher.get(() => getPortVideoUserCountFromDB(), portVideoUserCountKey(), 600);
}
