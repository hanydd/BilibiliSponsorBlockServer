import { Request, Response } from "express";
import { Segment, VideoDuration } from "../types/segments.model";
import { db } from "../databases/databases";
import { HashedUserID } from "../types/user.model";
import { getHashCache } from "../utils/getHashCache";
import { config } from "../config";
import * as youtubeID from "../utils/youtubeID";
import * as biliID from "../utils/bilibiliID";
import axios from "axios";
import { getVideoDetails, videoDetails } from "../utils/getVideoDetails";
import { parseUserAgent } from "../utils/userAgent";
import { getMatchVideoUUID } from "../utils/getSubmissionUUID";
import { isUserVIP } from "../utils/isUserVIP";
import { Logger } from "../utils/logger";
import { PortVideo } from "../types/portVideo.model";
import { average } from "../utils/array";
import { getYoutubeSegments, getYoutubeVideoDetail } from "../utils/getYoutubeVideoSegments";
import { durationEquals, durationsAllEqual } from "../utils/durationUtil";

type CheckResult = {
    pass: boolean;
    errorMessage: string;
    errorCode: number;
};

const CHECK_PASS: CheckResult = {
    pass: true,
    errorMessage: "",
    errorCode: 0,
};

export async function postPortVideo(req: Request, res: Response): Promise<Response> {
    const bvID = req.query.bvID || req.body.bvID;
    const ytbID = req.query.ytbID || req.body.ytbID;
    const paramUserID = req.query.userID || req.body.userID;
    let paramBiliDuration: VideoDuration = (parseFloat(req.query.biliDuration || req.body.biliDuration) ||
        0) as VideoDuration;

    if (!paramUserID) {
        return res.status(400).send("No userID provided");
    }
    const userID: HashedUserID = await getHashCache(paramUserID);

    const invalidCheckResult = checkInvalidFields(bvID, ytbID, paramUserID);
    if (!invalidCheckResult.pass) {
        return res.status(invalidCheckResult.errorCode).send(invalidCheckResult.errorMessage);
    }

    const [ytbSegments, biliVideoDetail] = await Promise.all([getYoutubeSegments(ytbID), getVideoDetails(bvID, true)]);

    if (!ytbSegments) {
        res.status(400).send("无法连接SponsorBlock服务器");
    }

    // get ytb video duration
    let ytbDuration: VideoDuration = 0 as VideoDuration;
    if (ytbSegments.length === 0) {
        ytbDuration = await getYoutubeVideoDetail(ytbID);
    } else {
        ytbDuration = average(ytbSegments.map((s) => s.videoDuration)) as VideoDuration;
        Logger.info(`Retrieved ${ytbSegments.length} segments from SB server. Average video duration: ${ytbDuration}s`);
    }

    // video duration check
    if (!ytbDuration) {
        return res.status(500).send(`无法获取YouTube视频信息，请重试。
如果始终无法提交，您可以前往项目地址反馈：https://github.com/HanYaodong/BilibiliSponsorBlock/issues/new`);
    }
    let apiBiliDuration = biliVideoDetail?.duration as VideoDuration;
    if (!paramBiliDuration && !apiBiliDuration) {
        return res.status(400).send(`无法获取B站视频信息，请重试。
如果始终无法提交，您可以前往项目地址反馈：https://github.com/HanYaodong/BilibiliSponsorBlock/issues/new`);
    }
    if (!paramBiliDuration) {
        paramBiliDuration = apiBiliDuration;
    }
    if (!apiBiliDuration) {
        apiBiliDuration = paramBiliDuration;
    }
    if (Math.abs(paramBiliDuration - apiBiliDuration) > 2) {
        return res.status(400).send("视频时长异常，请刷新页面重试");
    }
    if (Math.abs(ytbDuration - paramBiliDuration) > 2 && Math.abs(ytbDuration - apiBiliDuration) > 2) {
        return res.status(400).send("对应视频时长不一致，无法绑定");
    }

    // TODO: handle duration change

    // check existing matches
    const existingMatch: PortVideo[] = await db.prepare(
        "all",
        `SELECT "bvID", "ytbID", "UUID", "votes", "locked", "hidden", "biliDuration", "ytbDuration"
        FROM "portVideo" WHERE "bvID" = ? OR "ytbID" = ?`,
        [bvID, ytbID]
    );

    // check if the existing data is exactly the same as the submitted ones
    const exactMatches = existingMatch.filter(
        (port) =>
            port.bvID == bvID &&
            port.ytbID == ytbID &&
            durationsAllEqual([port.biliDuration, port.ytbDuration, apiBiliDuration, ytbDuration])
    );
    if (exactMatches.length > 0) {
        if (exactMatches.filter((s) => s.votes <= -2 || s.hidden).length > 0) {
            return res.status(409).send("此YouTube视频已被标记为错误的搬运视频！");
        } else {
            // TODO: count submission as vote
            return res.status(200).send("OK");
        }
    }

    // check video availability, if existing matches contain videos that are unavailable, hide them.
    const uuidToHide = new Set();
    // ytb videos
    const bvMatches = existingMatch.filter((p) => p.bvID == bvID && p.votes > -2 && !p.hidden);
    if (bvMatches.length > 1) {
        Logger.error(`Multiple PortVideo match found for bvid: ${bvID}`);
    }
    const allYtbDurations: VideoDuration[] = await Promise.all(bvMatches.map((p) => getYoutubeVideoDetail(p.ytbID)));
    for (let i = 0; i < allYtbDurations.length; i++) {
        if (!allYtbDurations[i] || !durationEquals(allYtbDurations[i], bvMatches[i].ytbDuration)) {
            uuidToHide.add(bvMatches[i].UUID);
        }
    }
    // bili videos
    const ytbMatches = existingMatch.filter(
        (p) => !uuidToHide.has(p.UUID) && p.ytbID == ytbID && p.votes > -2 && !p.hidden
    );
    const allBiliDetails: videoDetails[] = await Promise.all(ytbMatches.map((p) => getVideoDetails(p.bvID)));
    for (let i = 0; i < allBiliDetails.length; i++) {
        if (!allBiliDetails[i] || !durationEquals(allBiliDetails[i].duration, ytbMatches[i].biliDuration)) {
            uuidToHide.add(ytbMatches[i].UUID);
        }
    }
    if (uuidToHide.size > 0) {
        await db.prepare("run", `UPDATE "portVideo" SET hidden = 1 WHERE "UUID" = ANY(?)`, [Array.from(uuidToHide)]);
    }

    // prepare to be saved
    const isVIP = await isUserVIP(userID);
    const userAgent = req.query.userAgent ?? req.body.userAgent ?? parseUserAgent(req.get("user-agent")) ?? "";
    const timeSubmitted = Date.now();
    const matchVideoUUID = getMatchVideoUUID(bvID, ytbID, userID, paramBiliDuration, ytbDuration, timeSubmitted);
    const startingVotes = 0;
    const startingLocked = isVIP ? 1 : 0;

    // save match video
    try {
        await db.prepare(
            "run",
            `INSERT INTO "portVideo" ("bvID", "ytbID", "UUID", "votes", "locked", "userID", "timeSubmitted",
             "biliDuration", "ytbDuration", "userAgent", "hidden") VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
            [
                bvID,
                ytbID,
                matchVideoUUID,
                startingVotes,
                startingLocked,
                userID,
                timeSubmitted,
                paramBiliDuration,
                ytbDuration,
                userAgent,
                0,
            ]
        );
    } catch (err) {
        Logger.error(err as string);
        return res.sendStatus(500);
    }

    // save all segments

    return res.status(200).send("OK");
}

function checkInvalidFields(bvID: string, ytbID: string, paramUserID: string): CheckResult {
    const invalidFields = [];
    const errors = [];

    if (typeof ytbID !== "string" || ytbID?.length == 0) {
        invalidFields.push("ytbID");
    }
    if (typeof bvID !== "string" || bvID?.length == 0) {
        invalidFields.push("bvID");
    }

    const minLength = config.minUserIDLength;
    if (typeof paramUserID !== "string" || paramUserID?.length < minLength) {
        invalidFields.push("userID");
        if (paramUserID?.length < minLength) errors.push(`userID must be at least ${minLength} characters long`);
    }

    if (config.mode !== "test") {
        const sanitizedYtbID = youtubeID.validate(ytbID) ? ytbID : youtubeID.sanitize(ytbID);
        if (!youtubeID.validate(sanitizedYtbID)) {
            invalidFields.push("ytbID");
            errors.push("YouTube videoID could not be extracted");
        }

        const sanitizedBvID = biliID.validate(bvID) ? bvID : biliID.sanitize(bvID);
        if (!biliID.validate(sanitizedBvID)) {
            invalidFields.push("bvID");
            errors.push("Bilibili videoID could not be extracted");
        }
    }

    if (invalidFields.length !== 0) {
        // invalid request
        const formattedFields = invalidFields.reduce((p, c, i) => p + (i !== 0 ? ", " : "") + c, "");
        const formattedErrors = errors.reduce((p, c, i) => p + (i !== 0 ? ". " : " ") + c, "");
        return {
            pass: false,
            errorMessage: `No valid ${formattedFields}.${formattedErrors}`,
            errorCode: 400,
        };
    }

    return CHECK_PASS;
}
