import { Request, Response } from "express";
import { VideoID } from "../types/segments.model";
import { HashedUserID, UserID } from "../types/user.model";
import { getIP } from "../utils/getIP";
import { getHashCache, getHashedIP } from "../utils/getHashCache";
import { AcquiredLock, acquireLock } from "../utils/redisLock";
import { PortVideo, portVideoUUID } from "../types/portVideo.model";
import { db } from "../databases/databases";
import { validate } from "../utils/bilibiliID";
import { isUserVIP } from "../utils/isUserVIP";
import { config } from "../config";

export async function voteOnPortVideo(req: Request, res: Response): Promise<Response> {
    const UUID = req.body.UUID as portVideoUUID;
    const bvID = req.body.bvID as VideoID;
    const paramUserID = req.body.userID as UserID;
    const type = req.body.type !== undefined ? parseInt(req.body.type as string) : undefined;
    const ip = getIP(req);
    const hashedIP = await getHashedIP(ip);

    // check params
    if (!UUID || !bvID || !paramUserID || !type) {
        return res.status(400).send("参数错误");
    }
    if (!validate(bvID)) {
        return res.status(400).send("视频ID有误");
    }
    if (paramUserID.length < config.minUserIDLength) {
        return res.status(400).send("用户ID有误");
    }
    // lock
    const lock = await acquireLock(`voteOnPortVideo:${UUID}.${paramUserID}`);
    if (!lock.status) {
        return res.status(429).send("Vote already in progress");
    }

    // vote logic
    const result = await vote(UUID, bvID, paramUserID, type);

    // return response
    lock.unlock();
    const response = res.status(result.status);
    if (result.message) {
        return response.send(result.message);
    } else if (result.json) {
        return response.json(result.json);
    } else {
        return response.send();
    }
}

export async function vote(
    UUID: portVideoUUID,
    bvID: VideoID,
    paramUserID: UserID,
    type: number,
    lock: AcquiredLock = null
): Promise<{ lock: AcquiredLock; status: number; message?: string; json?: string }> {
    const userID = (await getHashCache(paramUserID)) as HashedUserID;

    // get record and check params
    const portVideo = (await db.prepare("get", `SELECT * FROM "portVideo" WHERE "UUID" = ?`, [UUID])) as PortVideo;
    if (!portVideo) {
        return { lock, status: 404 };
    }
    if (portVideo.bvID != bvID) {
        return { lock, status: 400, message: "视频信息不匹配！" };
    }

    const isVip = await isUserVIP(userID);

    // vote
    const newVote = portVideo.votes + type;
    await db.prepare("run", `UPDATE "portVideo" SET "votes" = ? WHERE "UUID" = ?`, [newVote, UUID]);

    return { lock, status: 200 };
}
