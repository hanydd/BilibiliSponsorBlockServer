import { Request, Response } from "express";
import { config } from "../config";
import { db, privateDB } from "../databases/databases";
import { PortVideoDB, PortVideoVotesDB, portVideoUUID } from "../types/portVideo.model";
import { HiddenType, IPAddress, VideoID, VoteType } from "../types/segments.model";
import { HashedUserID, UserID } from "../types/user.model";
import { validate } from "../service/validate/bilibiliID";
import { getHash } from "../utils/getHash";
import { getHashCache, getHashedIP } from "../utils/getHashCache";
import { getIP } from "../utils/getIP";
import { isUserTempVIP, isUserVIP } from "../service/VIPUserService";
import { Logger } from "../utils/logger";
import { QueryCacher } from "../utils/queryCacher";
import { acquireLock } from "../service/redis/redisLock";

export async function voteOnPortVideo(req: Request, res: Response): Promise<Response> {
    const UUID = req.body.UUID as portVideoUUID;
    const bvID = req.body.bvID as VideoID;
    const paramUserID = req.body.userID as UserID;
    const type = req.body.type !== undefined ? parseInt(req.body.type as string) : undefined;
    const ip = getIP(req);

    // check params
    if (!UUID || !bvID || !paramUserID || type == undefined) {
        return res.status(400).send("缺少参数");
    }
    if (!validate(bvID)) {
        return res.status(400).send("视频BV号有误");
    }
    if (paramUserID.length < config.minUserIDLength) {
        return res.status(400).send("用户ID有误");
    }
    // lock
    const lock = await acquireLock(`voteOnPortVideo:${UUID}.${paramUserID}`);
    if (!lock.status) {
        return res.status(429).send("正在投票中……");
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

/**
 * Vote on a port video match record.
 * This function is not thread safe, external locks are recommended to prevent racing conditions
 */
export async function vote(
    UUID: portVideoUUID,
    bvID: VideoID,
    paramUserID: UserID,
    type: VoteType,
    ip: IPAddress
): Promise<{ status: number; message?: string; json?: string }> {
    const userID = (await getHashCache(paramUserID)) as HashedUserID;
    const hashedIP = await getHashedIP(ip);
    const isVip = await isUserVIP(userID);
    const isTempVIP = await isUserTempVIP(userID, bvID);

    // get record and check params
    if (type != VoteType.Upvote && type != VoteType.Downvote && type != VoteType.Undo) {
        return { status: 400, message: "不支持的类型" };
    }
    const portVideo = (await db.prepare("get", `SELECT * FROM "portVideo" WHERE "UUID" = ?`, [UUID])) as PortVideoDB;
    if (!portVideo) {
        return { status: 404 };
    }
    if (portVideo.bvID != bvID) {
        return { status: 400, message: "视频信息不匹配！" };
    }
    const isOwnSubmission = portVideo.userID === userID;
    const hasVipRight = isVip || isTempVIP || isOwnSubmission;

    // vote
    // get existing vote record
    const existingVoteRow: PortVideoVotesDB = await privateDB.prepare(
        "get",
        `SELECT * FROM "portVideoVotes" WHERE "UUID" = ? AND "userID" = ?`,
        [UUID, userID],
        { useReplica: true }
    );

    // calculate new votes
    let newVote = portVideo.votes;
    const oldVote = portVideo.votes;
    const oldType = existingVoteRow?.type;

    if (type === oldType) {
        // discard repeating vote
        return { status: 200 };
    } else if (type == VoteType.Upvote) {
        if (oldType == VoteType.Downvote) {
            // redo downvote
            newVote += 2;
        } else {
            newVote += 1;
        }
    } else if (type == VoteType.Downvote && !hasVipRight) {
        if (oldType == VoteType.Upvote) {
            // redo upvote
            newVote -= 2;
        } else {
            newVote -= 1;
        }
    } else if (type == VoteType.Downvote && hasVipRight) {
        newVote = -2;
        type = VoteType.ExtraDownvote;
    } else if (type == VoteType.Undo && existingVoteRow) {
        if (oldType == VoteType.Upvote) {
            newVote -= 1;
        } else if (oldType == VoteType.Downvote) {
            newVote += 1;
        } else if (oldType == VoteType.ExtraDownvote) {
            newVote = existingVoteRow.originalVotes;
        }
    }

    if (newVote === oldVote) {
        // no change in votes, skip
        return { status: 200 };
    }

    // save to database
    try {
        const timeSubmitted = Date.now();
        if (existingVoteRow) {
            await privateDB.prepare(
                "run",
                `UPDATE "portVideoVotes" SET "type" = ?, "originalVotes" = ?, "originalType" = ?,
                "hashedIP" = ?, "timeSubmitted" = ? WHERE id = ?`,
                [type, oldVote, oldType, hashedIP, timeSubmitted, existingVoteRow.id]
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

        if (newVote <= -2) {
            // mark all segments as hidden
            await db.prepare("run", `UPDATE "sponsorTimes" SET "hidden" = ? WHERE "portUUID" = ?`, [
                HiddenType.MismatchHidden,
                UUID,
            ]);
            // clear redis cache
            QueryCacher.clearPortVideoCache(bvID, getHash(bvID, 1));
            QueryCacher.clearSegmentCacheByID(bvID);
        } else if (newVote > -2 && oldVote <= -2) {
            await db.prepare("run", `UPDATE "sponsorTimes" SET "hidden" = ? WHERE "portUUID" = ? AND hidden = ?`, [
                HiddenType.Show,
                UUID,
                HiddenType.MismatchHidden,
            ]);
            // clear redis cache
            QueryCacher.clearPortVideoCache(bvID, getHash(bvID, 1));
            QueryCacher.clearSegmentCacheByID(bvID);
        }
    } catch (err) {
        Logger.error(err as string);
        return { status: 500 };
    }
    return { status: 200 };
}
