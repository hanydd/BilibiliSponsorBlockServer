import { db } from "../databases/databases";
import { PortVideoDB, PortVideoInterface } from "../types/portVideo.model";
import { VideoID } from "../types/segments.model";
import { QueryCacher } from "../utils/queryCacher";
import { portVideoByHashCacheKey, portVideoCacheKey } from "../utils/redisKeys";

function getPortVideoDBByBvID(bvID: VideoID, downvoteThreshold = -2): Promise<PortVideoDB[]> {
    return db.prepare(
        "all",
        `SELECT "bvID", "ytbID", "UUID", "votes", "locked", "hidden", "biliDuration", "ytbDuration" FROM "portVideo"
        WHERE "bvID" = ? AND "hidden" = 0 AND "votes" > ?`,
        [bvID, downvoteThreshold]
    );
}

export function getPortVideoByBvIDCached(bvID: VideoID): Promise<PortVideoDB[]> {
    return QueryCacher.get(() => getPortVideoDBByBvID(bvID), portVideoCacheKey(bvID));
}

function getPortVideoDBByHashPrefix(hashPrefix: string): Promise<PortVideoInterface[]> {
    return db.prepare(
        "all",
        `SELECT "bvID", "ytbID", "UUID", "votes", "locked" FROM "portVideo"
        WHERE "hashedBvID" LIKE ? AND "hidden" = 0 AND "votes" > -2`,
        [`${hashPrefix}%`]
    );
}

export function getPortVideoByHashPrefixCached(hashPrefix: string): Promise<PortVideoInterface[]> {
    return QueryCacher.get(() => getPortVideoDBByHashPrefix(hashPrefix), portVideoByHashCacheKey(hashPrefix));
}
