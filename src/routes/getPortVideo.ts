import { Request, Response } from "express";
import { getPortVideoByBvIDCached, getPortVideoByHashPrefixCached } from "../dao/portVideo";
import { db } from "../databases/databases";
import { HashedValue } from "../types/hash.model";
import { PortVideo, PortVideoInterface } from "../types/portVideo.model";
import { HiddenType, VideoID } from "../types/segments.model";
import { validate } from "../utils/bilibiliID";
import { durationsAllEqual } from "../utils/durationUtil";
import { Logger } from "../utils/logger";

export async function getPortVideo(req: Request, res: Response): Promise<Response> {
    const bvID = req.query.videoID as VideoID;
    const duration = parseFloat(req.query.duration as string) || 0;

    // validate parameters
    if (!validate(bvID)) {
        return res.status(400).send("无效BV号");
    }

    // get cached data from redis
    const portVideoInfo: PortVideo[] = await getPortVideoByBvIDCached(bvID);

    if (!portVideoInfo || portVideoInfo.length == 0) {
        return res.sendStatus(404);
    } else if (portVideoInfo.length >= 2) {
        // multiple found
        // TODO: mark the highes vote or latest as the only valid record
        Logger.error(`Multiple port video matches found for ${bvID}`);
    }

    const portVideo = portVideoInfo[0];

    if (duration > 0) {
        await checkDuration(portVideo, duration);
    }

    return res.json({
        bvID: portVideo.bvID,
        ytbID: portVideo.ytbID,
        UUID: portVideo.UUID,
        votes: portVideo.votes,
        locked: portVideo.locked,
    } as PortVideoInterface);
}

export async function getPortVideoByHash(req: Request, res: Response): Promise<Response> {
    const hashPrefix = req.params.prefix as HashedValue;

    // validate parameters
    if (!hashPrefix) {
        return res.status(400).send("无效参数");
    }

    // get data and cache in redis
    const portVideoInfo: PortVideoInterface[] = await getPortVideoByHashPrefixCached(hashPrefix);

    if (!portVideoInfo || portVideoInfo.length == 0) {
        return res.sendStatus(404);
    }
    return res.json(portVideoInfo);
}

async function checkDuration(portVideo: PortVideo, duration: number): Promise<boolean> {
    if (durationsAllEqual([duration, portVideo.biliDuration, portVideo.ytbDuration])) {
        return true;
    }

    // duration mismatch, use api to get the correct duration

    // mark the record as invalid
    await db.prepare("run", `UPDATE "portVideo" SET "hidden" = 1 WHERE "UUID" = ?`, [portVideo.UUID]);
    await db.prepare("run", `UPDATE "sponsorTimes" SET "hidden" = ? WHERE "portUUID" = ?`, [
        HiddenType.MismatchHidden,
        portVideo.UUID,
    ]);

    return false;
}
