import { Request, Response } from "express";
import { db } from "../databases/databases";
import { PortVideo, PortVideoInterface } from "../types/portVideo.model";
import { QueryCacher } from "../utils/queryCacher";
import { portVideoCacheKey } from "../utils/redisKeys";
import { VideoID } from "../types/segments.model";
import { validate } from "../utils/bilibiliID";
import { Logger } from "../utils/logger";

export async function getPortVideo(req: Request, res: Response): Promise<Response> {
    const bvID = req.query.videoID as VideoID;

    // validate parameters
    if (!validate(bvID)) {
        return res.status(400).send("无效BV号");
    }

    // get data and cache in redis
    function getPortVideoDB(): Promise<PortVideo[]> {
        return db.prepare(
            "all",
            `SELECT "bvID", "ytbID", "UUID", "votes", "locked", "hidden", "biliDuration", "ytbDuration" FROM "portVideo"
            WHERE "bvID" = ? AND "hidden" = 0 AND "votes" > -2`,
            [bvID]
        );
    }
    const portVideoInfo: PortVideo[] = await QueryCacher.get(getPortVideoDB, portVideoCacheKey(bvID));

    if (!portVideoInfo || portVideoInfo.length == 0) {
        return res.sendStatus(404);
    } else if (portVideoInfo.length >= 2) {
        // multiple found
        // TODO: mark the highes vote or latest as the only valid record
        Logger.error(`Multiple port video matches found for ${bvID}`);
    }
    return res.json({
        bvID: portVideoInfo[0].bvID,
        ytbID: portVideoInfo[0].ytbID,
        UUID: portVideoInfo[0].UUID,
        votes: portVideoInfo[0].votes,
        locked: portVideoInfo[0].locked,
    } as PortVideoInterface);
}
