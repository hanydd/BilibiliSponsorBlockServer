import { Request, Response } from "express";
import { IPAddress, VideoID, VoteType } from "../types/segments.model";
import { HashedUserID, UserID } from "../types/user.model";
import { getIP } from "../utils/getIP";
import { getHashCache, getHashedIP } from "../utils/getHashCache";
import { AcquiredLock, acquireLock } from "../utils/redisLock";
import { PortVideo, PortVideoDB, PortVideoVotesDB, portVideoUUID } from "../types/portVideo.model";
import { db, privateDB } from "../databases/databases";
import { validate } from "../utils/bilibiliID";
import { isUserVIP } from "../utils/isUserVIP";
import { config } from "../config";
import { Logger } from "../utils/logger";
import { isUserTempVIP } from "../utils/isUserTempVIP";

export async function voteOnPortVideo(req: Request, res: Response): Promise<Response> {
    const UUID = req.body.UUID as portVideoUUID;
    const bvID = req.body.bvID as VideoID;
    const paramUserID = req.body.userID as UserID;
    const type = req.body.type !== undefined ? parseInt(req.body.type as string) : undefined;
    const ip = getIP(req);

    // check params
    if (!UUID || !bvID || !paramUserID || type == undefined) {
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
    const result = await vote(UUID, bvID, paramUserID, type, ip);

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
    type: VoteType,
    ip: IPAddress,
    lock: AcquiredLock = null
): Promise<{ lock: AcquiredLock; status: number; message?: string; json?: string }> {
    const userID = (await getHashCache(paramUserID)) as HashedUserID;
    const hashedIP = await getHashedIP(ip);
    const isVip = await isUserVIP(userID);
    const isTempVIP = await isUserTempVIP(userID, bvID);

    // get record and check params
    if (type != VoteType.Upvote && type != VoteType.Downvote && type != VoteType.Undo) {
        return { lock, status: 400, message: "不支持的类型" };
    }
    const portVideo = (await db.prepare("get", `SELECT * FROM "portVideo" WHERE "UUID" = ?`, [UUID])) as PortVideoDB;
    if (!portVideo) {
        return { lock, status: 404 };
    }
    if (portVideo.bvID != bvID) {
        return { lock, status: 400, message: "视频信息不匹配！" };
    }
    const isOwnSubmission = portVideo.userID === userID;
    const hasVipRight = isVip || isTempVIP || isOwnSubmission;

    // vote
    // get existing vote record
    const voteRow: PortVideoVotesDB = await privateDB.prepare(
        "get",
        `SELECT * FROM "portVideoVotes" WHERE "UUID" = ? AND "userID" = ?`,
        [UUID, userID],
        { useReplica: true }
    );

    // calculate new votes
    let newVote = portVideo.votes;
    const oldVote = portVideo.votes;
    const oldType = voteRow?.type;

    if (type === oldType) {
        // discard repeat vote
        return { lock, status: 200 };
    } else if (type == VoteType.Upvote) {
        newVote += 1;
    } else if (type == VoteType.Downvote && !hasVipRight) {
        newVote -= 1;
    } else if (type == VoteType.Downvote && hasVipRight) {
        newVote = -2;
        type = VoteType.ExtraDownvote;
    } else if (type == VoteType.Undo && voteRow) {
        if (oldType == VoteType.Upvote) {
            newVote -= 1;
        } else if (oldType == VoteType.Downvote) {
            newVote += 1;
        } else if (oldType == VoteType.ExtraDownvote) {
            newVote = voteRow.originalVotes;
        }
    }

    if (newVote === oldVote) {
        // no change in votes, skip
        return { lock, status: 200 };
    }

    // save to database
    try {
        const timeSubmitted = Date.now();
        if (voteRow) {
            await privateDB.prepare(
                "run",
                `UPDATE "portVideoVotes" SET "type" = ?, "originalVotes" = ?, "originalType" = ?,
                "hashedIP" = ?, "timeSubmitted" = ? WHERE id = ?`,
                [type, oldVote, oldType, hashedIP, timeSubmitted, voteRow.id]
            );
        } else {
            await privateDB.prepare(
                "run",
                `INSERT INTO "portVideoVotes" ("bvID", "UUID", "type", "originalVotes", "userID",
                "hashedIP", "timeSubmitted") VALUES(?,?,?,?,?,?,?)`,
                [bvID, UUID, type, oldVote, userID, hashedIP, timeSubmitted]
            );
        }

        await db.prepare("run", `UPDATE "portVideo" SET "votes" = ? WHERE "UUID" = ?`, [newVote, UUID]);
    } catch (err) {
        Logger.error(err as string);
        return { lock, status: 500 };
    }
    return { lock, status: 200 };
}
