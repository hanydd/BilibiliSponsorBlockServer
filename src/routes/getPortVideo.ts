import { Request, Response } from "express";
import { db } from "../databases/databases";
import { PortVideo } from "../types/portVideo.model";
import { QueryCacher } from "../utils/queryCacher";
import { portVideoCacheKey } from "../utils/redisKeys";
import { VideoID } from "../types/segments.model";

export async function getPortVideo(req: Request, res: Response): Promise<Response> {
    const videoID = req.query.videoID as VideoID;

    function getPortVideoDB(): Promise<PortVideo> {
        return db.prepare(
            "get",
            `SELECT "bvID", "ytbID", "UUID", "votes", "locked", "hidden", "biliDuration", "ytbDuration" FROM "portVideo"
            WHERE "bvID" = ? AND "hidden" = 0 AND "votes" > -2`,
            [videoID]
        );
    }
    const portVideoInfo: PortVideo = await QueryCacher.get(getPortVideoDB, portVideoCacheKey(videoID));

    return res.json(portVideoInfo);
}
