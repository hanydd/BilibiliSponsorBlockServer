import { db } from "../databases/databases";
import { VideoID } from "../types/segments.model";
import { HashedUserID } from "../types/user.model";
import { Logger } from "../utils/logger";
import { getVideoDetails, VideoDetail } from "./api/getVideoDetails";
import redis from "./redis/redis";
import { tempVIPKey } from "./redis/redisKeys";

export const isUserTempVIP = async (hashedUserID: HashedUserID, videoID: VideoID, apiVideoDetails?: VideoDetail): Promise<boolean> => {
    if (!apiVideoDetails) {
        apiVideoDetails = await getVideoDetails(videoID);
    }
    const channelID = apiVideoDetails?.authorId;
    try {
        const reply = await redis.get(tempVIPKey(hashedUserID));
        return reply && reply == channelID;
    } catch (e) /* istanbul ignore next */ {
        Logger.error(e as string);
        return false;
    }
};

export async function isUserVIP(userID: HashedUserID): Promise<boolean> {
    return (await db.prepare("get", `SELECT count(*) as "userCount" FROM "vipUsers" WHERE "userID" = ? LIMIT 1`, [userID]))?.userCount > 0;
}
